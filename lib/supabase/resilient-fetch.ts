/**
 * A `fetch` that survives a blip, for the anon-key reads the build is made of.
 *
 * WHY THIS EXISTS
 *
 * `npm run build` prerenders 837 pages and every one of them reads Supabase.
 * Twice on 2026-09-03 a deploy died because the database was briefly
 * unreachable — once with a Cloudflare 522 from the project host, once as a
 * cascade of `took more than 60 seconds` across 17 `/ar` routes. Neither was a
 * code failure, both read as one, and a retry cleared them every time. That is
 * the definition of a fault worth absorbing rather than reporting.
 *
 * THE PART THAT ACTUALLY MATTERS
 *
 * The naive fix — wrap the call in a retry loop — would not have saved either
 * build. `fetch` has no default timeout: a connection that hangs stays hung,
 * and Next's per-route prerender budget (60s) expires with the first attempt
 * still open. There is never a second attempt. So the load-bearing half of
 * this file is `PER_ATTEMPT_MS`, which turns an unbounded hang into a fast
 * failure that a retry can answer. The retry is the cheap half.
 *
 * Three attempts at 10s each, plus backoff, is a 32s ceiling — comfortably
 * inside the 60s route budget, so a route that would have timed out now either
 * succeeds or fails early enough for the caller's own `catch` to render its
 * fallback.
 *
 * WHAT IS NOT RETRIED
 *
 * Only idempotent methods. `.select()` — every public read on the site — is a
 * GET, and PostgREST reserves POST for writes and RPC. Retrying a POST because
 * the response never arrived risks applying it twice, and no amount of build
 * resilience is worth that.
 *
 * And only transient statuses: 5xx, the Cloudflare 52x family, and 429. A 401
 * or a 404 is an answer, and asking again three times is just slower.
 */

/** Per attempt. The number that makes a retry reachable at all. */
const PER_ATTEMPT_MS = 10_000;

/** Total attempts, first included. */
const ATTEMPTS = 3;

/** Base backoff; doubles per attempt and carries jitter. */
const BACKOFF_MS = 400;

/**
 * Methods safe to repeat.
 *
 * PostgREST issues GET for `.select()` and HEAD for a count-only read; both
 * can be asked twice with no consequence. Everything else — POST for inserts
 * and RPC, PATCH, DELETE — is sent once and its outcome reported, whatever
 * that costs the build.
 */
const IDEMPOTENT = new Set(["GET", "HEAD"]);

/**
 * Statuses worth asking again about.
 *
 * 520–527 are Cloudflare's own: 522 is the connection timeout that took the
 * 2026-09-03 build down, and it is emitted by the edge in front of Supabase
 * rather than by Postgres, so the request never reached the database and
 * repeating it is safe by construction.
 */
function isTransient(status: number): boolean {
  if (status === 429) return true;
  if (status >= 520 && status <= 527) return true;
  return status >= 500 && status <= 599;
}

/**
 * A network-layer failure, as opposed to a caller aborting on purpose.
 *
 * The distinction matters: React cancels in-flight work on a discarded render
 * and Next aborts on its own deadline, and retrying either would fight the
 * framework.
 *
 * An `AbortError` is NOT decidable from the error alone, and the first cut of
 * this file got that wrong in the one place it could least afford to. Our own
 * per-attempt deadline aborts through an `AbortController`, so a bounded hang
 * — the whole reason this module exists — arrives here as exactly the same
 * `DOMException` a cancelled render does, and rejecting it meant a hung
 * connection threw on the first attempt instead of being retried. The caller's
 * spec caught it.
 *
 * So the caller distinguishes the two by WHICH signal aborted, before asking
 * this; by the time this runs, an abort can only be someone else's.
 */
function isRetriableError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return false;
  return err instanceof Error;
}

