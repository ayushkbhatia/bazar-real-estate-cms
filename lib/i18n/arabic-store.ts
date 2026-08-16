/**
 * The generated Arabic, addressed by the English it translates.
 *
 * One store for the whole site, and that is the point rather than a
 * convenience. Because entries are keyed by the English string, "Submit" has
 * exactly one Arabic whether it appears on a master-page section, an area
 * guide, or a lead form — which is `messages.test.ts`'s strongest assertion
 * ("the same English must give the same Arabic") holding across content as well
 * as the catalogue.
 *
 * It also means a surface joins by calling `arabicFor` on strings it already
 * has, rather than by growing its own file, its own key scheme and its own
 * chance to disagree with the others.
 *
 * See `lib/master-pages/arabic.ts` for why the store is keyed by English rather
 * than by field, and why it is committed source rather than a database write.
 */
import store from "@/lib/master-pages/arabic/master.json";

export type ArabicValue = {
  ar: string;
  by: "machine" | "reviewed" | "human";
  model?: string;
  at?: string;
};

export type ArabicStore = Record<string, ArabicValue>;

export const ARABIC_STORE = store as ArabicStore;

/** The Arabic for a string, or null if nobody has translated it. */
export function arabicFor(
  english: string | null | undefined,
  from: ArabicStore = ARABIC_STORE,
): string | null {
  if (!english || !english.trim()) return null;
  return from[english.trim()]?.ar ?? null;
}
