import { expect } from "vitest";
import { DEFAULT_LOCALE, type Locale } from "./locales";

/**
 * Assertions that prove a read path actually folds.
 *
 * Every fold in this codebase is three lines that are trivially easy to write
 * and impossible to eyeball: select the twin, resolve the locale, call
 * `localiseRow`. Get the *order* wrong — apply the fold after a shaping
 * function has already built its explicit object literal — and the code reads
 * correctly, type-checks, and does nothing at all. PR #341 shipped exactly
 * that.
 *
 * Before this file, the only `_ar`-leak assertions in the repo were two lines
 * in `localise.test.ts` testing the helper against a hand-built object. Nothing
 * asserted the invariant on the output of a query module, which is the only
 * place it can actually be violated. A no-op fold shipped green and adding the
 * column to `WIRED_READ` was self-certification.
 *
 * These helpers are deliberately about *observable output*, not about which
 * line the fold sits on. A reader that returns the Arabic value under "ar" and
 * the English one under "en", with no `_ar` key anywhere in between, is
 * correct however it got there.
 */

/**
 * Invariant 1: a folded value never carries `_ar` keys onward.
 *
 * A leak is not cosmetic. `compare.ts` spreads its raw row into a payload that
 * `app/api/shortlist/route.ts` serialises to the browser, so a leaked twin is
 * shipped over the wire to every visitor — in English, today.
 */
export function expectNoTwinsLeak(value: unknown, what = "output"): void {
  const json = JSON.stringify(value ?? null);
  const hit = json.match(/"[^"]*_ar"\s*:/);
  expect(
    hit?.[0] ?? null,
    `${what} leaked an Arabic twin key: ${hit?.[0]}`,
  ).toBeNull();
}

/**
 * Invariant 2: the base key carries the Arabic under "ar" and the English
 * under "en".
 *
 * `read` is called once per locale rather than once, because the two failure
 * modes are opposite and a single call catches only one of them: a fold that
 * never fires returns English under "ar"; a fold applied unconditionally
 * returns Arabic under "en" and breaks the live site.
 */
export async function expectFolds<T>(opts: {
  /** Runs the real reader at a given locale. */
  read: (locale: Locale) => Promise<T> | T;
  /** Pulls the one field under test out of the reader's result. */
  pick: (result: T) => unknown;
  /** What the English column holds in the fixture. */
  english: unknown;
  /** What the Arabic twin holds in the fixture. */
  arabic: unknown;
  /** Names the column, so a failure says which one. */
  what: string;
}): Promise<void> {
  const { read, pick, english, arabic, what } = opts;

  const en = await read(DEFAULT_LOCALE);
  expect(pick(en), `${what}: English locale must be untouched`).toEqual(
    english,
  );
  expectNoTwinsLeak(en, `${what} (en)`);

  const ar = await read("ar" as Locale);
  expect(
    pick(ar),
    `${what}: Arabic locale still returned the English value — the fold is a ` +
      `no-op, most likely applied downstream of a shaping function`,
  ).toEqual(arabic);
  expectNoTwinsLeak(ar, `${what} (ar)`);
}

/**
 * Invariant 3: a blank twin leaves the English in place rather than rendering
 * an empty string.
 *
 * The product decision behind this is in ADR-0007: missing Arabic falls back
 * per field, in place. Never hide, never blank.
 */
export async function expectBlankTwinFallsBack<T>(opts: {
  read: (locale: Locale) => Promise<T> | T;
  pick: (result: T) => unknown;
  english: unknown;
  what: string;
}): Promise<void> {
  const ar = await opts.read("ar" as Locale);
  expect(
    opts.pick(ar),
    `${opts.what}: a blank twin must leave the English showing, not blank the field`,
  ).toEqual(opts.english);
  expectNoTwinsLeak(ar, `${opts.what} (ar, blank twin)`);
}

/**
 * A chainable stand-in for the PostgREST query builder.
 *
 * Every reader under test builds its query differently — `.eq().order().limit()`,
 * `.in()`, `.not()`, `.or()`, `.maybeSingle()` — and each one that a mock
 * forgets is a `TypeError` rather than a useful failure. This returns the same
 * object from every method and resolves to `{ data, error }` when awaited, so
 * the shape of the chain stops mattering.
 *
 * `calls.select` records the select string, which is how a spec asserts the
 * twin columns were actually requested — a fold is equally dead if the column
 * never left the database.
 */
export function queryStub(data: unknown, error: unknown = null) {
  const calls: { select: string[]; from: string[] } = { select: [], from: [] };

  const builder: Record<string, unknown> = {};
  const chain = new Proxy(builder, {
    get(_t, prop: string) {
      if (prop === "then")
        return (res: (v: unknown) => unknown) =>
          Promise.resolve({ data, error }).then(res);
      if (prop === "select")
        return (s?: string) => {
          if (typeof s === "string") calls.select.push(s);
          return chain;
        };
      // `maybeSingle`/`single` end the chain in the same shape.
      return (..._args: unknown[]) => chain;
    },
  });

  return {
    calls,
    client: {
      from: (table: string) => {
        calls.from.push(table);
        return chain;
      },
    },
  };
}
