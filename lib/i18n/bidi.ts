/**
 * Bidi isolation for Latin runs inside Arabic text.
 *
 * `docs/I18N.md:178` has instructed contributors to "use the helpers in
 * `lib/i18n/bidi` (from P3)" since P3. The module was never written. This is
 * it, built to that spec.
 *
 * ## What breaks without it
 *
 * The Unicode bidirectional algorithm classifies each character as strong LTR
 * (Latin letters), strong RTL (Arabic letters), or **neutral** (spaces,
 * punctuation, `+`, `-`, `/`, `·`, `²`). Neutrals take their direction from
 * whatever surrounds them. So in an Arabic paragraph:
 *
 * - `+971 50 123 4567` renders as `971 50 123 4567+` — the `+` is neutral,
 *   sees RTL on its left, and moves to the far end of the run.
 * - `BR-1042` renders as `1042-BR` — the hyphen is neutral and the two Latin
 *   runs get reordered around it.
 * - `AED 1,850/ft²` loses its trailing `ft²` to wherever the next strong
 *   character pulls it.
 *
 * None of this is a font problem or a translation problem, and none of it is
 * visible to an English-reading reviewer. It is the single most common way a
 * competent RTL page still looks broken to an Arabic reader.
 *
 * ## Two mechanisms, and when each applies
 *
 * **In the DOM, prefer CSS.** `app/globals.css:985` already isolates `.mono`
 * (`direction: ltr; unicode-bidi: isolate`), so a price or reference inside a
 * `.mono` span is already correct and needs nothing from this file. Reach for
 * `<span dir="ltr">` when the value is not `.mono`.
 *
 * **In plain text, use these.** A `<title>`, an `og:title`, a PDF string, feed
 * XML, a WhatsApp template — anywhere there is no element to hang a `dir` on,
 * the only tool is the isolate characters themselves.
 *
 * ## Isolates, never embeddings
 *
 * `LRI`/`RLI`/`FSI` … `PDI` (U+2066–U+2069) versus the deprecated
 * `LRE`/`RLE`/`LRO`/`RLO` … `PDF` (U+202A–U+202E): isolates make the enclosed
 * run opaque to the surrounding text, so a stray unterminated one cannot
 * reorder the rest of the document. Embeddings leak across boundaries, and an
 * unterminated `RLO` will silently reverse everything after it. The spec calls
 * them deprecated; `docs/I18N.md:183` says "never", and `assertNoLegacyMarks`
 * below is how that stops being a code-review question.
 */

/** U+2066 LEFT-TO-RIGHT ISOLATE. */
export const LRI = "⁦";
/** U+2067 RIGHT-TO-LEFT ISOLATE. */
export const RLI = "⁧";
/** U+2068 FIRST STRONG ISOLATE — direction taken from the first strong char. */
export const FSI = "⁨";
/** U+2069 POP DIRECTIONAL ISOLATE. Terminates any of the three above. */
export const PDI = "⁩";

/** The deprecated embedding/override marks. Never emit these. */
const LEGACY_MARKS = /[‪-‮]/;

/** Any isolate mark, for stripping before measurement or comparison. */
const ISOLATE_MARKS = /[⁦-⁩]/g;

/**
 * Wrap a Latin run so it renders left-to-right inside Arabic text.
 *
 * For values you know are Latin: prices, references, permit numbers, phone
 * numbers, areas, dates. Blank input returns blank rather than a pair of
 * invisible marks around nothing — an empty isolate is not harmful, but it
 * makes `length` lie and shows up in snapshot diffs.
 */
export function isolateLtr(value: string | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
  return text.length === 0 ? "" : `${LRI}${text}${PDI}`;
}

/**
 * Wrap a run whose direction you do not know, letting the first strong
 * character decide.
 *
 * This is the right choice for **user- or DB-supplied** values: an area name,
 * a developer, a person's name, a property title. Any of those may arrive in
 * either script — `areas.name` folds to Arabic on /ar and stays Latin when the
 * twin is blank — and `FSI` handles both without the caller having to detect
 * which it got.
 */
export function isolateAuto(value: string | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
  return text.length === 0 ? "" : `${FSI}${text}${PDI}`;
}

/**
 * Isolate only when the surrounding text is RTL.
 *
 * Under `en` the marks are invisible but not free: they travel into
 * `<title>` text, feed XML and PDF strings, where a downstream consumer may
 * not strip them. Passing the locale keeps English byte-identical, which is
 * the property every PR in this epic is held to while `LOCALES` is `["en"]`.
 */
export function isolateForLocale(
  value: string | null | undefined,
  locale: string,
): string {
  if (value == null) return "";
  const text = String(value);
  if (text.length === 0) return "";
  return locale === "ar" ? isolateAuto(text) : text;
}

/** Remove every isolate mark. For comparisons, lengths, and test assertions. */
export function stripIsolates(value: string): string {
  return value.replace(ISOLATE_MARKS, "");
}

/**
 * True if the string carries a deprecated embedding or override.
 *
 * Exported so `bidi.test.ts` can sweep the message catalogues: a translator
 * pasting from a tool that emits `RLE` would otherwise ship a mark that
 * reorders text after the string it appears in.
 */
export function hasLegacyMarks(value: string): boolean {
  return LEGACY_MARKS.test(value);
}