function backoffFor(attempt: number): number {
  const base = BACKOFF_MS * 2 ** (attempt - 1);
  // Jitter, because 29 build workers failing together would otherwise retry
  // together and hand the recovering database a second thundering herd.
  return base + Math.floor(Math.random() * base);
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Honour `Retry-After` when the server sends one, clamped so a hostile or
 * mistaken value cannot park the build for a minute.
 */
function retryAfterMs(res: Response, fallback: number): number {
  const raw = res.headers.get("retry-after");
  if (!raw) return fallback;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return fallback;
  return Math.min(seconds * 1000, 5_000);
}

export type ResilientFetchOptions = {
  attempts?: number;
  perAttemptMs?: number;
  /** Injected in tests; defaults to the platform `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injected in tests so they do not actually wait. */
  sleepImpl?: (ms: number) => Promise<void>;
  /** Called once per swallowed failure. The build log is the only place this
   *  is visible, and a silent retry is how a slow database stays unnoticed. */
  onRetry?: (info: { attempt: number; reason: string; url: string }) => void;
};

/**
 * Build a `fetch` with the behaviour above. The Supabase client takes one via
 * `global.fetch`, so wrapping here reaches all 62 modules that construct a
 * public client without any of them knowing.
 */
export function createResilientFetch(
  options: ResilientFetchOptions = {},
): typeof fetch {
  const {
    attempts = ATTEMPTS,
    perAttemptMs = PER_ATTEMPT_MS,
    fetchImpl,
    sleepImpl = sleep,
    onRetry,
  } = options;

  return async function resilientFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const call = fetchImpl ?? fetch;
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    // A caller that already gave up. Nothing below should start work.
    if (init?.signal?.aborted) return call(input, init);

    const repeatable = IDEMPOTENT.has(method);
    const total = repeatable ? attempts : 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= total; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), perAttemptMs);
      // The caller's own signal still cancels us — its abort is forwarded, and
      // `isRetriableError` will not treat the result as retriable, so a
      // deliberate cancellation ends the loop rather than restarting it.
      const onCallerAbort = () => controller.abort();
      init?.signal?.addEventListener("abort", onCallerAbort, { once: true });

      try {
        const res = await call(input, { ...init, signal: controller.signal });
        if (attempt < total && isTransient(res.status)) {
          onRetry?.({ attempt, reason: `HTTP ${res.status}`, url });
          await sleepImpl(retryAfterMs(res, backoffFor(attempt)));
          continue;
        }
        return res;
      } catch (err) {
        lastError = err;
        const callerAborted = init?.signal?.aborted ?? false;
        // OUR deadline, not theirs. Both surface as an `AbortError`, and only
        // the signals tell them apart — see `isRetriableError`.
        const timedOut = controller.signal.aborted && !callerAborted;
        // The caller cancelled, or this was the last attempt, or the failure
        // is not one repeating can fix.
        if (
          callerAborted ||
          attempt === total ||
          (!timedOut && !isRetriableError(err))
        )
          throw err;
        onRetry?.({
          attempt,
          reason: timedOut
            ? `no response in ${perAttemptMs}ms`
            : ((err as Error).message ?? "network error"),
          url,
        });
        await sleepImpl(backoffFor(attempt));
      } finally {
        clearTimeout(timer);
        init?.signal?.removeEventListener("abort", onCallerAbort);
      }
    }

    // Unreachable while `total >= 1` — the loop either returns or throws on its
    // final pass. Kept so the function is total rather than relying on that.
    throw (
      lastError ?? new Error(`fetch failed after ${total} attempts: ${url}`)
    );
  } as typeof fetch;
}

/**
 * The instance the public client uses.
 *
 * One per process rather than one per `createSupabasePublicClient()` call —
 * 62 modules construct clients, several of them per render, and the wrapper
 * holds no per-request state.
 */
export const resilientFetch = createResilientFetch({
  onRetry: ({ attempt, reason, url }) => {
    // Deliberately `warn` and deliberately loud. The whole hazard of a retry
    // layer is that it converts a visible outage into a slow build nobody
    // investigates; this line is what keeps that legible in the deploy log.
    console.warn(
      `[supabase] attempt ${attempt} failed (${reason}), retrying: ${new URL(url).pathname}`,
    );
  },
});
