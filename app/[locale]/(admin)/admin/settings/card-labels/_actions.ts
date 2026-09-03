"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { cardLabelSettingsSchema } from "@/lib/schemas/card-labels";
import { CARD_LABEL_DEFAULTS } from "@/lib/card-labels";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

export type CardLabelActionResult =
  { status: "ok"; message?: string } | { status: "error"; message: string };

/**
 * Save the card-label vocabulary.
 *
 * Two guards beyond the schema, both about ids rather than words, because an
 * id is the only part of a label that anything else in the database points at.
 *
 * - **A built-in cannot be dropped.** `resolveCardLabels` would put it back on
 *   the next read anyway, so refusing here is the difference between an
 *   operator being told and an operator watching a row reappear.
 * - **Ids are never rewritten on save.** The form allocates one when a label
 *   is created and leaves it alone afterwards, so renaming "Exclusive" to
 *   "Sole agency" keeps every property that carries it. That is a property of
 *   the form; this is the assertion that the property held.
 */
export async function updateCardLabels(
  raw: unknown,
): Promise<CardLabelActionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(["admin"]);

  const parsed = cardLabelSettingsSchema.safeParse(raw);
  if (!parsed.success)
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Please fix the errors below.",
    };

  const ids = new Set(parsed.data.labels.map((l) => l.id));
  const dropped = CARD_LABEL_DEFAULTS.filter((d) => !ids.has(d.id));
  if (dropped.length)
    return {
      status: "error",
      message: `"${dropped[0]!.text}" ships with the site and cannot be deleted — switch it off instead.`,
    };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("site_settings")
    .update({ card_labels: parsed.data, updated_by: user?.id ?? null })
    .eq("id", 1);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "settings.card_labels_update",
    target_kind: "site_settings",
    target_id: "1",
    before: null,
    after: parsed.data,
  });

  revalidatePath("/admin/settings/card-labels");
  // "layout", for the reason the typography and unit-label actions give: cards
  // are drawn on the home page, all six search routes, every area, agent and
  // developer profile. Revalidating "/" alone would relabel the home page and
  // leave the rest quoting the old vocabulary until their own caches expired.
  revalidateLocalised("/", "layout");

  return { status: "ok", message: "Card labels saved." };
}
