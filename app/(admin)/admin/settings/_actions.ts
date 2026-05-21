"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  brandSettingsSchema,
  displaySettingsSchema,
  emailTemplateOverrideSchema,
  emailTemplatesSchema,
  leadRoutingSettingsSchema,
  EMAIL_TEMPLATE_KEYS,
  type EmailTemplateKey,
} from "@/lib/schemas/site-settings";
import { currentUserIsAdmin } from "@/lib/queries/staff";
import { logAudit } from "@/lib/audit";

export type ActionResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

async function gate(): Promise<ActionResult | null> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  if (!(await currentUserIsAdmin()))
    return { status: "error", message: "Admins only." };
  return null;
}

function fieldErrorsFromZod(err: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

async function updateRow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("site_settings")
    .update({ ...patch, updated_by: user?.id ?? null })
    .eq("id", 1);
  if (error) return { status: "error", message: error.message };
  return { status: "ok" };
}

export async function updateBrandSettings(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  const gated = await gate();
  if (gated) return gated;
  const parsed = brandSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const supabase = await createSupabaseServerClient();
  const result = await updateRow(supabase, parsed.data);
  if (result.status === "ok") {
    await logAudit({
      action: "settings.brand_update",
      target_kind: "site_settings",
      target_id: "1",
      before: null,
      after: parsed.data,
    });
    revalidatePath("/admin/settings");
    revalidatePath("/");
    return { status: "ok", message: "Brand settings saved." };
  }
  return result;
}

export async function updateDisplaySettings(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  const gated = await gate();
  if (gated) return gated;
  const parsed = displaySettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const supabase = await createSupabaseServerClient();
  const result = await updateRow(supabase, parsed.data);
  if (result.status === "ok") {
    await logAudit({
      action: "settings.display_update",
      target_kind: "site_settings",
      target_id: "1",
      before: null,
      after: parsed.data,
    });
    revalidatePath("/admin/settings");
    revalidatePath("/");
    return { status: "ok", message: "Display settings saved." };
  }
  return result;
}

export async function updateLeadRouting(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  const gated = await gate();
  if (gated) return gated;
  const parsed = leadRoutingSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Lead-routing rules failed validation.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const supabase = await createSupabaseServerClient();
  const result = await updateRow(supabase, { lead_routing: parsed.data });
  if (result.status === "ok") {
    await logAudit({
      action: "settings.lead_routing_update",
      target_kind: "site_settings",
      target_id: "1",
      before: null,
      after: parsed.data,
    });
    revalidatePath("/admin/settings");
    return { status: "ok", message: "Lead-routing rules saved." };
  }
  return result;
}

export async function updateEmailTemplate(
  key: string,
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  const gated = await gate();
  if (gated) return gated;
  if (!(EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key)) {
    return { status: "error", message: "Unknown email template." };
  }
  const parsedKey = key as EmailTemplateKey;
  const parsed = emailTemplateOverrideSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Template failed validation.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("site_settings")
    .select("email_templates")
    .eq("id", 1)
    .maybeSingle();
  const current = emailTemplatesSchema.safeParse(
    existing?.email_templates ?? {},
  );
  const merged = {
    ...(current.success ? current.data : {}),
    [parsedKey]: parsed.data,
  };
  const result = await updateRow(supabase, { email_templates: merged });
  if (result.status === "ok") {
    await logAudit({
      action: "settings.email_template_update",
      target_kind: "email_template",
      target_id: parsedKey,
      before: null,
      after: parsed.data,
    });
    revalidatePath("/admin/settings");
    return { status: "ok", message: "Template saved." };
  }
  return result;
}

export async function resetEmailTemplate(key: string): Promise<ActionResult> {
  const gated = await gate();
  if (gated) return gated;
  if (!(EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key)) {
    return { status: "error", message: "Unknown email template." };
  }
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("site_settings")
    .select("email_templates")
    .eq("id", 1)
    .maybeSingle();
  const current = emailTemplatesSchema.safeParse(
    existing?.email_templates ?? {},
  );
  const merged = { ...(current.success ? current.data : {}) };
  delete merged[key];
  const result = await updateRow(supabase, { email_templates: merged });
  if (result.status === "ok") {
    await logAudit({
      action: "settings.email_template_reset",
      target_kind: "email_template",
      target_id: key,
    });
    revalidatePath("/admin/settings");
    return { status: "ok", message: "Reverted to default." };
  }
  return result;
}
