"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  developerCreateSchema,
  developerEditSchema,
  developerNameKey,
  normaliseDeveloperInput,
  DEVELOPER_EDIT_ROLES,
} from "@/lib/schemas/developer";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

/**
 * Every write into the developer catalogue.
 *
 * Note that the RLS policy behind this table (`developers_staff_write`,
 * migration 0001) is `for all to authenticated using (public.is_staff())`,
 * which any *active* staff member satisfies — including agent and support.
 * The narrower role gate below is the only thing enforcing who may extend a
 * shared, site-wide taxonomy, so any surface that writes to `developers` must
 * call these actions rather than the table directly.
 */
const DEVELOPER_ROLES = DEVELOPER_EDIT_ROLES;

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
  revalidateDeveloper(data.slug);

  return {
    status: "ok",
    id: data.id,
    name: data.name,
    slug: data.slug,
    created: true,
  };
}

/**
 * Clear the public surfaces a developer appears on. The profile page and the
 * index are both statically rendered, and the sitemap advertises every row —
 * a new or renamed developer has to reach all three without waiting for the
 * revalidate window.
 */
function revalidateDeveloper(slug: string, previousSlug?: string | null) {
  revalidateLocalised("/developers");
  revalidateLocalised(`/developers/${slug}`);
  if (previousSlug && previousSlug !== slug)
    revalidateLocalised(`/developers/${previousSlug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/pages/sub/developer");
}

export type DeveloperSaveResult =
  | { status: "ok"; message: string; slug: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** The record editor's save. */
export async function updateDeveloper(
  id: string,
  raw: Record<string, unknown>,
): Promise<DeveloperSaveResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(DEVELOPER_ROLES);

  const parsed = developerEditSchema.safeParse(normaliseDeveloperInput(raw));
  if (!parsed.success)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  const input = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("developers")
    .select("name, slug")
    .eq("id", id)
    .maybeSingle();

  // `developers.slug` is unique in Postgres, but a clash here should read as a
  // field error rather than a raw constraint message.
  const { data: clash } = await supabase
    .from("developers")
    .select("id")
    .eq("slug", input.slug)
    .neq("id", id)
    .limit(1);
  if (clash && clash.length > 0)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { slug: "Another developer already uses this link." },
    };

  const { data, error } = await supabase
    .from("developers")
    .update({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      founded_year: input.founded_year ?? null,
    })
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error) {
    if (error.code === "23505")
      return {
        status: "error",
        message: "That link is already in use.",
        fieldErrors: { slug: "Already in use" },
      };
    return { status: "error", message: error.message };
  }
  if (!data)
    return {
      status: "error",
      message: "Not saved — your account may not be allowed to edit developers.",
    };

  await logAudit({
    action: "developer.update",
    target_kind: "developer",
    target_id: id,
    before: before ?? null,
    after: { name: input.name, slug: input.slug },
  });

  revalidateDeveloper(data.slug, before?.slug ?? null);
  // The record editor is addressed by slug, so a rename moves it too.
  revalidatePath(`/admin/developers/${data.slug}`);
  if (before?.slug && before.slug !== data.slug)
    revalidatePath(`/admin/developers/${before.slug}`);
  return { status: "ok", message: "Saved.", slug: data.slug };
}

/**
 * Publish or unpublish a developer.
 *
 * Draft removes it from /developers, from the sitemap, and from its own URL.
 * It deliberately stays pickable in the CMS: properties and projects reference
 * the row, and yanking it out of those pickers would strand their attribution.
 * Nothing on a listing links to a developer profile, so this leaves no dead
 * links behind.
 */
export async function setDeveloperPublished(
  id: string,
  published: boolean,
): Promise<DeveloperSaveResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(DEVELOPER_ROLES);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developers")
    .update({ published_at: published ? new Date().toISOString() : null })
    .eq("id", id)
    .select("slug, name")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Not saved — your account may not be allowed to edit developers.",
    };

  await logAudit({
    action: published ? "developer.publish" : "developer.unpublish",
    target_kind: "developer",
    target_id: id,
    before: { published: !published },
    after: { published },
  });

  revalidateDeveloper(data.slug);
  revalidatePath(`/admin/developers/${data.slug}`);
  return {
    status: "ok",
    message: published
      ? `${data.name} is live on /developers.`
      : `${data.name} moved to draft — it's off /developers.`,
    slug: data.slug,
  };
}

/**
 * The logo, set separately from the rest of the record.
 *
 * It saves on its own — same split as the area cover image — so picking an
 * asset takes effect without submitting the whole form.
 */
export async function setDeveloperLogo(
  id: string,
  logoId: string | null,
): Promise<DeveloperSaveResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(DEVELOPER_ROLES);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developers")
    .update({ logo_id: logoId })
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Not saved — your account may not be allowed to edit developers.",
    };

  await logAudit({
    action: "developer.update",
    target_kind: "developer",
    target_id: id,
    before: null,
    after: { logo_id: logoId },
  });

  revalidateDeveloper(data.slug);
  revalidatePath(`/admin/developers/${data.slug}`);
  return { status: "ok", message: "Logo saved.", slug: data.slug };
}
