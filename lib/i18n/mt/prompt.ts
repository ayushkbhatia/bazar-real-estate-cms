import { glossaryPrompt } from "./glossary";
import type { MtTarget } from "./targets";

/**
 * The prompt. Register is the part that decides whether this is usable.
 *
 * The default failure mode of a competent model asked for Arabic is formal
 * literary MSA — correct, and completely wrong for the job. It reads like a
 * ministry circular, and a Gulf buyer reading a AED 12m villa listing written
 * in that register clocks it as a translation within a sentence, which costs
 * more trust than leaving the listing in English would have.
 *
 * So the instruction is specific about what to write rather than what to
 * avoid: the Arabic of Gulf property marketing, which is MSA with a lighter
 * hand and none of the ceremonial connectives.
 */

/**
 * Interface chrome, which is not a listing and must not be translated as one.
 *
 * This exists because the listing framing was quietly wrong for every string
 * in `messages/`. Told it was translating property listings, the model resolves
 * every ambiguous label toward property vocabulary — and the labels on a
 * calculator are nothing but ambiguous single words. Observed on the first
 * pass over `tools`:
 *
 *   "Optional"    -> فاخر            ("luxury" — an amenity word)
 *   "Comfortable" -> شقة مريحة        ("a comfortable apartment")
 *   "fixed"       -> شقة استوديو مفروشة | إطلالة على القناة | إيجار ثابت
 *
 * Each of those is a plausible translation of the word *in a listing*. None of
 * them is a button. Nothing in the validator can catch it either: the length
 * is fine, the digits are fine, there is no Latin and no sentinel drift. Only
 * a human reading the rendered page sees it, which is exactly the failure mode
 * ADR-0007 calls "bad Arabic is worse than no Arabic".
 */
export type MtKind = MtTarget["kind"] | "ui" | "page";

const REGISTER: Record<MtKind, string> = {
  ui: "Interface text on a website — a button, a field label, a section heading, a short helper sentence. Translate the words in front of you and nothing around them. Never expand a one- or two-word label into a phrase; never resolve an ambiguous word toward property vocabulary. \"Optional\" is the opposite of required, not a luxury. \"Comfortable\" describes a ratio, not an apartment. \"Fixed\" describes an interest rate, not a tenancy. If a word could mean two things, choose the one a control on a form would mean.",
  title:
    "A listing headline. Short, concrete, no verb padding. Match the English's length as closely as Arabic allows.",
  summary:
    "A one- or two-sentence summary shown on a card. Plain and factual; no rhetorical flourish.",
  body:
    "Listing prose. Keep the paragraph structure and the sentence count of the English. Do not add detail the English does not state, and do not summarise.",
  alt: "Image alt text for a screen reader. Describe what is visible, plainly, in under fifteen words.",
  /*
   * Copy from the firm's own marketing pages — a hero headline, an eyebrow, a
   * section intro, a button.
   *
   * It needs its own register because the other four are all framed as
   * *listing* content, and on page copy that framing does not merely change
   * the tone, it changes what the model produces. Run under `title` ("a
   * listing headline"), a heading reading "Reviews and comments" came back as
   * "شقة استوديو مفروشة بالكامل — إطلالة على القناة" — a fully furnished studio
   * with a canal view. Fluent, confident, and about nothing on the page.
   *
   * Every one of the nineteen structural checks passed it. Nothing else can
   * catch this, which is why the fix belongs in the prompt.
   */
  page:
    "Copy from the firm's own website — a headline, an eyebrow label, a short section intro, a button. Say exactly what the English says, at the same length. Do not describe a property, do not write new marketing, and do not expand a two-word label into a sentence.",
};

/** The rules that hold whatever is being translated. */
const SHARED_RULES = `Rules:
- Output ONLY the translation. No preamble, no explanation, no quotation marks around it, no alternatives.
- Placeholders like ⟦0⟧ are protected content — prices, permit numbers, references, phone numbers, measurements. Reproduce each one EXACTLY as it appears, once. Move them where Arabic word order requires. Never translate, renumber, add or drop one.
- Placeholders like ⟦m0⟧ are formatting markers (bold, italic, a link). Reproduce each one EXACTLY, once. Move them to wrap the words they should emphasise in Arabic — they mark emphasis, not position. An opening marker must still come before its closing marker.
- Never invent a number, a measurement, a date, or a fact that is not in the English.
- A placeholder often stands for a proper noun — a place, a company, a project. Keep it in the position that noun would occupy in an Arabic sentence. "New developments in ⟦0⟧" is "مشاريع جديدة في ⟦0⟧", never "⟦0⟧ مشاريع جديدة في".
- Use Western digits (0-9) for any number you write, matching the site's convention.
- Do not leave English words in the Arabic.
- Write Modern Standard Arabic only. No dialect — never "عايز", "مش", "ايه", "دلوقتي" or any other colloquial form. This is published copy for a professional firm.
- Output plain text. Never add markdown — no #, no **bold**, no bullets — unless the English has it.`;

