"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { articleCreateSchema } from "@/lib/schemas/article";
import { slugify } from "@/lib/slug";
import { logAudit } from "@/lib/audit";

export type CreateArticleResult =
  | { status: "ok"; id: string }
  | { status: "error"; message: string };

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  base: string,
): Promise<string> {
  let candidate = base || "article";
  for (let i = 0; i < 8; i++) {
    const { data } = await supabase
      .from("articles")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createArticle(
  raw: Record<string, unknown>,
): Promise<CreateArticleResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const parsed = articleCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign in required." };

  const slug = await uniqueSlug(supabase, slugify(parsed.data.title));

  const { data, error } = await supabase
    .from("articles")
    .insert({
      title: parsed.data.title,
      category: parsed.data.category,
      slug,
      author_id: user.id,
      status: "draft",
      body_html: "",
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      status: "error",
      message: error?.message ?? "Could not create article.",
    };
  }

  await logAudit({
    action: "article.create",
    target_kind: "article",
    target_id: data.id,
    before: null,
    after: { title: parsed.data.title, category: parsed.data.category, slug },
  });

  redirect(`/admin/blog/${data.id}`);
}
