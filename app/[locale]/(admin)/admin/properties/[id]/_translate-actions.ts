"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { anthropicEnv, isAnthropicConfigured } from "@/lib/concierge/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  MT_MODEL_PROSE,
  machineProvenance,
  translateField,
  type MtClient,
  type Provenance,
} from "@/lib/i18n/mt/translate";
import {
  fromSlots,
  markIssues,
  normaliseModelEntities,
  toSlots,
} from "@/lib/i18n/mt/html";

/**
 * Translate a property's Arabic, on demand from the CMS.
 *
 * There is no queue and no cron behind this — see migration 0101. With 18
 * published rows, a button an editor presses is the whole pipeline, and it has
 * the property the cron design never had: someone is watching when it runs, so
 * a failure is seen rather than accumulating silently in a table nobody opens.
 *
 * `description` is Tiptap HTML and goes through `lib/i18n/mt/html.ts`: the
 * document is split into per-block units, inline tags are replaced by opaque
 * `⟦mN⟧` markers, and only text is sent. The model never receives markup, so
 * it cannot damage any — the same argument that makes masking prices worth
 * having. A block whose translation is rejected keeps its English, so a
 * partly translated description is a normal outcome rather than a failure.
 */

const PROPERTY_ROLES = ["admin", "editor", "agent"] as const;

type EnKey = "title" | "short_description";
type ArKey = "title_ar" | "short_description_ar";

/** The two plain-text targets, with their Arabic caps from the edit schema. */
const FIELDS: {
  en: EnKey;
  ar: ArKey;
  kind: "title" | "summary";
  maxLength: number;
}[] = [
  { en: "title", ar: "title_ar", kind: "title", maxLength: 240 },
  {
    en: "short_description",
    ar: "short_description_ar",
    kind: "summary",
    maxLength: 480,
  },
];

export type FieldOutcome =
  | { field: string; status: "translated"; text: string; retried: boolean }
  | { field: string; status: "skipped"; reason: string }
  | { field: string; status: "failed"; issues: string[]; raw: string };

export type TranslateOutcome =
  | { status: "ok"; fields: FieldOutcome[] }
  | { status: "error"; message: string };

function client(): MtClient {
  return new Anthropic({
    apiKey: anthropicEnv.ANTHROPIC_API_KEY,
  }) as unknown as MtClient;
}

export async function translatePropertyArabic(
  id: string,
): Promise<TranslateOutcome> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase is not configured." };

  await requireRole(PROPERTY_ROLES);

  // Fails closed and loud. The alternative — a button that appears to work and
  // silently no-ops — is the exact shape of the cron gap this project already
  // has, and the client may well never set this key.
  if (!isAnthropicConfigured) {
    return {
      status: "error",
      message:
        "ANTHROPIC_API_KEY is not set, so translation is unavailable. Arabic fields can still be written by hand.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: property, error } = await supabase
    .from("properties")
    .select("id, reference, title, short_description, description, i18n")
    .eq("id", id)
    .maybeSingle();

  if (error || !property)
    return { status: "error", message: error?.message ?? "Property not found." };

  const mt = client();
  const now = new Date().toISOString();
  const outcomes: FieldOutcome[] = [];
  const translated: Partial<Record<ArKey, string>> = {};
  let descriptionAr: string | null = null;
  const provenance: Record<string, Provenance> = {
    ...((property.i18n as Record<string, Provenance> | null) ?? {}),
  };

  for (const field of FIELDS) {
    const english = (property[field.en] ?? "") as string;
    if (english.trim().length === 0) {
      outcomes.push({
        field: field.en,
        status: "skipped",
        reason: "no English text",
      });
      continue;
    }

    const result = await translateField({
      client: mt,
      text: english,
      kind: field.kind,
      maxLength: field.maxLength,
    });

    if (result.ok) {
      translated[field.ar] = result.text;
      provenance[field.ar] = machineProvenance(english, result.model, now);
      outcomes.push({
        field: field.en,
        status: "translated",
        text: result.text,
        retried: result.retried,
      });
    } else {
      // Nothing is written. The English keeps showing, which is the designed
      // fallback, and the reviewer gets the rejected text and the reasons.
      outcomes.push({
        field: field.en,
        status: "failed",
        issues: result.issues.map((i) => i.detail),
        raw: result.raw,
      });
    }
  }

  // ── Rich text, block by block.
  const englishHtml = (property.description ?? "").trim();
  if (englishHtml.length > 0) {
    const doc = toSlots(englishHtml);
    const blocks = await Promise.all(
      doc.slots.map(async (slot) => {
        const result = await translateField({
          client: mt,
          text: slot.text,
          kind: "body",
          extraIssues: (out) => markIssues(slot, out),
        });
        // Models re-escape their own output; without this the text is
        // encoded twice and the page renders a literal "&amp;".
        return result.ok ? normaliseModelEntities(result.text) : null;
      }),
    );

    const rejected = blocks.filter((b) => b === null).length;
    const unsafe = doc.skipped;
    if (rejected < blocks.length) {
      descriptionAr = fromSlots(doc, blocks);
      provenance.description_ar = machineProvenance(
        englishHtml,
        MT_MODEL_PROSE,
        now,
      );
      outcomes.push({
        field: "description",
        status: "translated",
        // Reported as blocks, because "1 field" hides that 2 of 9 paragraphs
        // are still in English.
        text: `${blocks.length - rejected} of ${blocks.length + unsafe} blocks`,
        retried: false,
      });
      if (rejected > 0 || unsafe > 0) {
        outcomes.push({
          field: "description",
          status: "failed",
          issues: [
            ...(rejected > 0 ? [`${rejected} block(s) kept their English`] : []),
            // Named separately: this one is not the model's fault and will
            // not fix itself on a retry.
            ...(unsafe > 0
              ? [
                  `${unsafe} block(s) contain the ⟦…⟧ marker syntax and cannot be translated safely`,
                ]
              : []),
          ],
          raw: "",
        });
      }
    } else {
      outcomes.push({
        field: "description",
        status: "failed",
        issues: ["every block was rejected"],
        raw: "",
      });
    }
  } else {
    outcomes.push({
      field: "description",
      status: "skipped",
      reason: "no English text",
    });
  }

  const written = Object.keys(translated) as ArKey[];
  if (written.length > 0 || descriptionAr !== null) {
    const { error: writeError } = await supabase
      .from("properties")
      .update({
        ...translated,
        ...(descriptionAr === null ? {} : { description_ar: descriptionAr }),
        i18n: provenance,
      })
      .eq("id", id);
    if (writeError) return { status: "error", message: writeError.message };

    await logAudit({
      action: "property.translate",
      target_kind: "property",
      target_id: id,
      before: null,
      // One entry per run, not per field. The audit log is where price and
      // slug changes live, and a translate of two fields writing two rows
      // would start crowding it out.
      after: {
        fields: descriptionAr === null ? written : [...written, "description_ar"],
      },
    });

    revalidatePath(`/admin/properties/${id}`);
    // No public revalidation: /ar is not served yet, and the English pages
    // these fields sit beside have not changed.
  }

  return { status: "ok", fields: outcomes };
}
