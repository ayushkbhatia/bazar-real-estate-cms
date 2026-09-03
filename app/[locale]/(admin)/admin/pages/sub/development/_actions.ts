"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import {
  defaultDocument,
  validateSections,
  type StoredSection,
} from "@/lib/master-pages";
import {
  developmentPageDef,
  subPageSlug,
} from "@/lib/master-pages/subpages";
import { developmentContentSchema } from "@/lib/schemas/development-content";
import { developmentHeroFactsPartialSchema } from "@/lib/schemas/development";
import {
  mergeSearchAppearance,
  searchAppearanceSchema,
  type SearchAppearanceInput,
} from "@/lib/schemas/seo";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;
/**
 * Deleting a project is not an editing action. Marketing may write every word
 * on the page but may not destroy the record behind it — the same line
 * publishing draws.
 */
const DESTRUCTIVE_ROLES = ["admin", "editor"] as const;

export type SubPageResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

async function loadRecord(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developments")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return { record: null, message: error.message };
  if (!data) return { record: null, message: "Development not found." };
  return { record: data, message: null };
}

async function persist(
  record: { id: string; name: string; slug: string },
  sections: StoredSection[],
  action: string,
): Promise<SubPageResult> {
  const supabase = await createSupabaseServerClient();
  const slug = subPageSlug("development", record.slug);

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug,
    title: `${record.name} (project page)`,
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
    after: { development: record.slug, sections: sections.length },
  });

  revalidateLocalised(`/developments/${record.slug}`);
  revalidatePath(`/admin/pages/sub/development/${record.slug}`);
  revalidatePath("/admin/pages/sub");
  return { status: "ok", message: "Saved." };
}

export async function saveDevelopmentPage(
  slug: string,
  sections: StoredSection[],
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  const result = validateSections(developmentPageDef(record), sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map((i) => `${i.section} · ${i.field}: ${i.message}`),
    };
  }
  return persist(record, result.sections, "page.subpage_update");
}

export async function resetDevelopmentPage(
  slug: string,
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  return persist(
    record,
    defaultDocument(developmentPageDef(record)),
    "page.subpage_reset",
  );
}

/**
 * Cover and site-plan imagery live on the `developments` row, not in the
 * section document — the public page and the developments admin both already
 * read them there, and two places holding the same fact is how they drift.
 * The sub-page editor writes them through this action.
 */
export async function setDevelopmentImages(
  slug: string,
  images: { hero_image_id: string | null; masterplan_id: string | null },
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developments")
    .update({
      hero_image_id: images.hero_image_id,
      masterplan_id: images.masterplan_id,
    })
    .eq("id", record.id)
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Not saved — your account may not be allowed to edit this.",
    };

  await logAudit({
    action: "development.images_update",
    target_kind: "development",
    target_id: record.id,
    before: null,
    after: images,
  });

  revalidateLocalised(`/developments/${record.slug}`);
  revalidatePath(`/admin/pages/sub/development/${record.slug}`);
  revalidatePath("/admin/pages/sub");
  return { status: "ok", message: "Images saved." };
}

export type FactsResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * The hero stat row — starting price, bedrooms, total units, handover.
 *
 * These sit on the `developments` row rather than in the section document, so
 * the page editor had no way to reach them and the record editor was the only
 * door. Saving them from the page editor is what the CMS user actually
 * expects, since it is the hero of the page they are editing.
 */
export async function saveDevelopmentFacts(
  slug: string,
  facts: {
    starting_price: number | null;
    bedrooms_text: string | null;
    total_units: number | null;
    handover_date: string | null;
  },
): Promise<FactsResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  // Partial on purpose: a draft can be filled in over more than one sitting.
  // The publish gate is what enforces completeness before anything goes live.
  const parsed = developmentHeroFactsPartialSchema.safeParse(facts);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developments")
    .update({
      starting_price: parsed.data.starting_price,
      bedrooms_text: parsed.data.bedrooms_text,
      total_units: parsed.data.total_units,
      handover_date: parsed.data.handover_date,
    })
    .eq("id", record.id)
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Not saved — your account may not be allowed to edit this.",
    };

  await logAudit({
    action: "development.facts_update",
    target_kind: "development",
    target_id: record.id,
    before: null,
    after: parsed.data,
  });

  revalidateLocalised(`/developments/${record.slug}`);
  revalidatePath(`/admin/pages/sub/development/${record.slug}`);
  revalidatePath("/admin/pages/sub/development");
  revalidateLocalised("/developments");
  return { status: "ok", message: "Key facts saved." };
}

