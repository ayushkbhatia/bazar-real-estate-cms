/**
 * The difference between "this row does not exist" and "I could not ask".
 *
 * ## The bug this exists to end
 *
 * Every by-slug read on this site was written the same way:
 *
 * ```ts
 * if (error) { console.error(...); return null }
 * if (!data) return null
 * ```
 *
 * and every page that consumes one was written the other same way:
 *
 * ```ts
 * const article = await getPublishedArticleBySlug(slug)
 * if (!article) notFound()
 * ```
 *
 * Read together, those two lines say: *a database blip is a 404*. And a 404
 * out of a route with `revalidate` set is not a transient answer — Next caches
 * it and serves it, from the edge, to every visitor and every crawler until
 * the window expires. One failed request becomes five minutes of "page does
 * not exist" for a page that does.
 *
 * Measured on production 2026-09-09: 22 of 32 broken links found by crawling
 * `/ar` were this — 17 articles and 5 projects, all 404, all serving 200 again
 * the moment something touched them a second time. It is worse than it sounds,
 * because every production deploy resets the ISR cache, so after each deploy
 * every non-prerendered page is cold and one blip per page is enough.
 *
 * `lib/supabase/resilient-fetch.ts` already absorbs the blips it can — three
 * bounded attempts, transient statuses only. This is the other half: when all
 * three attempts fail, the caller must not answer a question it could not ask.
 *
 * ## What to do instead
 *
 * Throw. A thrown error renders `error.tsx` as a 500, and **a 500 is not
 * cached** — the next request re-renders and, on a blip, succeeds. The visitor
 * sees a retryable error instead of a confident lie, and the URL keeps its
 * place in the index.
 *
 * ```ts
 * if (error) throw new SupabaseReadError("getPublishedArticleBySlug", error)
 * if (!data) return null   // genuinely absent — `notFound()` is correct here
 * ```
 *
 * ## Where this does NOT belong
 *
 * Reads with a fallback. `getAgentBySlug` drops to `SEED_AGENTS`,
 * `getAreaProfile` composes from a seed guide, `findDirectoryEntry` returns
 * the code-owned entry — those already answer without the database and should
 * keep doing so. And list reads that render a section: an empty band on an
 * otherwise-fine page is a better outcome than a 500 for the whole page.
 *
 * The rule is narrow on purpose: **only where `null` becomes `notFound()`.**
 */

/** The shape Supabase returns in `error`. Structural, so tests need no client. */
type ReadError = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

/**
 * A read that failed, as opposed to a row that is not there.
 *
 * Carries the scope so the server log names the query without the call site
 * having to `console.error` separately — Next logs the thrown error already,
 * and two lines per failure is one more than anyone reads.
 */
export class SupabaseReadError extends Error {
  readonly scope: string;
  readonly code: string | undefined;

  constructor(scope: string, error: unknown) {
    const e = (error ?? {}) as ReadError;
    super(
      `[${scope}] Supabase read failed: ${e.message ?? "unknown error"}${
        e.code ? ` (${e.code})` : ""
      }`,
    );
    this.name = "SupabaseReadError";
    this.scope = scope;
    this.code = e.code;
    this.cause = error;
  }
}

/**
 * Throw when a read that backs a `notFound()` failed.
 *
 * A `never` return so it can be the whole of an `if (error)` branch and still
 * narrow `data` for the code below it.
 */
export function readFailed(scope: string, error: unknown): never {
  throw new SupabaseReadError(scope, error);
}
