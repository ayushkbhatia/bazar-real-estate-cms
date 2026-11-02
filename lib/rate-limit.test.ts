/**
 * @vitest-environment node
 *
 * lib/env.ts only reads server-only env vars when `typeof window === "undefined"`,
 * so this file pins to the node environment.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("rate-limit no-op path (Upstash env unset)", () => {
  it("checkRateLimit returns ok=true and the full request budget when env vars are missing", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    const r = await checkRateLimit({
      name: "test-bucket",
      ip: "1.2.3.4",
      requests: 10,
      windowSeconds: 60,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Allowance equal to the configured cap — no real limiter ran.
      expect(r.remaining).toBe(10);
    }
  });

  it("repeated calls all return ok=true (no shared in-process counter)", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    for (let i = 0; i < 50; i++) {
      const r = await checkRateLimit({
        name: "burst",
        ip: "1.2.3.4",
        requests: 10,
        windowSeconds: 60,
      });
      expect(r.ok).toBe(true);
    }
  });
});

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

describe("rate-limit Postgres path (deployed, no Upstash)", () => {
  function deployed() {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
  }

  beforeEach(() => {
    rpc.mockReset();
  });

  it("counts through rate_limit_hit with a hashed key, never the address", async () => {
    deployed();
    rpc.mockResolvedValue({ data: 0, error: null });
    const { checkRateLimit } = await import("./rate-limit");
    const r = await checkRateLimit({ name: "enquiry", ip: "203.0.113.5", requests: 10, windowSeconds: 60 });
    expect(r.ok).toBe(true);
    const [fn, args] = rpc.mock.calls[0]!;
    expect(fn).toBe("rate_limit_hit");
    expect(args).toMatchObject({ p_bucket: "enquiry", p_limit: 10, p_window_seconds: 60 });
    expect(args.p_key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain("203.0.113.5");
  });

  it("refuses with the wait the database reports", async () => {
    deployed();
    rpc.mockResolvedValue({ data: 42, error: null });
    const { checkRateLimit } = await import("./rate-limit");
    const r = await checkRateLimit({ name: "enquiry", ip: "203.0.113.5", requests: 10, windowSeconds: 60 });
    expect(r).toEqual({ ok: false, retryAfterSeconds: 42 });
  });

  it("lets the request through when the count itself fails", async () => {
    deployed();
    rpc.mockResolvedValue({ data: null, error: { message: "timeout" } });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { checkRateLimit } = await import("./rate-limit");
    const r = await checkRateLimit({ name: "enquiry", ip: "203.0.113.5", requests: 10, windowSeconds: 60 });
    expect(r.ok).toBe(true);
  });

  it("stays off outside a Vercel deployment", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    const { checkRateLimit } = await import("./rate-limit");
    await checkRateLimit({ name: "enquiry", ip: "203.0.113.5", requests: 10, windowSeconds: 60 });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("extractClientIp", () => {
  it("returns the first hop of x-forwarded-for when present", async () => {
    const { extractClientIp } = await import("./rate-limit");
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" });
    expect(extractClientIp(h)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    const { extractClientIp } = await import("./rate-limit");
    const h = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(extractClientIp(h)).toBe("198.51.100.7");
  });

  it("falls back to x-vercel-forwarded-for", async () => {
    const { extractClientIp } = await import("./rate-limit");
    const h = new Headers({ "x-vercel-forwarded-for": "192.0.2.9, 70.41.3.18" });
    expect(extractClientIp(h)).toBe("192.0.2.9");
  });

  it("returns 'unknown' when no forwarding headers are present", async () => {
    const { extractClientIp } = await import("./rate-limit");
    expect(extractClientIp(new Headers())).toBe("unknown");
  });
});

describe("rateLimitMessage", () => {
  it("returns the short copy for instant retries", async () => {
    const { rateLimitMessage } = await import("./rate-limit");
    expect(rateLimitMessage(0)).toMatch(/try again in a moment/i);
    expect(rateLimitMessage(1)).toMatch(/try again in a moment/i);
  });

  it("includes the second count when over a moment", async () => {
    const { rateLimitMessage } = await import("./rate-limit");
    expect(rateLimitMessage(12)).toContain("12s");
  });
});
