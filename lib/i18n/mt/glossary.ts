/**
 * Binding vocabulary. In code, so changing it is a reviewable diff.
 *
 * Most of this is house style. A handful of entries are not style at all —
 * they are the difference between describing one legal instrument and
 * describing a different one, and a fluent translation that picks the wrong
 * word is worse than an awkward one that picks the right word, because nobody
 * reviewing it will notice anything is off.
 *
 * The load-bearing case is tenure. Rendering "leasehold" as إيجار calls a
 * long-dated usufruct a rental agreement, which misstates what the buyer is
 * acquiring. Same class of problem for freehold, off-plan and escrow: each has
 * a settled term in UAE property practice and a plausible-sounding wrong one.
 *
 * Matching caveat, stated because it shapes what this can enforce: Arabic
 * inflects and takes the ال- prefix, so a check for an exact string produces
 * false positives on correct output. Each entry therefore carries a `stem`
 * that survives inflection, and validation asks two questions — did a known
 * wrong rendering appear, and is the right one absent entirely. That catches
 * the failures that matter and stays quiet on ordinary grammatical variation.
 */

export type GlossaryEntry = {
  /** English term, matched case-insensitively on a word boundary. */
  en: string;
  /** Preferred Arabic rendering, used in the prompt. */
  ar: string;
  /** Substring of `ar` that survives ال- prefixing and inflection. */
  stem: string;
  /**
   * Further stems that are also correct, for terms whose plural is *broken*.
   *
   * The docblock above promises a stem that "survives inflection", and for a
   * sound plural it does: مطور is still there in المطورين, إعلان in إعلانات.
   * An Arabic broken plural changes the consonant skeleton instead, so the
   * singular stem is simply absent from a perfectly correct sentence — شقة
   * does not appear in الشقق, nor فيلا in الفلل, nor وسيط in الوسطاء.
   *
   * Measured, not theorised: `"Median apartment prices…"` came back as
   * `"بلغت أسعار الشقق المتوسطة…"` — correct Arabic — and was rejected, so the
   * block kept its English. Two of eleven blocks in one article were lost that
   * way before this existed.
   *
   * These only ever WIDEN what is accepted. A wrong rendering is still caught
   * by `forbidden`, which is the half of the check that rejects.
   */
  alsoStems?: string[];
  /** Renderings that are wrong here, even where they are valid Arabic. */
  forbidden?: string[];
  /** Why, when the reason is not obvious. Shown to a reviewer, not the model. */
  note?: string;
};

