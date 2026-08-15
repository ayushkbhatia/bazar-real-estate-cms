/**
 * Which message namespaces exist, and which of them cross to the browser.
 *
 * Two lists rather than one, because they answer different questions and only
 * one of them costs bytes on every page.
 *
 * `NAMESPACES` is what gets loaded server-side. It lived in `request.ts` as a
 * hardcoded array while `messages.test.ts` discovered namespaces by reading the
 * directory — so adding `messages/en/tools.json` passed every test and was
 * invisible to the app, and the visitor saw the literal string `tools.heading`
 * on the page. `namespaces.test.ts` now asserts the two agree.
 *
 * `CLIENT_NAMESPACES` is the subset serialised into the RSC payload. This is
 * the list that matters at scale: `NextIntlClientProvider` mounted without a
 * `messages` prop resolves to next-intl's RSC variant, which calls
 * `getMessages()` and ships the *entire* merged catalogue into the flight
 * payload of every route. At 39 keys that is 1.5 KB and invisible. The message
 * waves take the catalogue to ~2,600 keys, where the same code path is
 * plausibly 150–400 KB on every one of 78 prerendered routes — against a
 * Lighthouse performance floor already softened to 0.65 for noise, and no
 * bundle-size gate anywhere.
 *
 * The public tree is 184 server components to 86 client ones, so most
 * extraction should reach for `getTranslations` and never widen this list.
 * Adding a namespace here is a deliberate act with a measurable cost.
 */

/** Every namespace file under `messages/<locale>/`. Pinned by the test. */
export const NAMESPACES = [
  "common",
  "nav",
  "footer",
  "consent",
  "listing",
  "search",
  "property",
  "development",
  "area",
  "editorial",
  "tools",
  "forms",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/**
 * Namespaces shipped to the browser, because a Client Component reads them.
 *
 * Keep this as small as the truth allows. `namespaces.test.ts` fails if a
 * `"use client"` file calls `useTranslations("x")` for an `x` that is not
 * here — which would otherwise render the raw key path in production and
 * throw nothing, since `request.ts` sets `getMessageFallback` to the dotted
 * key and only logs in development.
 *
 * `common` is read by the preferences controls, `consent` by the cookie banner.
 * `nav`, `footer` and `listing` stay off this list on purpose: their consumers
 * are server components, or belong to `components/brand/`.
 */
export const CLIENT_NAMESPACES = [
  "common",
  // The cookie banner is a Client Component by nature — it reads and writes a
  // cookie, and it is the first thing a visitor touches. There is no
  // server-rendered variant to move it to, so this one genuinely has to cross.
  "consent",
  // The mega-nav owns the mobile drawer's open/closed state, so it cannot be a
  // Server Component. Five keys, all of them accessible names.
  "nav",
  // ListingCard renders from three Client Components (area-text,
  // listing-card-priced, similar-card), so it cannot be async and its
  // namespace has to cross. `footer` is the only one that stays server-only —
  // the saving from #366 comes from the namespaces the waves ADD, which are
  // overwhelmingly server-side.
  "listing",
  // The filter bar and hero search own their own state — dropdowns, chips,
  // a debounced query box. Client by necessity.
  "search",
  // Gallery lightbox and price block are interactive; the page itself is a
  // Server Component and reads the same namespace through getTranslations.
  "property",
  // The units table filters client-side and the payment plan is interactive.
  "development",
  // The market-report hero and its comparables table are Client Components
  // (they format money and areas in the visitor's units), so this has to
  // cross. It used to say "article-actions and the article table of contents"
  // — both of which are real files that `insights/[slug]/page.tsx` has never
  // imported, so the stated reason was wrong even though the conclusion held.
  // See `lib/dead-code.test.ts`.
  "editorial",
  /*
   * The public lead forms, and the one namespace here that is global because
   * of *where its components render* rather than what they are.
   *
   * `tools/valuation/_components/lead-gate.tsx` lives under `/tools`, which
   * would make it a candidate for the route-scoped `tools` bag — and it is
   * mounted on `/areas/[slug]`, `/p/[slug]`, the developments floor-plan gate
   * and the shared CTA banner, none of which mount that bag. A route-scoped
   * namespace is scoped by the URL the component renders under, not by the
   * folder it happens to sit in.
   *
   * W7 fills this out with the public zod messages and toasts, which have the
   * same property: they surface wherever a form does.
   */
  "forms",
] as const satisfies readonly Namespace[];

/**
 * Namespaces that cross to the browser on some routes but not on all of them.
 *
 * `CLIENT_NAMESPACES` is paid for on all 78 prerendered routes. That is a fair
 * price for `nav` at five keys and the wrong one for `tools` at ~400: the
 * mortgage calculator's copy would ride along on the home page, on every
 * article and on every listing, and be read on four routes.
 *
 * A namespace listed here is mounted by `<RouteMessages>` in the layout of the
 * segments named beside it, and is invisible everywhere else. The value is the
 * set of path prefixes allowed to read it — checked from both ends by
 * `namespaces.test.ts`:
 *
 *  - a `"use client"` file OUTSIDE those prefixes may not read the namespace,
 *    because nothing would have mounted it and every key would render as its
 *    own dotted path;
 *  - and every prefix must contain a layout that actually mounts it, because a
 *    route-scoped provider you forgot to mount fails in exactly the same
 *    silent way.
 *
 * The second half is the one worth having. The first is a rule you would
 * probably notice in review; the second is `request.ts`'s hardcoded
 * `NAMESPACES` array all over again — a list that has to agree with something
 * else and has no mechanism forcing it to.
 */
export const ROUTE_NAMESPACES = {
  tools: [
    "app/[locale]/(public)/tools/",
    "app/[locale]/(public)/concierge/",
  ],
} as const satisfies Partial<Record<Namespace, readonly string[]>>;

export type RouteNamespace = keyof typeof ROUTE_NAMESPACES;

/** Narrow a full message bag to the namespaces the client actually needs. */
export function pickClientMessages(
  messages: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const ns of CLIENT_NAMESPACES) {
    if (ns in messages) out[ns] = messages[ns];
  }
  return out;
}

/**
 * Keys whose Arabic is legitimately the English, byte for byte.
 *
 * `messages.test.ts` allows these past its "no Arabic value is identical to
 * its English" rule, and the catalogue translator must skip them for the same
 * reason — otherwise every run tries to translate them again, and any Arabic
 * it invented would then fail the test that permits them.
 *
 * A language switch labels each option in its OWN language, which is the whole
 * convention: `English` stays `English` under Arabic, `العربية` stays
 * `العربية` under English. Anything else makes the control unusable for the
 * person who needs it most — someone who cannot read the current locale.
 */
export const IDENTICAL_BY_DESIGN: ReadonlySet<string> = new Set([
  "common.languageEnglish",
  "common.languageArabic",
]);
