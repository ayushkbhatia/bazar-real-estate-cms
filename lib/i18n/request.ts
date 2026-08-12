import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isEnabledLocale, type Locale } from "./locales";

/**
 * next-intl request config — the messages half only.
 *
 * We deliberately do NOT use next-intl's middleware or its navigation APIs.
 * `proxy.ts` already resolves the locale and rewrites unprefixed paths to
 * `/en/*`, and that behaviour was measured (the P1 spike proved the rewrite
 * serves the prerendered artifact with `x-nextjs-cache: HIT` rather than
 * bypassing ISR). Handing routing to a second system would put two things in
 * charge of the same decision.
 *
 * What next-intl is here for is the part that is genuinely hard to hand-roll:
 * ICU message formatting, and Arabic's six plural categories. A hand-written
 * `t()` gets "N bedrooms" wrong on the highest-traffic surfaces on the site,
 * and no English-reading reviewer would ever catch it.
 *
 * Namespaces are separate files so a translator can be handed one surface at a
 * time, and merged here because next-intl wants one object per locale.
 */
const NAMESPACES = ["common", "nav", "footer", "consent", "listing"] as const;

async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const mod = await import(`../../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isEnabledLocale(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    messages: await loadMessages(locale),
    // Pinned rather than derived from the locale. Arabic numerals are a brand
    // decision (ADR-0007: Western digits, matching Bayut and the way DLD/RERA
    // reference numbers are typeset), and `ar` would otherwise format numbers
    // with Eastern Arabic-Indic digits on some ICU builds.
    formats: {
      number: { default: { useGrouping: true } },
    },
    onError(error) {
      // A missing message must not take a page down. In production it renders
      // the key path, which is ugly but legible; in development it should be
      // loud, because that is when it is cheap to fix.
      if (process.env.NODE_ENV === "development") console.error(error);
    },
    getMessageFallback({ namespace, key }) {
      return [namespace, key].filter(Boolean).join(".");
    },
  };
});
