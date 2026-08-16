/**
 * Does this string look like language, or like data wearing a text field?
 *
 * A `text` field gets an Arabic twin by default (`lib/master-pages/twins.ts`),
 * and that default is right: a forgotten opt-out costs one unused input in the
 * editor, a forgotten opt-in costs a permanent hole on the Arabic site. But it
 * means the registry is full of `text` fields holding things that are not
 * prose — a lucide icon name, an area slug, a lead-routing tag, `09:00` — and
 * a generator pointed at those produces confident nonsense.
 *
 * The dangerous ones are dangerous precisely because **an Arabic proofreader
 * cannot find them.** Fold `slug` into Arabic and the area resolves to nothing
 * and the card vanishes; the Arabic on the page reads perfectly. It surfaces
 * weeks later as "the communities grid is empty on the Arabic site".
 *
 * So this is the audit instrument, not the enforcement. It is deliberately a
 * *heuristic over real default values* rather than a rule over key names,
 * because the key name lies in both directions:
 *
 *   - `sell/pricing.range_low` sounds numeric and holds `"Low"` — a label.
 *   - `contact/help.items[].icon` sounds harmless and holds `"home"`.
 *
 * And the single most important thing it taught us: **`stats[].value` cannot be
 * opted out.** The same field definition holds `"78%"` on `/off-plan` and
 * `"Homes + offices"` on `/rent`. Marking the shared `statList()` builder
 * `i18n: false` — which the content plan called for — would have stranded eight
 * visible strings in English on the highest-traffic landing pages. Numeric stat
 * values are protected by masking at generation time, not by an opt-out here.
 */

/** Arabic block, used to tell "no lowercase" apart from "not Latin at all". */
const ARABIC = /[؀-ۿ]/;

/**
 * A reason this value is not prose, or `null` if it reads like language.
 *
 * Ordered most-specific first so the reason returned is the informative one.
 */
export function nonProseReason(value: string): string | null {
  const s = value.trim();
  if (!s) return null;

  if (/^\+?\d[\d\s()\-]{6,}$/.test(s)) return "phone number";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "email address";
  if (/^\d{1,2}:\d{2}$/.test(s)) return "clock time";
  if (/^[\d.,+%/·\-–—:]+$/.test(s)) return "digits and punctuation only";
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(s)) return "slug / kebab token";
  if (/^(left|right|center|centre|start|end|top|bottom)$/i.test(s)) {
    return "layout token";
  }
  if (!/\s/.test(s) && s.length <= 2) return "shorter than a word";
  if (!/[a-z]/.test(s) && !ARABIC.test(s) && s.length <= 8) {
    return "no lowercase — acronym or code";
  }
  return null;
}
