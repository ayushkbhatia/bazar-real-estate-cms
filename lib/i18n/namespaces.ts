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
] as const satisfies readonly Namespace[];

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