export type CreateDevelopmentPageResult =
  | { status: "ok"; slug: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * "Add development page" — creates the record the page is built from. It starts
 * unpublished (`published_at` null), so a half-filled project never reaches the
 * public site, and the publish gate is what decides when it may.
 *
 * Only name, slug and developer are required here, and only because a row
 * cannot exist without them (`developer_id` is NOT NULL; the slug is the page's
 * address). The four hero facts are deliberately *not* required at this point.
 *
 * They used to be, via the strict `developmentHeroFactsSchema`, and that was
 * the bug: someone who didn't yet know the handover date couldn't create
 * anything at all, so the whole half-filled form was lost the moment they
 * navigated away. `saveDevelopmentFacts` has always accepted partial facts on
 * the grounds that "a draft can be filled in over more than one sitting" —
 * creation now agrees with it. Anything supplied is still format-checked, so a
 * typo is caught where it is made; completeness stays the publish gate's job.
 */
export async function createDevelopmentPage(input: {
  name: string;
  slug: string;
  developer_id: string;
  area_id: string | null;
  tagline: string | null;
  hero_image_id: string | null;
  /** The hero stat row. Optional here — the publish gate requires it, not this. */
  starting_price: number | null;
  bedrooms_text: string | null;
  total_units: number | null;
  handover_date: string | null;
}): Promise<CreateDevelopmentPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const name = input.name.trim();
  if (name.length < 3)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { name: "Name is too short" },
    };

  const slug = slugify(input.slug.trim() || name);
  if (slug.length < 3)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { slug: "Slug is too short" },
    };

  if (!input.developer_id)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { developer_id: "Pick a developer" },
    };

  // Partial: whatever is known now, checked for format, the rest filled in
  // later from the project page. See the note above the function.
  const facts = developmentHeroFactsPartialSchema.safeParse({
    starting_price: input.starting_price,
    bedrooms_text: input.bedrooms_text,
    total_units: input.total_units,
    handover_date: input.handover_date,
  });
  if (!facts.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of facts.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developments")
    .insert({
      name,
      slug,
      developer_id: input.developer_id,
      area_id: input.area_id,
      tagline: input.tagline,
      hero_image_id: input.hero_image_id,
      status: "pre_launch" as const,
      starting_price: facts.data.starting_price,
      bedrooms_text: facts.data.bedrooms_text,
      total_units: facts.data.total_units,
      handover_date: facts.data.handover_date,
    })
    .select("id, slug")
    .maybeSingle();

  if (error) {
    if (error.code === "23505")
      return {
        status: "error",
        message: "That slug is already in use — pick another.",
        fieldErrors: { slug: "Already in use" },
      };
    return { status: "error", message: error.message };
  }
  if (!data)
    return {
      status: "error",
      message: "Not created — your account may not be allowed to add projects.",
    };

  await logAudit({
    action: "development.create",
    target_kind: "development",
    target_id: data.id,
    before: null,
    after: { name, slug },
  });

  revalidatePath("/admin/pages/sub");
  revalidatePath("/admin/pages/sub/development");
  return { status: "ok", slug: data.slug };
}

/**
 * Everything on the development row that its page renders but the section
 * document doesn't hold: payment plan, named features, map pin, neighbouring
 * projects, FAQs and the lead advisor.
 *
 * One action rather than six because they save from one card — and because
 * `meta` is a single jsonb column, so writing them separately would mean
 * read-modify-write races between the sub-editors.
 */
