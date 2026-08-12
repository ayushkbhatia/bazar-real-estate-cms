import { LOCALES } from "./locales";

/**
 * Multiply a segment's static params across every served locale.
 *
 * Ordinary **pages** do not need this. Next runs a child `generateStaticParams`
 * once per set of params the parent produced and merges the two, so a page
 * under `app/[locale]/` that returns `{ slug }` gets `{ locale, slug }` for
 * free — verified in the P1 build: `/en/areas/adgm` prerenders with no change
 * to the page's own `generateStaticParams`.
 *
 * **Metadata image routes do not compose that way.** After the P1 move the
 * three `opengraph-image.tsx` routes stopped prerendering any concrete paths
 * (240 prerendered paths dropped to 189 — the missing ~51 were all OG images)
 * while still reporting as SSG, because their params no longer covered every
 * dynamic segment in the route. Nothing errored; the cards would simply have
 * been generated on first request instead of at build.
 *
 * So: use this in `opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx` and any
 * other metadata file convention under a localised route. Pages should not use
 * it — doing so would duplicate what the router already does.
 */
export function withLocales<T extends Record<string, string>>(
  params: T[],
): (T & { locale: string })[] {
  return LOCALES.flatMap((locale) => params.map((p) => ({ ...p, locale })));
}
