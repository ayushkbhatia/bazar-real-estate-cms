/**
 * The words around the partner logo band, in one place.
 *
 * The band renders identically on the home page and on /about, and each page
 * owns its own copy of it — a section is a piece of a page, and giving two
 * pages one shared row would mean editing the home page's headline silently
 * rewrote /about's. What they share is the STARTING POINT, which is what this
 * is: the literals the component carried before either page could edit them.
 *
 * Kept out of `pages.ts` and `sections/about.ts` so the two cannot drift apart
 * before an editor has touched either — a copy-paste default is a promise that
 * the two pages start identical, and nothing was holding it.
 */
import type { SectionValues } from "../types";

export const PARTNER_BAND_DEFAULTS: SectionValues = {
  eyebrow: "Our Partner Ecosystem",
  heading: "The banks and regulators behind every deal.",
  body: "Direct relationships with the UAE's leading financial institutions and real-estate authorities.",
  cta_label: "All partners",
};
