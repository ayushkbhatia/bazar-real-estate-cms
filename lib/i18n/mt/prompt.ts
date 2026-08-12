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

const REGISTER: Record<MtTarget["kind"], string> = {
  title:
    "A listing headline. Short, concrete, no verb padding. Match the English's length as closely as Arabic allows.",
  summary:
    "A one- or two-sentence summary shown on a card. Plain and factual; no rhetorical flourish.",
  body:
    "Listing prose. Keep the paragraph structure and the sentence count of the English. Do not add detail the English does not state, and do not summarise.",
  alt: "Image alt text for a screen reader. Describe what is visible, plainly, in under fifteen words.",
};

export const SYSTEM_PROMPT = `You translate Emirati property listings from English into Arabic for a boutique advisory in Abu Dhabi.

Write the Arabic of Gulf property marketing: Modern Standard Arabic as it is actually used in UAE listings and brochures — clear, direct, and readable. Do not write formal literary or administrative Arabic; it reads as officialese and signals a translation immediately.

Rules:
- Output ONLY the translation. No preamble, no explanation, no quotation marks around it, no alternatives.
- Placeholders like ⟦0⟧ are protected content — prices, permit numbers, references, phone numbers, measurements. Reproduce each one EXACTLY as it appears, once. Move them where Arabic word order requires. Never translate, renumber, add or drop one.
- Never invent a number, a measurement, a date, or a fact that is not in the English.
- Use Western digits (0-9) for any number you write, matching the site's convention.
- Do not leave English words in the Arabic.`;

export function buildPrompt(input: {
  text: string;
  kind: MtTarget["kind"];
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
