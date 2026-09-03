"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  defaultDocument,
  validateSections,
  type StoredSection,
} from "@/lib/master-pages";
import {
  HEADER_CTA_PAGE_SLUG,
  headerCtaDef,
} from "@/lib/master-pages/header-cta";

const NAV_ROLES = ["admin", "editor", "marketing"] as const;

export type HeaderCtaResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

async function persist(
  sections: StoredSection[],
  action: string,
): Promise<HeaderCtaResult> {
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", HEADER_CTA_PAGE_SLUG)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug: HEADER_CTA_PAGE_SLUG,
    title: "Header button (site navigation)",
    status: "published" as const,
    blocks: sections as unknown as never,
  };

  const write = existing
    ? await supabase
        .from("pages")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .maybeSingle()
    : await supabase.from("pages").insert(payload).select("id").maybeSingle();

  if (write.error) return { status: "error", message: write.error.message };
  if (!write.data)
    return {
      status: "error",
      message: "Not saved — your account may not have permission to edit pages.",
    };

  await logAudit({
    action,
    target_kind: "page",
    target_id: write.data.id,
    before: null,
    after: { header_cta: true },
  });

  /*
   * `"layout"`, and the root path: the button is in the header, and the header
   * is in `app/[locale]/(public)/layout.tsx`. Naming `/` on its own would
   * refresh the home page and leave every other route serving the previous
   * label until its own window rolled over — which reads as "the save did
   * nothing" from anywhere but the home page. Same call the megamenu and
   * footer saves make, for the same reason.
   */
  revalidateLocalised("/", "layout");
  revalidatePath("/admin/megamenu/header-cta");
  revalidatePath("/admin/megamenu");
  return { status: "ok", message: "Saved." };
}

export async function saveHeaderCta(
  _key: string,
  sections: StoredSection[],
): Promise<HeaderCtaResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(NAV_ROLES);

  const result = validateSections(headerCtaDef(), sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map(
        (i) => `${i.section} · ${i.field}: ${i.message}`,
      ),
    };
  }
  return persist(result.sections, "nav.header_cta_update");
}

/** Drop every override — the header goes back to the button shipped in code. */
export async function resetHeaderCta(_key: string): Promise<HeaderCtaResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(NAV_ROLES);

  return persist(defaultDocument(headerCtaDef()), "nav.header_cta_reset");
}
