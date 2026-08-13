"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { FORM_KEYS } from "@/lib/forms";
import { listFormsForAdmin } from "@/lib/queries/forms";
import {
  evaluateLandingPublishability,
  parseLandingDocument,
  presetBlocks,
  resolveDocument,
  validateDocument,
  type BlockInstance,
} from "@/lib/page-builder";
import {
  landingCreateSchema,
  landingMetaSchema,
  normaliseLandingMetaInput,
} from "@/lib/schemas/landing-page";

/**
 * Page-builder writes.
 *
 * Two role constants, not one. Everywhere else in this CMS a single tuple gates
 * edit and publish alike, but `is_staff()` — the RLS predicate — is true for
 * *any* active staff row including `agent` and `support`, so `requireRole` is
 * the only real boundary and it is worth drawing it twice. Deleting a campaign
 * is not editing one, which is the same line `admin/media/_actions.ts` draws
 * with MEDIA_DESTROY_ROLES.
 *
 * The marketing manager is the intended daily user, so they can publish.
 */
const LANDING_EDIT_ROLES = ["admin", "editor", "marketing"] as const;
const LANDING_DELETE_ROLES = ["admin", "editor"] as const;

export type LandingResult =
  | { status: "ok"; message: string; id?: string; slug?: string }
  | {
      status: "invalid";
      message: string;
      issues: string[];
      fieldErrors?: Record<string, string>;
    }
  | { status: "blocked"; message: string; blockers: string[] }
  | { status: "error"; message: string };

const NOT_FOUND: LandingResult = {
  status: "error",
  message: "That page doesn't exist any more.",
};

function noEnv(): LandingResult {
  return { status: "error", message: "Supabase env vars are not set." };
}

async function revalidateLanding(slug: string | null, prevSlug?: string | null) {
  revalidatePath("/admin/page-builder");
  if (slug) revalidateLocalised(`/lp/${slug}`);
  if (prevSlug && prevSlug !== slug) revalidateLocalised(`/lp/${prevSlug}`);
}

function duplicateSlug(error: { code?: string }): boolean {
  return error.code === "23505";
}

// ── create ───────────────────────────────────────────────────────────────

export async function createLandingPage(
  raw: Record<string, unknown>,
): Promise<LandingResult> {
  if (!isSupabaseConfigured) return noEnv();
  const { supabase, user } = await requireRole(LANDING_EDIT_ROLES);

  const parsed = landingCreateSchema.safeParse({
    title: typeof raw.title === "string" ? raw.title.trim() : raw.title,
    slug: typeof raw.slug === "string" ? raw.slug.trim().toLowerCase() : raw.slug,
    preset: typeof raw.preset === "string" ? raw.preset : undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "invalid",
      message: "Please fix the errors below.",
      issues: parsed.error.issues.map((i) => i.message),
      fieldErrors,
    };
  }

  // A new page starts as a draft, so the starting layout lands in
  // `draft_blocks` and `blocks` stays the empty array it defaults to. First
  // publish is what makes the two agree.
  const blocks = presetBlocks(parsed.data.preset ?? "blank");

  const { data, error } = await supabase
    .from("landing_pages")
    .insert({
      title: parsed.data.title,
      slug: parsed.data.slug,
      status: "draft",
      blocks: [],
      draft_blocks: blocks as unknown as never,
      created_by: user.id,
    })
    .select("id, slug")
    .maybeSingle();

  if (error) {
    if (duplicateSlug(error)) {
      return {
        status: "invalid",
        message: "That URL is already taken — pick another.",
        issues: [],
        fieldErrors: { slug: "Already in use" },
      };
    }
    return { status: "error", message: error.message };
  }
  if (!data) return NOT_FOUND;

  await logAudit({
    action: "landing_page.create",
    target_kind: "landing_page",
    target_id: data.id,
    after: {
      slug: data.slug,
      preset: parsed.data.preset ?? "blank",
      blocks: blocks.length,
    },
  });
  revalidatePath("/admin/page-builder");
  redirect(`/admin/page-builder/${data.id}`);
}

// ── metadata ─────────────────────────────────────────────────────────────

