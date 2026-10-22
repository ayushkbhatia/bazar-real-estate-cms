import type { SupabaseClient } from "@supabase/supabase-js";
import { parseStoredSections, resolveSections } from "@/lib/master-pages";
import { catalogueArabic, catalogueEnglish, wizardPageDef, wizardSlug } from "@/lib/master-pages/wizards";

export type ConsentLocale = "en" | "ar";

const KEY = "consent.label";

/**
 * The consent sentence W5, W6 and the invite showed, in the language they
 * were read in: the Wizards editor's wording when one is saved (Pages &
 * blocks → Wizards → Mortgage application → Documents), else the catalogue's.
 *
 * The record has to say what the page said (consent.ts), and the page reads
 * this sentence through the editor's overlay — so looking it up by version
 * alone stored the shipped wording under an applicant who had read the one
 * Bazar wrote (20 Oct 2026), and would have stored English under one who had
 * read Arabic. Pure: the stored document in, the sentence out.
 */
export function consentWordingFrom(blocks: unknown, locale: ConsentLocale): string {
  const catalogue = (locale === "ar" ? catalogueArabic(KEY) : undefined) ?? catalogueEnglish(KEY)!;
  const stored = parseStoredSections(blocks);
  if (!stored) return catalogue;
  const sections = resolveSections(wizardPageDef("mortgage-application"), stored, locale);
  for (const section of sections) {
    const value = section.values[KEY];
    if (typeof value === "string" && value.trim()) return value;
  }
  return catalogue;
}

/**
 * The same, read from the database at submit time (service role). A read that
 * fails gives the catalogue's sentence: the submission still goes, and the
 * failure is the only case where the record can differ from the page.
 */
export async function consentWordingShown(db: SupabaseClient, locale: ConsentLocale): Promise<string> {
  try {
    const { data, error } = await db
      .from("pages")
      .select("blocks")
      .eq("slug", wizardSlug("mortgage-application"))
      .maybeSingle();
    return consentWordingFrom(error ? null : (data?.blocks ?? null), locale);
  } catch {
    return consentWordingFrom(null, locale);
  }
}