export const SYSTEM_PROMPT = `You translate Emirati property listings from English into Arabic for a boutique advisory in Abu Dhabi.

Write the Arabic of Gulf property marketing: Modern Standard Arabic as it is actually used in UAE listings and brochures — clear, direct, and readable. Do not write formal literary or administrative Arabic; it reads as officialese and signals a translation immediately.

${SHARED_RULES}`;

/**
 * The same rules, framed as interface text rather than as listings.
 *
 * Separate from `SYSTEM_PROMPT` rather than a clause inside it because the
 * framing is the whole problem: "you translate property listings" is what
 * turned "Optional" into "luxury". A model told twice what it is doing
 * believes the first sentence.
 */
export const UI_SYSTEM_PROMPT = `You translate the interface of a property website from English into Arabic, for a boutique advisory in Abu Dhabi.

This is chrome, not content: buttons, field labels, table headers, section headings, validation messages, short helper sentences. The reader is using a tool, not reading a brochure. Write the plain, conventional Arabic that UAE websites use for the same controls — the wording a bank's or a portal's own Arabic interface would use.

You are NOT translating a property listing. Do not reach for marketing vocabulary, and do not let a word's real-estate sense win when its everyday sense is the one a form control means.

${SHARED_RULES}`;

/**
 * The framing for the firm's own page copy.
 *
 * Separate from both other system prompts for the same reason `UI_SYSTEM_PROMPT`
 * is separate from `SYSTEM_PROMPT`: the opening sentence decides what the model
 * thinks it is doing, and a clause buried further down does not undo it.
 *
 * `SYSTEM_PROMPT` opens "You translate Emirati property listings", and on a
 * page heading that produces a property listing — not a bad translation, a
 * different thing entirely. `UI_SYSTEM_PROMPT` overcorrects the other way: it
 * says "you are NOT translating a property listing" and renders hero copy in
 * the voice of a bank's form controls.
 *
 * This one names the actual job: translating marketing copy that already
 * exists, faithfully.
 */
export const PAGE_SYSTEM_PROMPT = `You translate the copy of a property advisory's own website from English into Arabic. The firm is a boutique advisory in Abu Dhabi.

This is a TRANSLATION, not a brief. Every string you are given is already on a live page in English. Say the same thing in Arabic. Do not write better marketing, do not describe a property, and do not supply detail the English leaves out.

The commonest failure on this material is inventing content. "Reviews and comments" is a heading about reviews; it is not an invitation to describe an apartment. "Where to live" is a two-word label, not a listing. A three-word English string becomes a three-word Arabic string.

Write Modern Standard Arabic as UAE property websites actually write it — clear, direct, readable. Not literary, not administrative.

${SHARED_RULES}`;

export function systemPromptFor(kind: MtKind): string {
  if (kind === "ui") return UI_SYSTEM_PROMPT;
  if (kind === "page") return PAGE_SYSTEM_PROMPT;
  return SYSTEM_PROMPT;
}

export function buildPrompt(input: {
  text: string;
  kind: MtKind;
  maxLength?: number;
}): string {
  const parts = [REGISTER[input.kind]];

  const glossary = glossaryPrompt(input.text);
  if (glossary) {
    parts.push(
      `Use these renderings exactly — they are house terms and some are legally specific:\n${glossary}`,
    );
  }

  if (input.maxLength) {
    // Stated as a hard limit rather than a suggestion, because the validator
    // treats it as one and a retry costs a whole round trip.
    parts.push(
      `Hard limit: ${input.maxLength} characters. If the natural translation is longer, tighten it.`,
    );
  }

  parts.push(`English:\n${input.text}`);
  return parts.join("\n\n");
}

/**
 * Appended on the one retry, naming what went wrong. Cheaper and far more
 * reliable than re-rolling the same prompt and hoping.
 */
export function retryHint(issues: { code: string; detail: string }[]): string {
  return `Your previous attempt was rejected:\n${issues
    .map((i) => `- ${i.detail}`)
    .join("\n")}\n\nTranslate again, fixing exactly those problems. Output only the translation.`;
}
