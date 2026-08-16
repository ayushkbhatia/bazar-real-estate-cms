/**
 * Generated Arabic for the section registries, held as data beside the code.
 *
 * ## Why the Arabic lives here and not in the database
 *
 * `mergeValues` falls back field by field to `def.defaults`, and it iterates
 * `withArabicTwinsDeep`, so a `title_ar` sitting in a section's `defaults`
 * renders with no migration and no database write. That is not a trick — it is
 * how the client's own twelve Arabic strings already ship, as literals in
 * `sections/contact-qr.ts`.
 *
 * Keeping the generated Arabic in source rather than writing it to production
 * buys four things that matter more than they sound:
 *
 *   - it is reviewed as a diff, before it is live, by someone who can compare
 *     it to the English on the line above;
 *   - `git revert` undoes a bad run, rather than a restore;
 *   - CI can check it with no credentials, so a content gate cannot redden
 *     `main` with no commit behind it — the failure ADR-0007 warns about;
 *   - and production never calls a model to render Arabic, so the client can
 *     leave `ANTHROPIC_API_KEY` unset forever. `lib/i18n/no-runtime-mt.test.ts`
 *     enforces that.
 *
 * The client's own edits still win: a stored value beats a default, so the
 * moment an editor touches a field in the CMS their text is permanent and this
 * file stops applying to it.
 *
 * ## Why it is JSON and not more TypeScript
 *
 * Because it is generated, and generated content should not be interleaved
 * with hand-written declarations. A reviewer opening `master.json` is looking
 * at one thing — machine output — rather than trying to spot it inside a
 * registry. It also means the generator writes a data file rather than
 * performing surgery on a 1500-line source file.
 *
 * ## Shape
 *
 * Keyed by page, then section, then the English slot's `pathKey` from
 * `lib/i18n/mt/bag.ts`. Each entry carries the English it was made from:
 *
 *     { "home": { "hero": { "title": { "en": "…", "ar": "…", "by": "machine" } } } }
 *
 * The English is stored rather than a hash of it, for two reasons. A reviewer
 * reading the diff sees the pair side by side, which is the only way anyone
 * without Arabic can review this at all. And a hash would mean importing
 * `hashSource` from `lib/i18n/mt/translate.ts`, which imports the Anthropic
 * SDK — pulling a model client into the module graph of every public page, and
 * failing `lib/i18n/no-runtime-mt.test.ts` for a real reason.
 *
 * It is also what makes staleness detectable: when an editor changes the
 * English headline six weeks from now, the stored `en` stops matching and the
 * Arabic beneath it stops being applied.
 */
import { walkSection, applySlots } from "@/lib/i18n/mt/bag";
import type { MasterPageDef, SectionDef } from "./types";
import store from "./arabic/master.json";

export type ArabicValue = {
  /** The English this was produced from. Staleness is a string compare. */
  en: string;
  ar: string;
  by: "machine" | "reviewed" | "human";
  model?: string;
  at?: string;
};

/** page → section → pathKey → value. */
export type ArabicStore = Record<
  string,
  Record<string, Record<string, ArabicValue>>
>;

export const ARABIC_STORE = store as ArabicStore;

/**
 * Merge the stored Arabic into one section's defaults.
 *
 * Stale entries are skipped rather than applied: if the English has been edited
 * since the Arabic was made, `src` no longer matches and the section falls back
 * to English for that field. That is the safe direction — an untranslated field
 * renders complete, a *wrongly* translated one makes a claim the English does
 * not.
 */
export function applyArabic(
  section: SectionDef,
  entries: Record<string, ArabicValue> | undefined,
): SectionDef {
  if (!entries || Object.keys(entries).length === 0) return section;

  const slots = walkSection({
    fields: section.fields,
    values: section.defaults,
    docKey: "registry",
    sectionKey: section.key,
  });

  const results = new Map<string, string>();
  for (const slot of slots) {
    const entry = entries[slot.pathKey];
    if (!entry) continue;
    if (entry.en.trim() !== slot.english.trim()) continue;
    results.set(slot.pathKey, entry.ar);
  }
  if (results.size === 0) return section;

  return { ...section, defaults: applySlots(section.defaults, slots, results) };
}

/** The registry, with generated Arabic folded into every section's defaults. */
export function withArabicDefaults(
  pages: MasterPageDef[],
  storeOverride: ArabicStore = ARABIC_STORE,
): MasterPageDef[] {
  return pages.map((page) => {
    const forPage = storeOverride[page.key];
    if (!forPage) return page;
    return {
      ...page,
      sections: page.sections.map((s) => applyArabic(s, forPage[s.key])),
    };
  });
}