export const GLOSSARY: GlossaryEntry[] = [
  // ── Tenure and title. The regulatory core. ────────────────────────────────
  {
    en: "freehold",
    ar: "تملك حر",
    stem: "تملك حر",
    forbidden: ["ملكية مطلقة"],
    note: "Settled term in UAE practice; ملكية مطلقة reads as absolute ownership in the abstract.",
  },
  {
    en: "leasehold",
    ar: "حق انتفاع",
    stem: "انتفاع",
    forbidden: ["إيجار", "ايجار", "استئجار"],
    note: "Not a rental. إيجار describes a tenancy and materially misstates what is being sold.",
  },
  {
    en: "usufruct",
    ar: "حق انتفاع",
    stem: "انتفاع",
    note:
      "Deliberately the same rendering as `leasehold`, which is fine in prose " +
      "and NOT fine in a table: /tools/compare puts the two tenure values in " +
      "the same column, where they now read identically. Splitting them is a " +
      "legal-terminology question for the client's compliance contact, not a " +
      "translation one — see ADR-0007's open question 1.",
  },
  {
    en: "musataha",
    ar: "حق مساطحة",
    stem: "مساطحة",
    note: "A distinct right from usufruct — the right to build. Never merge the two.",
  },
  {
    en: "title deed",
    ar: "سند الملكية",
    stem: "سند الملكية",
    alsoStems: ["سندات الملكية", "سند ملكية"],
  },
  {
    en: "off-plan",
    ar: "على الخارطة",
    stem: "الخارطة",
    forbidden: ["خارج الخطة"],
    note: "خارج الخطة is a literal calque and means 'outside the plan'.",
  },
  {
    en: "escrow",
    ar: "حساب الضمان",
    stem: "الضمان",
    note: "Statutory escrow account for off-plan sales. Never transliterate.",
  },
  {
    en: "service charge",
    ar: "رسوم الخدمات",
    stem: "رسوم الخدمات",
  },
  {
    en: "handover",
    ar: "التسليم",
    stem: "تسليم",
  },
  {
    en: "payment plan",
    ar: "خطة السداد",
    stem: "السداد",
  },
  {
    en: "mortgage",
    ar: "تمويل عقاري",
    stem: "تمويل عقاري",
    forbidden: ["رهن"],
    note: "رهن is the security interest itself; the product a buyer shops for is تمويل عقاري.",
  },
  {
    en: "down payment",
    ar: "الدفعة الأولى",
    stem: "الدفعة الأولى",
  },

  // ── Property types. ──────────────────────────────────────────────────────
  { en: "villa", ar: "فيلا", stem: "فيلا", alsoStems: ["فلل"] },
  { en: "townhouse", ar: "تاون هاوس", stem: "تاون هاوس" },
  { en: "apartment", ar: "شقة", stem: "شقة", alsoStems: ["شقق"] },
  { en: "penthouse", ar: "بنتهاوس", stem: "بنتهاوس" },
  { en: "duplex", ar: "دوبلكس", stem: "دوبلكس" },
  { en: "studio", ar: "استوديو", stem: "استوديو" },
  { en: "plot", ar: "أرض", stem: "أرض", alsoStems: ["أراض"] },
  { en: "showroom", ar: "صالة عرض", stem: "صالة عرض" },

  // ── Features that have a house rendering. ────────────────────────────────
  { en: "bedroom", ar: "غرفة نوم", stem: "غرفة نوم" },
  { en: "bathroom", ar: "حمام", stem: "حمام" },
  { en: "maid's room", ar: "غرفة خادمة", stem: "غرفة خادمة" },
  { en: "balcony", ar: "شرفة", stem: "شرفة" },
  { en: "sea view", ar: "إطلالة على البحر", stem: "إطلالة" },
  { en: "furnished", ar: "مفروش", stem: "مفروش" },
  { en: "built-up area", ar: "المساحة المبنية", stem: "المساحة المبنية" },
  { en: "amenities", ar: "المرافق", stem: "المرافق" },

  // ── Roles and process. ───────────────────────────────────────────────────
  {
    en: "broker",
    ar: "وسيط عقاري",
    stem: "وسيط",
    alsoStems: ["وسطاء"],
  },
  {
    en: "developer",
    ar: "مطور عقاري",
    stem: "مطور",
    note: "Property developer, not a software one — the model gets this wrong out of context.",
  },
  { en: "viewing", ar: "معاينة", stem: "معاينة" },
  { en: "valuation", ar: "تقييم", stem: "تقييم" },
  { en: "listing", ar: "إعلان عقاري", stem: "إعلان" },
];

/** Entries whose English term appears in the source text. */
export function relevantEntries(source: string): GlossaryEntry[] {
  return GLOSSARY.filter((e) => termRe(e.en).test(source));
}

/**
 * Word-boundary match for an English term. `\b` is wrong for terms containing
 * an apostrophe or hyphen at the edge, so the boundaries are explicit.
 */
export function termRe(en: string): RegExp {
  const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "iu");
}

/** The glossary lines to put in the prompt, limited to what is relevant. */
export function glossaryPrompt(source: string): string {
  const entries = relevantEntries(source);
  if (entries.length === 0) return "";
  return entries.map((e) => `- "${e.en}" → ${e.ar}`).join("\n");
}
