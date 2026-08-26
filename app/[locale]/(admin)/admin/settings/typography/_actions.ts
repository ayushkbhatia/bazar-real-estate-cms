"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { arabicFontSettingsSchema } from "@/lib/schemas/arabic-fonts";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

export type ArabicFontActionResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string };

/**
 * Save the Arabic type stack.
 *
 * Its own action file rather than another export off `../_actions.ts` because
 * the bag is nested — families holding files holding weights — and the shared
 * `fieldErrorsFromZod` there flattens an issue path to its first segment,
 * which for this schema is always the word "families". The form reports its
 * own errors from the resolver instead, so this only has to say yes or no.
 */
export async function updateArabicFontSettings(
  raw: unknown,
): Promise<ArabicFontActionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(["admin"]);

  const parsed = arabicFontSettingsSchema.safeParse(raw);
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
    .update({ arabic_fonts: parsed.data, updated_by: user?.id ?? null })
    .eq("id", 1);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "settings.arabic_fonts_update",
    target_kind: "site_settings",
    target_id: "1",
    before: null,
    after: parsed.data,
  });

  revalidatePath("/admin/settings/typography");
  // "layout", not the default "page": the `@font-face` block and the
  // `--bz-font-ar-*` overrides are emitted by app/[locale]/layout.tsx, so
  // every Arabic route holds a cached copy of them. Revalidating "/" alone
  // would restyle the homepage and leave every other page on the old face
  // until its own cache expired — the exact failure the brand action's note
  // describes for the logo.
  revalidateLocalised("/", "layout");

  return {
    status: "ok",
    message: parsed.data.enabled
      ? "Arabic typography saved. The Arabic site is now set in your faces."
      : "Arabic typography saved. Custom faces are off — the site is on its built-in Arabic face.",
  };
}