export async function updateLandingMeta(
  id: string,
  raw: Record<string, unknown>,
): Promise<LandingResult> {
  if (!isSupabaseConfigured) return noEnv();
  const { supabase } = await requireRole(LANDING_EDIT_ROLES);

  const parsed = landingMetaSchema.safeParse(normaliseLandingMetaInput(raw));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "invalid",
      message: "Please fix the errors below.",
      issues: parsed.error.issues.map((i) => i.message),
      fieldErrors,
    };
  }

  const { data: before } = await supabase
    .from("landing_pages")
    .select("title, slug")
    .eq("id", id)
    .maybeSingle();

  const { meta_title, meta_description, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("landing_pages")
    .update({
      title: rest.title,
      title_ar: rest.title_ar ?? null,
      slug: rest.slug,
      noindex: rest.noindex ?? false,
      seo: {
        meta_title: meta_title ?? null,
        meta_description: meta_description ?? null,
      },
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("slug")
    .maybeSingle();

  if (error) {
    if (duplicateSlug(error)) {
      return {
        status: "invalid",
        message: "That URL is already taken — pick another.",
        issues: [],
        fieldErrors: { slug: "Already in use" },
      };
    }
    return { status: "error", message: error.message };
  }
  if (!data) return NOT_FOUND;

  if (before && (before.title !== rest.title || before.slug !== rest.slug)) {
    await logAudit({
      action: "landing_page.update",
      target_kind: "landing_page",
      target_id: id,
      before: { title: before.title, slug: before.slug },
      after: { title: rest.title, slug: rest.slug },
    });
  }

  revalidatePath(`/admin/page-builder/${id}`);
  await revalidateLanding(data.slug, before?.slug ?? null);
  return { status: "ok", message: "Saved." };
}

// ── the document ─────────────────────────────────────────────────────────

/**
 * Save the working copy.
 *
 * Writes `draft_blocks` and never `blocks`. That is the whole point of the
 * table: everywhere else in this CMS a save on a published row is a deploy,
 * and a marketing manager assembling a campaign over an afternoon would
 * otherwise publish every intermediate state — including the placeholder
 * headline a block ships with.
 */
export async function saveLandingBlocks(
  id: string,
  incoming: BlockInstance[],
): Promise<LandingResult> {
  if (!isSupabaseConfigured) return noEnv();
  const { supabase } = await requireRole(LANDING_EDIT_ROLES);

  const { data: row } = await supabase
    .from("landing_pages")
    .select("slug, blocks, draft_blocks")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return NOT_FOUND;

  // Unknown block types are recovered from what is already stored, never from
  // the payload — see the note in lib/page-builder/document.ts.
  const storedRaw = row.draft_blocks ?? row.blocks;
  const stored = parseLandingDocument(storedRaw).blocks;

  const validated = validateDocument(
    Array.isArray(incoming) ? incoming : [],
    stored,
  );
  if (!validated.ok) {
    return {
      status: "invalid",
      message: "Some sections need attention before this can save.",
      issues: validated.issues,
    };
  }

  const { error } = await supabase
    .from("landing_pages")
    .update({ draft_blocks: validated.blocks as unknown as never })
    .eq("id", id);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "landing_page.draft_save",
    target_kind: "landing_page",
    target_id: id,
    after: {
      slug: row.slug,
      blocks: validated.blocks.length,
      types: [...new Set(validated.blocks.map((b) => b.type))],
    },
  });

  revalidatePath(`/admin/page-builder/${id}`);
  revalidatePath(`/admin/page-builder/${id}/preview`);
  return { status: "ok", message: "Draft saved." };
}

