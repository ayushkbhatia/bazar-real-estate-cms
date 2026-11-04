"use server";

import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isAnthropicConfigured } from "@/lib/concierge/env";
import { sanitizeEmailBody } from "@/lib/content-assets/email-html";
import { translateField } from "@/lib/i18n/mt/translate";
import { mtClientFromEnv } from "@/lib/i18n/mt/hf-client";
import { fromSlots, markIssues, normaliseModelEntities, toSlots } from "@/lib/i18n/mt/html";
import { NEWSLETTER_WRITE_ROLES, isBlankBody, toArabicLinks } from "@/lib/newsletter/campaign";
import { normaliseDesign, textSlots, withArabic } from "@/lib/newsletter/blocks/document";
import type { Design } from "@/lib/newsletter/blocks/types";

/**
 * "Translate from English" — a machine first draft of the Arabic edition,
 * which the editor then reads and corrects before sending (ADR-0008: curated
 * Arabic is a gated machine first draft, not hand-authored from nothing).
 *
 * The same pipeline the property editor's Translate button uses
 * (lib/i18n/mt): prices, links and names masked before the model sees them,
 * the body split into blocks with its inline markup replaced by markers, so
 * the model never receives a tag and cannot damage one; each block validated
 * and, if rejected, left in English. Featured blocks have no text and pass
 * through untouched — they draw themselves in Arabic. Links to the site's
 * pages are pointed at their `/ar` pages.
 *
 * Nothing is saved here: the result fills the composer's Arabic fields, and
 * the editor saves it like anything they typed. Fails closed and says so
 * when no model key is configured.
 *
 * The client comes from the provider shim (`mtClientFromEnv`), so this adds
 * no importer of the SDK (lib/i18n/no-runtime-mt.test.ts keeps that list
 * shrink-only), and an `MT_PROVIDER=huggingface` setting is honoured.
 */

export type NewsletterTranslation =
  | {
      status: "ok";
      subject_ar: string;
      preheader_ar: string;
      body_ar: string;
      /** Human-readable notes on what kept its English. */
      notes: string[];
    }
  | { status: "error"; message: string };

const MAX_SUBJECT = 200;

export async function translateNewsletter(campaignId: string, input: {
  subject: string;
  preheader: string;
  body: string;
}): Promise<NewsletterTranslation> {
  await requireRole(NEWSLETTER_WRITE_ROLES);
  if (!isAnthropicConfigured) {
    return {
      status: "error",
      message:
        "Machine translation isn't set up here (no ANTHROPIC_API_KEY). Use “Copy the English” and translate it by hand.",
    };
  }
  const subject = input.subject.trim().slice(0, MAX_SUBJECT);
  const preheader = input.preheader.trim().slice(0, MAX_SUBJECT);
  const body = sanitizeEmailBody(input.body ?? "", { features: true });
  if (!subject && isBlankBody(body)) {
    return { status: "error", message: "Write the English edition first — there's nothing to translate yet." };
  }

  let mt: Awaited<ReturnType<typeof mtClientFromEnv>>;
  try {
    mt = await mtClientFromEnv();
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Machine translation isn't set up here." };
  }
  const client = mt.client;
  // Model names are Anthropic's unless another provider is answering.
  const model = mt.provider === "huggingface" ? mt.proseModel : undefined;
  const notes: string[] = [];

  const one = async (text: string, kind: "title" | "summary", label: string) => {
    if (!text) return "";
    const result = await translateField({ client, text, kind, maxLength: MAX_SUBJECT, model });
    if (result.ok) return normaliseModelEntities(result.text);
    notes.push(`The ${label} kept its English — the translation didn't pass the checks.`);
    return "";
  };

  const [subjectAr, preheaderAr, bodyAr] = await Promise.all([
    one(subject, "title", "subject"),
    one(preheader, "summary", "preview line"),
    (async () => {
      if (isBlankBody(body)) return "";
      const doc = toSlots(body);
      const blocks = await Promise.all(
        doc.slots.map(async (slot) => {
          const result = await translateField({
            client,
            text: slot.text,
            kind: "body",
            model,
            extraIssues: (out) => markIssues(slot, out),
          });
          return result.ok ? normaliseModelEntities(result.text) : null;
        }),
      );
      const kept = blocks.filter((b) => b === null).length + doc.skipped;
      if (kept > 0) {
        notes.push(
          `${kept} of ${doc.slots.length + doc.skipped} paragraphs kept their English — look for them in the Arabic and translate those by hand.`,
        );
      }
      return toArabicLinks(sanitizeEmailBody(fromSlots(doc, blocks), { features: true }));
    })(),
  ]);

  if (!subjectAr && isBlankBody(bodyAr)) {
    return { status: "error", message: "The translation didn't pass its checks. Try again, or translate by hand." };
  }

  await logAudit({
    action: "newsletter.translate",
    target_kind: "newsletter_campaign",
    target_id: campaignId,
    after: { kept_english: notes.length },
  });

  return { status: "ok", subject_ar: subjectAr, preheader_ar: preheaderAr, body_ar: bodyAr, notes };
}

