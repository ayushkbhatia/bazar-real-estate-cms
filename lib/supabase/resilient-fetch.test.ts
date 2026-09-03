import { describe, expect, it, vi } from "vitest";

import { createResilientFetch } from "./resilient-fetch";

/** No real waiting: every spec below drives the backoff through this. */
const noSleep = () => Promise.resolve();

function make(
  responses: Array<Response | Error | "hang">,
  extra: Parameters<typeof createResilientFetch>[0] = {},
) {
  const calls: Array<{ method: string; signal?: AbortSignal | null }> = [];
  let i = 0;
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        method: (
          init?.method ?? (input instanceof Request ? input.method : "GET")
        ).toUpperCase(),
        signal: init?.signal,
      });
      const next = responses[Math.min(i++, responses.length - 1)];
      if (next === "hang") {
        // Resolve only when the caller's own signal aborts — which is exactly
        // what a hung connection looks like to the wrapper.
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            ),
          );
        });
      }
      if (next instanceof Error) throw next;
      return next;
    },
  );
  const f = createResilientFetch({ fetchImpl, sleepImpl: noSleep, ...extra });
  return { f, fetchImpl, calls };
}

const ok = () => new Response("{}", { status: 200 });
const status = (s: number, headers?: HeadersInit) =>
  new Response("", { status: s, headers });

