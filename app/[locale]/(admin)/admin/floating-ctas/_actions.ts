"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isMissingTableError } from "@/lib/queries/floating-ctas";
import {
  floatingCtaListSchema,
  type FloatingCtaListInput,
} from "@/lib/schemas/floating-cta";

const CTA_ROLES = ["admin", "editor", "marketing"] as const;

export type SaveFloatingCtasResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

/** Empty string from a text input means "not set", not "set to empty". */
function orNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Replace the rail with the editor's list, in the order given.
 *
 * A whole-list save rather than per-row writes: order is a property of the
 * list, and the editor already holds every row, so reconciling here keeps
 * "what I see is what is live" true even when a button was reordered and
 * another deleted in the same sitting.
 */
export async function saveFloatingCtas(
  raw: FloatingCtaListInput,
): Promise<SaveFloatingCtasResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  const { supabase } = await requireRole(CTA_ROLES);

  const parsed = floatingCtaListSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields.",
      issues: parsed.error.issues.map((i) => {
        const row = typeof i.path[1] === "number" ? i.path[1] + 1 : null;
        return row ? `Button ${row}: ${i.message}` : i.message;
      }),
    };
  }
  const ctas = parsed.data.ctas;

  const { data: existing, error: readError } = await supabase
    .from("floating_ctas")
    .select("id");
  if (readError)
    return {
      status: "error",
      message: isMissingTableError(readError)
        ? "The floating_ctas table is missing — apply migration 0084."
        : readError.message,
    };

  const keptIds = new Set(ctas.map((c) => c.id).filter(Boolean) as string[]);
  const removed = (existing ?? [])
    .map((r) => r.id)
    .filter((id) => !keptIds.has(id));

  // Deletes first: an editor who renamed button A's key to button B's old key
  // and deleted B in one pass would otherwise trip the unique index.
  if (removed.length > 0) {
    const { error } = await supabase
      .from("floating_ctas")
      .delete()
      .in("id", removed);
    if (error) return { status: "error", message: error.message };
  }

  for (const [index, cta] of ctas.entries()) {
    const row = {
      key: cta.key.trim().toLowerCase(),
      kind: cta.kind,
      label: cta.label.trim(),
      destination: orNull(cta.destination),
      message_template: orNull(cta.message_template),
      // A subject line only means something for mailto:. Clearing it when the
      // kind changes stops a stale one reappearing if it changes back.
      subject_template:
        cta.kind === "email" ? orNull(cta.subject_template) : null,
      scope: cta.scope,
      use_advisor_contact: cta.use_advisor_contact,
      color: orNull(cta.color)?.toUpperCase() ?? null,
      enabled: cta.enabled,
      sort_order: (index + 1) * 10,
    };

    const { error } = cta.id
      ? await supabase.from("floating_ctas").update(row).eq("id", cta.id)
      : await supabase.from("floating_ctas").insert(row);

    if (error) {
      if (error.code === "23505")
        return {
          status: "invalid",
          message: "Fix the highlighted fields.",
          issues: [`Button ${index + 1}: the key "${row.key}" is already used.`],
        };
      return { status: "error", message: error.message };
    }
  }

  await logAudit({
    action: "floating_ctas.save",
    target_kind: "floating_ctas",
    target_id: "rail",
    after: {
      count: ctas.length,
      keys: ctas.map((c) => c.key),
      removed: removed.length,
    },
  });

  // The rail lives in the public layout, so every public route renders it.
  revalidateLocalised("/", "layout");
  revalidatePath("/admin/floating-ctas");

  return {
    status: "ok",
    message:
      ctas.length === 1 ? "Saved 1 button." : `Saved ${ctas.length} buttons.`,
  };
}
