/**
 * "3 min read", in the reader's language and grammar.
 *
 * ## Why this is not a template literal
 *
 * `${n} min read` is the shape G-14 (`no-hand-rolled-plurals.test.ts`) exists
 * to stop. English inflects nothing here, so the bug is invisible in English —
 * but Arabic counts a minute six different ways, and only the ICU message can
 * hold all six: `دقيقة` for one, the dual construct `دقيقتا` for two, `دقائق`
 * for three-to-ten, and back to the singular from eleven up.
 *
 * ## Why the digit is a placeholder and not ICU's `#`
 *
 * `#` is formatted with `Intl.NumberFormat(locale)`, and Arabic's default
 * numbering system is `arab` on most ICU builds — so `#` renders `٣` where
 * this site writes `3`. Western digits in both locales is a decision, not an
 * accident (ADR-0007; `lib/preferences/formatters.ts` pins `en-US` for the
 * same reason, and `unit-labels.ts` restates it). `formats.number` in
 * `lib/i18n/request.ts` cannot reach `#` — intl-messageformat formats it with
 * its own number formatter — so the only reliable fix is to keep the digit out
 * of ICU's hands and pass it in already written.
 *
 * `count` therefore selects the branch and `minutes` supplies the glyphs. Both
 * are required by every branch that shows a number; a translator who drops
 * `{minutes}` loses the figure, which is the one failure mode this shape adds
 * and the reason both messages carry a note in `messages/ar/_provenance.json`.
 */

/**
 * The shape of a next-intl translator bound to the `editorial` namespace,
 * narrowed to what this module calls. Structural rather than imported so both
 * `useTranslations` (client) and `getTranslations` (server) satisfy it.
 */
type EditorialTranslator = (
  key: "article.readMinutes" | "article.readMinutesShort",
  values: { count: number; minutes: string },
) => string;

/**
 * `short` is the card-eyebrow form — "3 min", where "read" is implied by the
 * chip sitting on an article card next to its category. The long form is for
 * the places that stand alone: the lead article's byline and the article
 * page's own header.
 */
export function readTime(
  t: EditorialTranslator,
  minutes: number,
  { short = false }: { short?: boolean } = {},
): string {
  return t(short ? "article.readMinutesShort" : "article.readMinutes", {
    count: minutes,
    minutes: String(minutes),
  });
}