describe("createResilientFetch", () => {
  it("returns a healthy response without retrying", async () => {
    const { f, fetchImpl } = make([ok()]);
    const res = await f("https://db.example.com/rest/v1/properties");
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  /**
   * The 2026-09-03 failure. Cloudflare answers 522 in front of Supabase, so
   * the request never reached Postgres and asking again is safe by
   * construction.
   */
  it("retries a Cloudflare 522 and returns the eventual success", async () => {
    const { f, fetchImpl } = make([status(522), status(522), ok()]);
    const res = await f("https://db.example.com/rest/v1/areas");
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries 5xx and 429, and gives up after the last attempt", async () => {
    for (const s of [500, 502, 503, 504, 429, 521, 527]) {
      const { f, fetchImpl } = make([status(s)]);
      const res = await f("https://db.example.com/rest/v1/x");
      expect(res.status, `status ${s}`).toBe(s);
      // Three attempts, then the caller gets the real response to handle.
      expect(fetchImpl, `status ${s}`).toHaveBeenCalledTimes(3);
    }
  });

  /** A 401 or a 404 is an answer. Asking again is just slower. */
  it("does not retry a 4xx that is not 429", async () => {
    for (const s of [400, 401, 403, 404, 409, 422]) {
      const { f, fetchImpl } = make([status(s)]);
      const res = await f("https://db.example.com/rest/v1/x");
      expect(res.status).toBe(s);
      expect(fetchImpl, `status ${s}`).toHaveBeenCalledTimes(1);
    }
  });

  it("retries a thrown network error", async () => {
    const { f, fetchImpl } = make([new TypeError("fetch failed"), ok()]);
    const res = await f("https://db.example.com/rest/v1/x");
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws the last error when every attempt fails", async () => {
    const { f, fetchImpl } = make([new TypeError("ECONNRESET")]);
    await expect(f("https://db.example.com/rest/v1/x")).rejects.toThrow(
      "ECONNRESET",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  /**
   * The load-bearing behaviour, and the one a plain retry loop would not have.
   * `fetch` has no timeout, so an unbounded hang held the prerender open until
   * Next's 60s budget expired and there was never a second attempt.
   */
  it("bounds a hung connection and retries it", async () => {
    const { f, fetchImpl } = make(["hang", "hang", ok()], {
      perAttemptMs: 5,
    });
    const res = await f("https://db.example.com/rest/v1/slow");
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("aborts each attempt on its own deadline, not the caller's", async () => {
    const { f, calls } = make(["hang", ok()], { perAttemptMs: 5 });
    await f("https://db.example.com/rest/v1/slow");
    // Every attempt is handed a signal, and they are distinct objects — a
    // shared one would stay aborted and poison attempt two.
    expect(calls).toHaveLength(2);
    expect(calls[0]!.signal).toBeInstanceOf(AbortSignal);
    expect(calls[0]!.signal).not.toBe(calls[1]!.signal);
    expect(calls[1]!.signal!.aborted).toBe(false);
  });

  /**
   * Retrying a POST because the response never arrived risks applying it
   * twice. No amount of build resilience is worth that.
   */
  it("never repeats a non-idempotent method", async () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      const { f, fetchImpl } = make([status(503)]);
      const res = await f("https://db.example.com/rest/v1/x", { method });
      expect(res.status, method).toBe(503);
      expect(fetchImpl, method).toHaveBeenCalledTimes(1);
    }
  });

  it("repeats HEAD, which PostgREST uses for a count-only read", async () => {
    const { f, fetchImpl } = make([status(503), ok()]);
    const res = await f("https://db.example.com/rest/v1/x", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reads the method off a Request object too", async () => {
    const { f, fetchImpl } = make([status(503)]);
    const req = new Request("https://db.example.com/rest/v1/x", {
      method: "POST",
    });
    await f(req);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  /** A deliberate cancellation must end the loop, not restart it. */
  it("respects a caller that aborts", async () => {
    const controller = new AbortController();
    const { f, fetchImpl } = make(["hang"], { perAttemptMs: 10_000 });
    const p = f("https://db.example.com/rest/v1/x", {
      signal: controller.signal,
    });
    controller.abort();
    await expect(p).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not start work for a signal that is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const { f, fetchImpl } = make([ok()]);
    await f("https://db.example.com/rest/v1/x", {
      signal: controller.signal,
    }).catch(() => undefined);
    // Passed straight through — one call, no retry loop.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("honours Retry-After, clamped so it cannot park the build", async () => {
    const waits: number[] = [];
    const { f } = make([status(429, { "retry-after": "2" }), ok()], {
      sleepImpl: async (ms) => {
        waits.push(ms);
      },
    });
    await f("https://db.example.com/rest/v1/x");
    expect(waits).toEqual([2000]);

    const wild: number[] = [];
    const { f: g } = make([status(429, { "retry-after": "3600" }), ok()], {
      sleepImpl: async (ms) => {
        wild.push(ms);
      },
    });
    await g("https://db.example.com/rest/v1/x");
    expect(wild[0]).toBeLessThanOrEqual(5000);
  });

  it("ignores a nonsense Retry-After and backs off instead", async () => {
    const waits: number[] = [];
    const { f } = make([status(429, { "retry-after": "soon" }), ok()], {
      sleepImpl: async (ms) => {
        waits.push(ms);
      },
    });
    await f("https://db.example.com/rest/v1/x");
    expect(waits[0]).toBeGreaterThan(0);
    expect(waits[0]).toBeLessThan(2000);
  });

  it("backs off further on each attempt", async () => {
    const waits: number[] = [];
    const { f } = make([status(503), status(503), ok()], {
      sleepImpl: async (ms) => {
        waits.push(ms);
      },
    });
    await f("https://db.example.com/rest/v1/x");
    expect(waits).toHaveLength(2);
    expect(waits[1]).toBeGreaterThan(waits[0]!);
  });

  /**
   * The hazard of any retry layer is that it turns a visible outage into a
   * slow build nobody looks at. The callback is what keeps it in the log.
   */
  it("reports every swallowed failure", async () => {
    const seen: string[] = [];
    const { f } = make([status(522), new TypeError("boom"), ok()], {
      onRetry: ({ attempt, reason }) => seen.push(`${attempt}:${reason}`),
    });
    await f("https://db.example.com/rest/v1/x");
    expect(seen).toEqual(["1:HTTP 522", "2:boom"]);
  });

  it("keeps the total attempts bounded", async () => {
    const { f, fetchImpl } = make([status(503)], { attempts: 5 });
    await f("https://db.example.com/rest/v1/x");
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  /**
   * Three attempts at 10s plus backoff has to stay inside Next's 60s
   * per-route prerender budget, or the wrapper reintroduces the failure it
   * exists to prevent.
   */
  it("has a worst case that fits inside the prerender budget", async () => {
    const waits: number[] = [];
    const { f } = make([status(503)], {
      perAttemptMs: 10_000,
      sleepImpl: async (ms) => {
        waits.push(ms);
      },
    });
    await f("https://db.example.com/rest/v1/x");
    const ceiling = 3 * 10_000 + waits.reduce((a, b) => a + b, 0);
    expect(ceiling).toBeLessThan(60_000);
  });
});

/**
 * The assumption the idempotency rule rests on.
 *
 * Everything above stubs `fetch` and asserts the wrapper's own behaviour. None
 * of it proves the thing that actually matters in production: that supabase-js
 * issues a GET for `.select()`, and therefore that a public read is repeatable
 * at all. If PostgREST ever moved reads to POST — it has a `POST /rpc` idiom
 * already — this module would silently stop retrying the exact traffic it was
 * written for, and every test above would still pass.
 *
 * So this drives a real `SupabaseClient` through the wrapper and looks at what
 * it sent.
 */
describe("what supabase-js actually sends", () => {
  it("issues a retryable GET for .select(), and retries a 522", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const seen: string[] = [];
    let call = 0;
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.push(
          (
            init?.method ?? (input instanceof Request ? input.method : "GET")
          ).toUpperCase(),
        );
        call += 1;
        // Fail the way the 2026-09-03 build failed, then recover.
        if (call === 1) return new Response("", { status: 522 });
        return new Response(JSON.stringify([{ id: "p-1" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );

    const client = createClient("https://db.example.com", "anon-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: createResilientFetch({ fetchImpl, sleepImpl: noSleep }),
      },
    });

    const { data, error } = await client
      .from("properties")
      .select("id")
      .limit(1);

    expect(error).toBeNull();
    expect(data).toEqual([{ id: "p-1" }]);
    // Two calls: the 522 and the retry that answered it.
    expect(seen).toEqual(["GET", "GET"]);
  });

  /** The other half: a write must reach the database exactly once. */
  it("sends one POST for .insert() even when it fails", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const seen: string[] = [];
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.push(
          (
            init?.method ?? (input instanceof Request ? input.method : "GET")
          ).toUpperCase(),
        );
        return new Response("", { status: 503 });
      },
    );
    const client = createClient("https://db.example.com", "anon-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: createResilientFetch({ fetchImpl, sleepImpl: noSleep }),
      },
    });

    await client.from("newsletter_subscribers").insert({ email: "a@b.co" });
    expect(seen).toEqual(["POST"]);
  });
});
