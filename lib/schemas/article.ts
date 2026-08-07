import { z } from "zod";
import { UUID_SHAPE_RE } from "@/lib/uuid";

/**
 * Article categories ("blog types") are a runtime-editable taxonomy stored in
 * the `article_categories` table (migration 0055). Editors add new types from
 * the blog editor without a deploy.
 *
 * The list below is the *seed* set — the seven categories that shipped as the
 * old `article_category` enum. It doubles as a fallback so the marketplace and
 * CMS keep rendering sensible labels when Supabase is unconfigured (preview /
 * e2e) or before the migration has been applied to a given environment. The
 * live dropdown, chip bar, and label lookups all read the DB first and fall
 * back to this only on error. See lib/queries/article-categories.ts.
 */
export type SeedArticleCategory = {
  slug: string;
  label: string;
  sort_order: number;
};

export const SEED_ARTICLE_CATEGORIES: readonly SeedArticleCategory[] = [
  { slug: "market_report", label: "Market report", sort_order: 10 },
  { slug: "buyers_guide", label: "Buyer's guide", sort_order: 20 },
  { slug: "sellers_guide", label: "Seller's guide", sort_order: 30 },
  { slug: "field_note", label: "Field note", sort_order: 40 },
  { slug: "policy", label: "Policy & regulation", sort_order: 50 },
  { slug: "off_plan_watch", label: "Off-plan watch", sort_order: 60 },
  { slug: "luxury", label: "Luxury", sort_order: 70 },
] as const;

/** Seed slugs — kept for callers that only need the identifiers. */
export const ARTICLE_CATEGORIES = SEED_ARTICLE_CATEGORIES.map(
  (c) => c.slug,
);

/** Seed slug → label map. Merged under DB labels for known-slug fallback. */
export const ARTICLE_CATEGORY_LABELS: Record<string, string> =
  Object.fromEntries(
    SEED_ARTICLE_CATEGORIES.map((c) => [c.slug, c.label]),
  );

export const ARTICLE_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "archived",
] as const;

/** URL slug (hyphenated) ⇄ stored category slug (underscored). */
export function categoryToUrlSlug(slug: string): string {
  return slug.replace(/_/g, "-");
}

/**
 * Human label for a category slug. Prefers a caller-supplied map (DB labels),
 * then the seed labels, then a title-cased fallback derived from the slug so a
 * brand-new category always renders *something* readable, never `undefined`.
 */
export function formatCategoryLabel(
  slug: string,
  labels?: Record<string, string>,
): string {
  const fromMap = labels?.[slug] ?? ARTICLE_CATEGORY_LABELS[slug];
  if (fromMap) return fromMap;
  const words = slug.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Stored category slugs allow lowercase letters, numbers, `_` and `-`. */
const categorySlugRegex = /^[a-z0-9_-]+$/;
const slugRegex = /^[a-z0-9-]+$/;

const categoryField = z
  .string()
  .min(1, "Pick a category")
  .max(60, "Category slug is too long")
  .regex(categorySlugRegex, "Invalid category");

/** Minimal payload to create a new article — the editor fills the rest. */
export const articleCreateSchema = z.object({
  title: z
    .string()
    .min(3, "Title is too short")
    .max(160, "Title is too long"),
  category: categoryField,
});

export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;

/** Payload for adding a new category ("blog type") from the editor. */
export const articleCategoryCreateSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Name is too short")
    .max(60, "Name is too long"),
  slug: z
    .string()
    .trim()
    .max(60, "Slug is too long")
    .regex(categorySlugRegex, "Lowercase letters, numbers, - and _ only")
    .optional()
    .or(z.literal("")),
});

export type ArticleCategoryCreateInput = z.infer<
  typeof articleCategoryCreateSchema
>;

/** Full edit form schema — every field on the article edit screen. */
export const articleEditSchema = z.object({
  title: z
    .string()
    .min(3, "Title is too short")
    .max(160, "Title is too long"),
  slug: z
    .string()
    .min(3, "Slug is too short")
    .max(140, "Slug is too long")
    .regex(slugRegex, "Lowercase letters, numbers, and hyphens only"),
  excerpt: z
    .string()
    .max(320, "Keep it under 320 characters")
    .nullable()
    .optional(),
  category: categoryField,
  body_html: z.string().max(200_000, "Body is too long"),
  hero_image_id: z
    .union([
      z.string().regex(UUID_SHAPE_RE, "Invalid UUID"),
      z.literal(""),
      z.null(),
    ])
    .transform((v) => (v ? v : null))
    .nullable()
    .optional(),
  meta_title: z.string().max(70).nullable().optional(),
  meta_description: z.string().max(180).nullable().optional(),
});

export type ArticleEditInput = z.infer<typeof articleEditSchema>;

/** Strip simple HTML to plain text for word counting / excerpt fallback. */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** ~200 wpm reading pace. Returns at least 1 minute. */
export function readingMinutes(html: string): number {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1;
  return Math.max(1, Math.round(words / 200));
}

/** Use the supplied excerpt; fall back to the first ~240 chars of body. */
export function deriveExcerpt(
  excerpt: string | null | undefined,
  bodyHtml: string,
  maxChars = 240,
): string | null {
  const cleaned = (excerpt ?? "").trim();
  if (cleaned) return cleaned.slice(0, maxChars);
  // Image captions are dropped first. An article that opens with a figure
  // would otherwise take its social preview and meta description from the
  // caption — "Aerial view of the marina, 2026" reads as a stray fragment
  // where a summary of the piece belongs.
  const text = stripHtml(
    bodyHtml.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, " "),
  );
  if (!text) return null;
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/** Pre-validation coercion for the edit form. */
export function normaliseArticleEditInput(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  for (const k of [
    "excerpt",
    "hero_image_id",
    "meta_title",
    "meta_description",
  ] as const) {
    const v = out[k];
    if (v === "" || v === undefined) out[k] = null;
  }

  for (const k of ["title", "slug", "excerpt"] as const) {
    const v = out[k];
    if (typeof v === "string") out[k] = v.trim();
  }

  if (typeof out.body_html !== "string") out.body_html = "";

  return out;
}
