/**
 * Generated Arabic for the section registries, held as data beside the code.
 *
 * ## Why the Arabic lives here and not in the database
 *
 * Keeping it in source rather than writing it to production buys four things:
 * it is reviewed as a diff before it is live, by someone who can compare it to
 * the English on the line above; `git revert` undoes a bad run; CI can check it
 * with no credentials, so a content gate cannot redden `main` with no commit
 * behind it; and production never calls a model to render Arabic, so the client
 * can leave `ANTHROPIC_API_KEY` unset forever (`lib/i18n/no-runtime-mt.test.ts`
 * enforces that).
 *
 * ## Why it is keyed by the ENGLISH, not by the field
 *
 * This is the correction that matters, and it was found by measurement rather
 * than by reasoning.
 *
 * The first version keyed entries by `page.section.pathKey` and folded them
 * into `def.defaults`. That is wrong on a live site, and quietly. `mergeValues`
 * takes the editor's stored English and — finding no stored `title_ar` — falls
 * back to the DEFAULT `title_ar`. So a page whose headline an editor had
 * rewritten rendered their new English beside Arabic generated from the old
 * one. Measured against production: **303 of the master-page slots had been
 * edited**, including `/home`'s hero, where the default reads "Find a home
 * worth keeping." and the live page reads "Your Future Has an Address".
 *
 * Keying by the English fixes it structurally rather than by adding a check.
 * The Arabic applies wherever that exact English appears — registry default or
 * editor's text, it makes no difference — and an edited headline simply finds
 * no entry and falls back to English, which is the designed behaviour and the
 * safe direction.
 *
 * It also makes staleness automatic. There is no `src_hash` to compare and no
 * moment at which the pair can drift apart, because the English IS the key.
 *
 * The cost is that one English string has exactly one Arabic across the whole
 * site. That is not a compromise — it is `messages.test.ts`'s strongest
 * assertion ("the same English must give the same Arabic"), applied to content.
 * Seventeen entries collapsed when the store was converted, and every one of
 * them was a case of the same phrase translated two different ways.
 */
import { walkSection, applySlots } from "@/lib/i18n/mt/bag";
import type { FieldDef, SectionValues } from "./types";
import store from "./arabic/master.json";

export type ArabicValue = {
  ar: string;
  by: "machine" | "reviewed" | "human";
  model?: string;
  at?: string;
};

/** English → Arabic. */
export type ArabicStore = Record<string, ArabicValue>;

export const ARABIC_STORE = store as ArabicStore;

/**
 * Fill in any Arabic twin that is still blank, from the store.
 *
 * Runs on MERGED values, so it sees exactly the English the page will render —
 * whether that came from the registry or from the CMS.
 *
 * Never overwrites: a twin that already has a value was written by an editor
 * or hand-declared in the registry, and both outrank this.
 */
export function fillArabic(
  fields: FieldDef[],
  values: SectionValues,
  from: ArabicStore = ARABIC_STORE,
): SectionValues {
  const slots = walkSection({
    fields,
    values,
    docKey: "registry",
    sectionKey: "merged",
  }).filter((s) => !s.arabic);
  if (slots.length === 0) return values;

  const results = new Map<string, string>();
  for (const slot of slots) {
    const entry = from[slot.english.trim()];
    if (entry) results.set(slot.pathKey, entry.ar);
  }
  return results.size === 0 ? values : applySlots(values, slots, results);
}
