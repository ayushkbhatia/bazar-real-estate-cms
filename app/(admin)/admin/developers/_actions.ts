"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { developerCreateSchema, developerNameKey } from "@/lib/schemas/developer";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

/**
 * Create a developer from anywhere one is picked.
 *
 * This folder holds no page.tsx or route.ts on purpose — it contributes no
 * route, only the action. The developer catalogue has no admin CRUD screen
 * yet; this is the first write path into it.
 *
 * Note that the RLS policy behind this table (`developers_staff_write`,
 * migration 0001) is `for all to authenticated using (public.is_staff())`,
 * which any *active* staff member satisfies — including agent and support.
 * The narrower role gate below is the only thing enforcing who may extend a
 * shared, site-wide taxonomy, so any future surface that writes to
 * `developers` must call this action rather than the table directly.
 */
const DEVELOPER_ROLES = ["admin", "editor", "marketing"] as const;

export type CreateDeveloperResult =
  | {
      status: "ok";
      id: string;
      name: string;
      slug: string;
      /** False when an existing developer matched — nothing was inserted. */
      created: boolean;
    }
  | { status: "error"; message: string };

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  base: string,
): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 8; i++) {
    const { data } = await supabase
      .from("developers")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createDeveloper(
  raw: Record<string, unknown>,
): Promise<CreateDeveloperResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(DEVELOPER_ROLES);

  const parsed = developerCreateSchema.safeParse(raw);
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };

  const name = parsed.data.name;
  const key = developerNameKey(name);
  if (key === "")
    return {
      status: "error",
      message: "That name has no letters or numbers in it.",
    };

  const supabase = await createSupabaseServerClient();

  // Reuse rather than duplicate. Two rows for one company is the worse
  // failure: developments split across them, and the catalogue has no merge
  // tool. The operator is told which happened, so a genuine collision between
  // two differently-named companies that slugify alike is at least visible.
  const { data: existing, error: lookupError } = await supabase
    .from("developers")
    .select("id, name, slug")
    .eq("slug", key)
    .maybeSingle();
  if (lookupError)
    return { status: "error", message: lookupError.message };
  if (existing)
    return {
      status: "ok",
      id: existing.id,
      name: existing.name,
      slug: existing.slug,
      created: false,
    };

  const slug = await uniqueSlug(supabase, key);

  const { data, error } = await supabase
    .from("developers")
    .insert({ name, slug })
    .select("id, name, slug")
    .maybeSingle();

  if (error) {
    // Someone else inserted the same developer between the lookup and here.
    // Return theirs — the caller wanted a developer with this name, and now
    // there is one.
    if (error.code === "23505") {
      const { data: raced } = await supabase
        .from("developers")
        .select("id, name, slug")
        .eq("slug", slug)
        .maybeSingle();
      if (raced)
        return {
          status: "ok",
          id: raced.id,
          name: raced.name,
          slug: raced.slug,
          created: false,
        };
    }
    return { status: "error", message: error.message };
  }
  if (!data)
    return {
      status: "error",
      message: "Not created — your account may not have permission.",
    };

  await logAudit({
    action: "developer.create",
    target_kind: "developer",
    target_id: data.id,
    before: null,
    after: { name: data.name, slug: data.slug },
  });

  // Every surface that lists developers is force-dynamic, so this is only for
  // the public profile route, which is statically rendered.
  revalidatePath("/developers");
  revalidatePath(`/developers/${data.slug}`);

  return {
    status: "ok",
    id: data.id,
    name: data.name,
    slug: data.slug,
    created: true,
  };
}