export async function discardLandingDraft(id: string): Promise<LandingResult> {
  if (!isSupabaseConfigured) return noEnv();
  const { supabase } = await requireRole(LANDING_EDIT_ROLES);

  const { data, error } = await supabase
    .from("landing_pages")
    .update({ draft_blocks: null })
    .eq("id", id)
    .is("deleted_at", null)
    .select("slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return NOT_FOUND;

  await logAudit({
    action: "landing_page.draft_discard",
    target_kind: "landing_page",
    target_id: id,
    after: { slug: data.slug },
  });
  revalidatePath(`/admin/page-builder/${id}`);
  return { status: "ok", message: "Unpublished changes discarded." };
}

// ── publish ──────────────────────────────────────────────────────────────

/** Which forms are switched on, so the gate can catch a dead conversion point. */
async function enabledFormKeys(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<string[]> {
  try {
    const { rows, missingTable } = await listFormsForAdmin(supabase);
    // A missing forms table must not make every page unpublishable: the
    // resolver renders registry defaults in that case, so every registered form
    // is live by definition.
    if (missingTable) return [...FORM_KEYS];
    return rows.filter((r) => r.form.enabled).map((r) => r.def.key);
  } catch {
    return [...FORM_KEYS];
  }
}

export async function publishLandingPage(id: string): Promise<LandingResult> {
  if (!isSupabaseConfigured) return noEnv();
  const { supabase } = await requireRole(LANDING_EDIT_ROLES);

  const { data: row } = await supabase
    .from("landing_pages")
    .select("slug, title, seo, noindex, status, published_at, blocks, draft_blocks")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return NOT_FOUND;

  const draft = parseLandingDocument(row.draft_blocks ?? row.blocks).blocks;
  const seo = (row.seo as Record<string, unknown> | null) ?? null;

  const gate = evaluateLandingPublishability({
    title: row.title,
    slug: row.slug,
    metaDescription:
      typeof seo?.meta_description === "string" ? seo.meta_description : null,
    noindex: row.noindex,
    // Bilingual: folding here would publish the English fold and
    // silently drop every Arabic value from the live document.
    blocks: resolveDocument(draft, "bilingual"),
    knownFormKeys: FORM_KEYS,
    enabledFormKeys: await enabledFormKeys(supabase),
  });
  if (!gate.ok) {
    return {
      status: "blocked",
      message: "This page isn't ready to publish yet.",
      blockers: gate.blockers,
    };
  }

  const { error } = await supabase
    .from("landing_pages")
    .update({
      blocks: draft as unknown as never,
      draft_blocks: null,
      status: "published",
      // Republishing must not reset the original date.
      published_at: row.published_at ?? new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "landing_page.publish",
    target_kind: "landing_page",
    target_id: id,
    after: {
      slug: row.slug,
      blocks: draft.length,
      types: [...new Set(draft.map((b) => b.type))],
    },
  });

  revalidatePath(`/admin/page-builder/${id}`);
  revalidatePath("/sitemap.xml");
  await revalidateLanding(row.slug);
  return { status: "ok", message: "Published.", slug: row.slug };
}

export async function unpublishLandingPage(id: string): Promise<LandingResult> {
  if (!isSupabaseConfigured) return noEnv();
  const { supabase } = await requireRole(LANDING_EDIT_ROLES);

  const { data, error } = await supabase
    .from("landing_pages")
    .update({ status: "draft" })
    .eq("id", id)
    .is("deleted_at", null)
    .select("slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return NOT_FOUND;

  await logAudit({
    action: "landing_page.unpublish",
    target_kind: "landing_page",
    target_id: id,
    after: { slug: data.slug },
  });

  revalidatePath(`/admin/page-builder/${id}`);
  revalidatePath("/sitemap.xml");
  await revalidateLanding(data.slug);
  return { status: "ok", message: "Unpublished — the page now 404s." };
}

// ── duplicate / delete ───────────────────────────────────────────────────

export async function duplicateLandingPage(id: string): Promise<LandingResult> {
  if (!isSupabaseConfigured) return noEnv();
  const { supabase, user } = await requireRole(LANDING_EDIT_ROLES);

  const { data: row } = await supabase
    .from("landing_pages")
    .select("slug, title, blocks, draft_blocks, seo, noindex")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return NOT_FOUND;

  // Try `-copy`, then `-copy-2`… rather than failing on the unique index.
  let slug = `${row.slug}-copy`.slice(0, 140);
  for (let n = 2; n < 20; n += 1) {
    const { count } = await supabase
      .from("landing_pages")
      .select("id", { count: "exact", head: true })
      .eq("slug", slug);
    if (!count) break;
    slug = `${row.slug}-copy-${n}`.slice(0, 140);
  }

  const { data, error } = await supabase
    .from("landing_pages")
    .insert({
      title: `${row.title} (copy)`.slice(0, 160),
      slug,
      status: "draft",
      blocks: [],
      draft_blocks: (row.draft_blocks ?? row.blocks) as unknown as never,
      seo: row.seo,
      noindex: row.noindex,
      created_by: user.id,
    })
    .select("id, slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return NOT_FOUND;

  await logAudit({
    action: "landing_page.duplicate",
    target_kind: "landing_page",
    target_id: data.id,
    before: { slug: row.slug },
    after: { slug: data.slug },
  });
  revalidatePath("/admin/page-builder");
  return {
    status: "ok",
    message: `Copied to /lp/${data.slug}.`,
    id: data.id,
    slug: data.slug,
  };
}

export async function deleteLandingPage(id: string): Promise<LandingResult> {
  if (!isSupabaseConfigured) return noEnv();
  const { supabase } = await requireRole(LANDING_DELETE_ROLES);

  // Soft delete, so the media-usage index can still see which assets a
  // recently-removed page was holding.
  const { data, error } = await supabase
    .from("landing_pages")
    .update({ deleted_at: new Date().toISOString(), status: "draft" })
    .eq("id", id)
    .is("deleted_at", null)
    .select("slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return NOT_FOUND;

  await logAudit({
    action: "landing_page.delete",
    target_kind: "landing_page",
    target_id: id,
    before: { slug: data.slug },
  });
  revalidatePath("/sitemap.xml");
  await revalidateLanding(data.slug);
  return { status: "ok", message: "Deleted." };
}
