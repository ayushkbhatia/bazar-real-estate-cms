"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { parseCardLabels, statusPillsSchema } from "@/lib/schemas/card-labels";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

export type StatusPillsActionResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string };

/**
 * Save the status pills' words ("Off-plan", "For Sale", "For Rent").
 *
 * They sit in `site_settings.card_labels` beside the card-label vocabulary,
 * which is saved from its own form, so this writes only the `status` key and
 * keeps the labels as stored. Blank fields are dropped: a blank pill reads the
 * shipped words, which is what an editor who clears a box expects.
 */
export async function updateStatusPills(
  raw: unknown,
): Promise<StatusPillsActionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  // The same role as the card labels beside them: `site_settings` is admin-written.
  await requireRole(["admin"]);

  const parsed = statusPillsSchema.safeParse(raw);
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Keep each pill under 28 characters.",
    };

  const status = Object.fromEntries(
    Object.entries(parsed.data ?? {}).flatMap(([id, v]) => {
      const text = v?.text?.trim();
      const text_ar = v?.text_ar?.trim();
      if (!text && !text_ar) return [];
      return [[id, { ...(text ? { text } : {}), ...(text_ar ? { text_ar } : {}) }]];
    }),
  );

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: current } = await supabase
    .from("site_settings")
    .select("card_labels")
    .eq("id", 1)
    .maybeSingle();
  const stored = parseCardLabels(
    (current as { card_labels?: unknown } | null)?.card_labels,
  );
  const { error } = await supabase
    .from("site_settings")
    .update({
      card_labels: { ...stored, status },
      updated_by: user?.id ?? null,
    })
    .eq("id", 1);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "settings.status_pills_update",
    target_kind: "site_settings",
    target_id: "1",
    before: stored.status ?? null,
    after: status,
  });

  revalidatePath("/admin/pages/pills");
  // Pills are drawn on the home page, every project page and every article
  // with listing cards.
  revalidateLocalised("/", "layout");

  return { status: "ok", message: "Pills saved." };
}
