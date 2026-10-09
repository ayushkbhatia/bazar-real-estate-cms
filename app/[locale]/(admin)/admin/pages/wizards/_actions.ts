"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { defaultDocument, validateSections, type StoredSection } from "@/lib/master-pages";
import {
  getWizard,
  isWizardKey,
  wizardCopyIssues,
  wizardPageDef,
  wizardSlug,
  wizardStoredValues,
  type WizardKey,
} from "@/lib/master-pages/wizards";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type WizardSaveResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

async function persist(key: WizardKey, sections: StoredSection[], action: string): Promise<WizardSaveResult> {
  const supabase = await createSupabaseServerClient();
  const slug = wizardSlug(key);
  const { data: existing, error: readError } = await supabase.from("pages").select("id").eq("slug", slug).maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug,
    title: `Wizard: ${getWizard(key).label}`,
    status: "published" as const,
    blocks: sections as unknown as never,
  };
  const write = existing
    ? await supabase.from("pages").update(payload).eq("id", existing.id).select("id").maybeSingle()
    : await supabase.from("pages").insert(payload).select("id").maybeSingle();
  if (write.error) return { status: "error", message: write.error.message };
  if (!write.data) return { status: "error", message: "Not saved — your account may not have permission to edit pages." };

  await logAudit({ action, target_kind: "page", target_id: write.data.id, before: null, after: { wizard: key } });
  // The flow renders per request (force-dynamic), so the next screen an applicant opens reads this.
  revalidatePath(`/admin/pages/wizards/${key}`);
  revalidatePath("/admin/pages/wizards");
  revalidatePath("/admin/pages");
  return { status: "ok", message: "Saved. The wizard shows it from the next screen an applicant opens." };
}

export async function saveWizard(key: string, sections: StoredSection[]): Promise<WizardSaveResult> {
  if (!isSupabaseConfigured) return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);
  if (!isWizardKey(key)) return { status: "error", message: "Unknown wizard." };

  const result = validateSections(wizardPageDef(key), sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map((i) => `${i.section} · ${i.field}: ${i.message}`),
    };
  }
  const copyIssues = wizardCopyIssues(key, result.sections);
  if (copyIssues.length > 0) {
    return {
      status: "invalid",
      message: "Some wording can't go live as written.",
      issues: copyIssues.map((i) => `${i.section} · ${i.field}: ${i.message}`),
    };
  }
  return persist(key, wizardStoredValues(result.sections), "page.wizard_update");
}

/** Back to the catalogue's wording and the designed flow. */
export async function resetWizard(key: string): Promise<WizardSaveResult> {
  if (!isSupabaseConfigured) return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);
  if (!isWizardKey(key)) return { status: "error", message: "Unknown wizard." };
  return persist(key, wizardStoredValues(defaultDocument(wizardPageDef(key))), "page.wizard_reset");
}
