"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { anthropicEnv, isAnthropicConfigured } from "@/lib/concierge/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  machineProvenance,
  translateField,
  type MtClient,
  type Provenance,
} from "@/lib/i18n/mt/translate";

/**
 * Translate a property's Arabic, on demand from the CMS.
 *
 * There is no queue and no cron behind this — see migration 0101. With 18
 * published rows, a button an editor presses is the whole pipeline, and it has
 * the property the cron design never had: someone is watching when it runs, so
 * a failure is seen rather than accumulating silently in a table nobody opens.
 *
 * Only the two plain-text fields. `description` is Tiptap HTML, and sending
 * markup to a language model is how you get markup back that nearly parses —
 * it needs the document walked into an ordered array of text slots, translated
 * slot by slot, and spliced back, so corruption is structurally impossible
 * rather than merely unlikely. That is its own change.
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
    .select("id, reference, title, short_description, i18n")
    .eq("id", id)
    .maybeSingle();

  if (error || !property)
    return { status: "error", message: error?.message ?? "Property not found." };

  const mt = client();
  const now = new Date().toISOString();
  const outcomes: FieldOutcome[] = [];
  const translated: Partial<Record<ArKey, string>> = {};
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

  const written = Object.keys(translated) as ArKey[];
  if (written.length > 0) {
    const { error: writeError } = await supabase
      .from("properties")
      .update({ ...translated, i18n: provenance })
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
      after: { fields: written },
    });

    revalidatePath(`/admin/properties/${id}`);
    // No public revalidation: /ar is not served yet, and the English pages
    // these fields sit beside have not changed.
  }

  return { status: "ok", fields: outcomes };
}
