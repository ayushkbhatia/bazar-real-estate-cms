"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { pageCreateSchema } from "@/lib/schemas/page";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type CreatePageResult =
  | { status: "ok"; id: string }
  | { status: "error"; message: string };

export async function createPage(
  raw: Record<string, unknown>,
): Promise<CreatePageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const parsed = pageCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pages")
    .insert({
      title: parsed.data.title,
      slug: parsed.data.slug,
      status: "draft",
      blocks: [],
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: "Slug already in use — pick a different one.",
      };
    }
    return { status: "error", message: error.message };
  }
  if (!data) return { status: "error", message: "Could not create page." };

  await logAudit({
    action: "page.create",
    target_kind: "page",
    target_id: data.id,
    before: null,
    after: { title: parsed.data.title, slug: parsed.data.slug },
  });

  redirect(`/admin/pages/${data.id}`);
}