export async function saveDevelopmentContent(
  slug: string,
  raw: unknown,
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  const parsed = developmentContentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "field"}: ${i.message}`,
      ),
    };
  }
  const input = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("developments")
    .select("meta")
    .eq("id", record.id)
    .maybeSingle();

  // Merge rather than replace: `meta` also carries flags this card doesn't
  // edit (floorplan_gated, is_signature) and they mustn't be dropped.
  const meta = {
    ...((existing?.meta as Record<string, unknown> | null) ?? {}),
    feature_blocks: input.feature_blocks,
    faq: input.faq,
    coords: input.coords,
    nearby_ids: input.nearby_ids,
  };

  const { data, error } = await supabase
    .from("developments")
    .update({
      payment_plan: input.payment_plan as unknown as never,
      lead_advisor_id: input.lead_advisor_id,
      meta: meta as unknown as never,
    })
    .eq("id", record.id)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Not saved — your account may not be allowed to edit this.",
    };

  await logAudit({
    action: "development.content_update",
    target_kind: "development",
    target_id: record.id,
    before: null,
    after: {
      payment_plan: input.payment_plan?.name ?? null,
      features: input.feature_blocks.length,
      faqs: input.faq.length,
      nearby: input.nearby_ids.length,
    },
  });

  revalidateLocalised(`/developments/${record.slug}`);
  revalidatePath(`/admin/pages/sub/development/${record.slug}`);
  return { status: "ok", message: "Saved." };
}

export type DeleteResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/**
 * Permanently delete a project — the `developments` row and its page document.
 *
 * Guarded rather than merely confirmed, because the row is the parent of real
 * data. Postgres cascades `development_media`, `development_units` and
 * `floor_plans` (all of which belong to the project and are meaningless without
 * it), but `enquiries.development_id` and `properties.development_id` are
 * ON DELETE SET NULL — those records survive and quietly lose their link. That
 * is a lead losing the project it asked about, so the caller is told the counts
 * up front and the confirmation names them.
 *
 * A live project can't be deleted at all: unpublish it first. Removing a page
 * out from under public traffic and search results should be a deliberate two
 * steps, not one, and unpublishing is the reversible half.
 */
export async function deleteDevelopment(
  id: string,
  /** Typed by the operator; must match the project name exactly. */
  confirmation: string,
): Promise<DeleteResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(DESTRUCTIVE_ROLES);

  const supabase = await createSupabaseServerClient();
  const { data: record, error: readError } = await supabase
    .from("developments")
    .select("id, name, slug, published_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };
  if (!record) return { status: "error", message: "Project not found." };

  if (record.published_at)
    return {
      status: "error",
      message:
        "This project is live. Unpublish it first — deleting a published page would break its public URL without warning.",
    };

  if (confirmation.trim() !== record.name)
    return {
      status: "error",
      message: "The name you typed doesn't match, so nothing was deleted.",
    };

  // Snapshot before the row is gone: the audit entry is the only record that
  // this project ever existed.
  await logAudit({
    action: "development.delete",
    target_kind: "development",
    target_id: record.id,
    before: { name: record.name, slug: record.slug },
    after: null,
  });

  // The page document is keyed by slug, not a foreign key, so nothing cascades
  // to it — delete it explicitly or it lingers as an orphan that a project
  // recreated under the same slug would silently inherit.
  await supabase
    .from("pages")
    .delete()
    .eq("slug", subPageSlug("development", record.slug));

  const { error } = await supabase.from("developments").delete().eq("id", id);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/pages/sub");
  revalidatePath("/admin/pages/sub/development");
  revalidateLocalised("/developments");
  return { status: "ok", message: `Deleted "${record.name}".` };
}

/**
 * The search title and description for a project page.
 *
 * `/developments/[slug]` used to derive both from the record — the name for the
 * title, the marketing description or a synthesised "handover Q3 2027" string
 * for the snippet — with no way to say anything else. Those derivations are
 * still the fallback; this only adds the override.
 *
 * Its own action rather than a field on the content card, for the same reason
 * the master pages split theirs out: the content card writes `meta` wholesale,
 * and an SEO save that had to carry the feature blocks with it would let two
 * editors on two cards overwrite each other.
 */
export async function saveDevelopmentSeo(
  slug: string,
  raw: SearchAppearanceInput,
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  const parsed = searchAppearanceSchema.safeParse(raw);
  if (!parsed.success)
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "field"}: ${i.message}`,
      ),
    };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("developments")
    .select("seo")
    .eq("id", record.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("developments")
    .update({
      seo: mergeSearchAppearance(existing?.seo, parsed.data) as unknown as never,
    })
    .eq("id", record.id)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Not saved — your account may not be allowed to edit this.",
    };

  await logAudit({
    action: "development.seo_update",
    target_kind: "development",
    target_id: record.id,
    before: null,
    after: parsed.data,
  });

  revalidateLocalised(`/developments/${record.slug}`);
  revalidatePath(`/admin/pages/sub/development/${record.slug}`);
  return { status: "ok", message: "Search appearance saved." };
}

/**
 * Save the card labels this development wears.
 *
 * A merge into `meta` rather than a replace, for the reason the content action
 * above gives from the other side: that bag also carries `feature_blocks`,
 * `faq`, `coords`, `nearby_ids`, `floorplan_gated` and `is_signature`, and a
 * card that owns one key must not be able to drop the rest.
 *
 * Ids are filtered rather than checked against the vocabulary: `labelsFor`
 * resolves an assignment through the saved labels at render time, so an id
 * that no longer exists draws nothing. Rejecting it here would lose the tag if
 * a label were switched off and later switched back on.
 */
export async function setDevelopmentCardLabels(
  slug: string,
  labels: string[],
): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  const clean = [
    ...new Set(
      (Array.isArray(labels) ? labels : []).filter(
        (v): v is string => typeof v === "string" && /^[a-z0-9_]{1,60}$/.test(v),
      ),
    ),
  ].slice(0, 40);

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("developments")
    .select("meta")
    .eq("id", record.id)
    .maybeSingle();

  const meta = {
    ...((existing?.meta as Record<string, unknown> | null) ?? {}),
    labels: clean,
  };

  const { error } = await supabase
    .from("developments")
    .update({ meta: meta as unknown as never })
    .eq("id", record.id);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "development.card_labels_update",
    target_kind: "development",
    target_id: record.id,
    before: null,
    after: { labels: clean },
  });

  revalidatePath(`/admin/pages/sub/development/${slug}`);
  // The card is drawn on /developments, /off-plan, every area page and the
  // developer profile — so "layout", not this development's own page.
  revalidateLocalised("/", "layout");
  revalidateLocalised(`/developments/${slug}`);
  return { status: "ok" };
}