export type DesignTranslation =
  | { status: "ok"; subject_ar: string; preheader_ar: string; design: Design; notes: string[] }
  | { status: "error"; message: string };

/**
 * "Translate from English" for a block-built newsletter: every block's words
 * through the same pipeline, one field at a time, each written into its
 * Arabic twin. A field whose translation fails the checks is left blank —
 * the composer then names it as missing, rather than sending English in an
 * Arabic email. Nothing is saved here.
 */
export async function translateDesign(
  campaignId: string,
  input: { subject: string; preheader: string; design: unknown },
): Promise<DesignTranslation> {
  await requireRole(NEWSLETTER_WRITE_ROLES);
  if (!isAnthropicConfigured) {
    return {
      status: "error",
      message: "Machine translation isn't set up here (no ANTHROPIC_API_KEY). Use “Copy the English” and translate it by hand.",
    };
  }
  const design = normaliseDesign(input.design);
  const slots = textSlots(design);
  if (slots.length === 0 && !input.subject.trim()) {
    return { status: "error", message: "Write the English edition first — there's nothing to translate yet." };
  }
  let mt: Awaited<ReturnType<typeof mtClientFromEnv>>;
  try {
    mt = await mtClientFromEnv();
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Machine translation isn't set up here." };
  }
  const client = mt.client;
  const model = mt.provider === "huggingface" ? mt.proseModel : undefined;
  const one = async (text: string, kind: "title" | "summary" | "body", maxLength?: number) => {
    if (!text.trim()) return "";
    const result = await translateField({ client, text, kind, maxLength, model });
    return result.ok ? normaliseModelEntities(result.text) : "";
  };

  const [subjectAr, preheaderAr, ...values] = await Promise.all([
    one(input.subject.trim().slice(0, MAX_SUBJECT), "title", MAX_SUBJECT),
    one(input.preheader.trim().slice(0, MAX_SUBJECT), "summary", MAX_SUBJECT),
    ...slots.map((slot) => one(slot.en, slot.kind === "textarea" ? "body" : "title")),
  ]);
  const filled = new Map(slots.map((slot, i) => [slot, values[i] ?? ""] as const));
  const kept = [...filled.values()].filter((v) => !v).length;
  const notes = kept
    ? [`${kept} of ${slots.length} texts didn't pass the checks and were left blank — the composer lists them; write those by hand.`]
    : [];
  if (!subjectAr) notes.push("The subject kept its English — write the Arabic subject by hand.");

  await logAudit({
    action: "newsletter.translate",
    target_kind: "newsletter_campaign",
    target_id: campaignId,
    after: { format: "blocks", texts: slots.length, kept_blank: kept },
  });
  return { status: "ok", subject_ar: subjectAr, preheader_ar: preheaderAr, design: withArabic(design, filled), notes };
}
