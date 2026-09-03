"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { unitLabelSettingsSchema } from "@/lib/schemas/unit-labels";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

export type UnitLabelActionResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string };

/**
 * Save the currency / area-unit dictionary.
 *
 * The whole bag is replaced rather than merged, which is safe here in a way it
 * is not for most settings: the form renders every key the schema knows about,
 * so what it posts IS the complete set of overrides. A merge would make an
 * emptied box unclearable — the point of clearing one is to fall back to the
 * word the site shipped with, and a merge would keep re-supplying the old
 * value it was meant to drop.
 */
export async function updateUnitLabels(
  raw: unknown,
): Promise<UnitLabelActionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(["admin"]);

  const parsed = unitLabelSettingsSchema.safeParse(raw);
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Please fix the errors below.",
    };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("site_settings")
    .update({ unit_labels: parsed.data, updated_by: user?.id ?? null })
    .eq("id", 1);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "settings.unit_labels_update",
    target_kind: "site_settings",
    target_id: "1",
    before: null,
    after: parsed.data,
  });

  revalidatePath("/admin/settings/units");
  // "layout", and for the same reason the typography action gives: the
  // dictionary is read in app/[locale]/(public)/layout.tsx and handed to a
  // provider that every marketplace page renders inside, so all of them hold a
  // cached copy. Revalidating "/" alone would relabel the home page's cards and
  // leave every search result, every listing and every development page quoting
  // the old word until its own cache expired.
  revalidateLocalised("/", "layout");

  return { status: "ok", message: "Currency and unit labels saved." };
}
