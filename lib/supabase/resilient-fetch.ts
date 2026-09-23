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
 * and the route's prerender budget expires with the first attempt still open.
 * There is never a second attempt. So the load-bearing half of this file is
 * `PER_ATTEMPT_MS`, which turns an unbounded hang into a fast failure that a
 * retry can answer. The retry is the cheap half.
 *
 * THE BUDGET IS TIME, NOT ATTEMPTS
 *
 * This used to be "three attempts", then "four". Both were the wrong unit.
 * An attempt count only buys wall-clock time when every attempt hangs for its
 * full 10s; an outage that answers FAST — a Cloudflare 522 or 525 comes back
 * in a second or two — burned through all of them in a few seconds of backoff
 * (0.4s, 0.8s, 1.6s) and gave up long before the outage ended.
 *
 * That is exactly what 2026-09-23 looked like. The CI runners lost Supabase in
 * windows of 30s and more: some reads hung (`no response in 10000ms`), others
 * got an instant 522/525, and Supabase's own edge logs show most requests in
 * the window never arriving at all — no 429, no 5xx, Postgres idle. Retries
 * absorbed the bulk of it (86 first-attempt failures became 33 second, 8
 * third), but a build dies on its first read that runs out, and with a count
 * budget the fast-failing reads always ran out first.
 *
 * So a read now keeps trying until `BUDGET_MS` of wall-clock time is spent,
 * backing off exponentially to a cap, and no single attempt may run past the
 * budget. A hanging outage gets ~4 attempts; a fast-failing one gets as many
 * as fit. Either way the read outlasts a 30s window, and its worst case is the
 * budget itself.
 *
 * WHY 45 SECONDS
 *
 * The outer bound is Next's per-route prerender limit, which `next.config.ts`
 * sets to 180s (`staticPageGenerationTimeout`) precisely so a page can make
 * several SEQUENTIAL reads that each spend their retry budget. 45s leaves room
 * for four of them. An earlier version of this comment, and its spec, still
 * measured against Next's 60s default after the limit had been raised — the
 * spec now reads the configured number from `next.config.ts`, so the two
 * cannot drift apart again.
 *
 * WHAT IS NOT RETRIED
 *
 * Only idempotent methods. `.select()` — every public read on the site — is a
 * GET, and PostgREST reserves POST for writes and RPC. Retrying a POST because
 * the response never arrived risks applying it twice, and no amount of build
 * resilience is worth that.
 *
 * And only transient statuses: 5xx, the Cloudflare 52x family, and 429. A 401
 * or a 404 is an answer, and asking again is just slower.
 */

/** Per attempt. The number that makes a retry reachable at all. */
const PER_ATTEMPT_MS = 10_000;

/** Wall-clock budget for one read, every attempt and wait included. */
export const BUDGET_MS = 45_000;

/**
 * A hard cap on attempts, as a backstop to the time budget rather than the
 * thing that decides. Generous enough that a fast-failing outage is limited by
 * time, not by this.
 */
const MAX_ATTEMPTS = 12;

/** Base backoff; doubles per attempt up to the cap, and carries jitter. */
const BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 6_000;

/**
 * Don't start an attempt with less than this left. A retry that can only be
 * given a sliver of time is a wait with extra steps.
 */
const MIN_ATTEMPT_MS = 2_000;

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
  // Capped, so a long outage is probed every few seconds rather than once at
  // the very end of the budget.
  const base = Math.min(BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
  // Jitter, because 29 build workers failing together would otherwise retry
  // together and hand the recovering database a second thundering herd.
  return base + Math.floor((Math.random() * base) / 2);
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
  /** Hard cap on attempts; the time budget is what normally decides. */
  attempts?: number;
  perAttemptMs?: number;
  /** Wall-clock budget for one read, every attempt and wait included. */
  budgetMs?: number;
  /** Injected in tests; defaults to the platform `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injected in tests so they do not actually wait. */
  sleepImpl?: (ms: number) => Promise<void>;
  /** Injected in tests alongside `sleepImpl`, so waiting advances time. */
  nowImpl?: () => number;
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
    attempts = MAX_ATTEMPTS,
    perAttemptMs = PER_ATTEMPT_MS,
    budgetMs = BUDGET_MS,
    fetchImpl,
    sleepImpl = sleep,
    nowImpl = Date.now,
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
    const started = nowImpl();
    const spent = () => nowImpl() - started;
    // Whether, after waiting `ms`, a worthwhile attempt still fits.
    const roomAfter = (ms: number) => spent() + ms + MIN_ATTEMPT_MS <= budgetMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= total; attempt++) {
      const controller = new AbortController();
      // No attempt may run past the read's budget, so the budget is the worst
      // case — not the budget plus one more full attempt.
      const deadline = Math.max(1, Math.min(perAttemptMs, budgetMs - spent()));
      const timer = setTimeout(() => controller.abort(), deadline);
      // The caller's own signal still cancels us — its abort is forwarded, and
      // `isRetriableError` will not treat the result as retriable, so a
      // deliberate cancellation ends the loop rather than restarting it.
      const onCallerAbort = () => controller.abort();
      init?.signal?.addEventListener("abort", onCallerAbort, { once: true });

      try {
        const res = await call(input, { ...init, signal: controller.signal });
        if (attempt < total && isTransient(res.status)) {
          const wait = retryAfterMs(res, backoffFor(attempt));
          if (roomAfter(wait)) {
            onRetry?.({ attempt, reason: `HTTP ${res.status}`, url });
            await sleepImpl(wait);
            continue;
          }
        }
        // A success, an answer that is not transient, or a transient one with
        // no budget left to ask again — the caller gets it either way.
        return res;
      } catch (err) {
        lastError = err;
        const callerAborted = init?.signal?.aborted ?? false;
        // OUR deadline, not theirs. Both surface as an `AbortError`, and only
        // the signals tell them apart — see `isRetriableError`.
        const timedOut = controller.signal.aborted && !callerAborted;
        const wait = backoffFor(attempt);
        // The caller cancelled, this was the last attempt, the failure is not
        // one repeating can fix, or the budget has no room for another try.
        if (
          callerAborted ||
          attempt === total ||
          (!timedOut && !isRetriableError(err)) ||
          !roomAfter(wait)
        )
          throw err;
        onRetry?.({
          attempt,
          reason: timedOut
            ? `no response in ${deadline}ms`
            : ((err as Error).message ?? "network error"),
          url,
        });
        await sleepImpl(wait);
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
