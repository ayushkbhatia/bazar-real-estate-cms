import { z } from "zod";

export const ARTICLE_CATEGORIES = [
  "market_report",
  "buyers_guide",
  "sellers_guide",
  "field_note",
  "policy",
  "off_plan_watch",
] as const;

export const ARTICLE_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "archived",
] as const;

export const ARTICLE_CATEGORY_LABELS: Record<
  (typeof ARTICLE_CATEGORIES)[number],
  string
> = {
  market_report: "Market report",
  buyers_guide: "Buyer's guide",
  sellers_guide: "Seller's guide",
  field_note: "Field note",
  policy: "Policy & regulation",
  off_plan_watch: "Off-plan watch",
};

const slugRegex = /^[a-z0-9-]+$/;
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Minimal payload to create a new article — the editor fills the rest. */
export const articleCreateSchema = z.object({
  title: z
    .string()
    .min(3, "Title is too short")
    .max(160, "Title is too long"),
  category: z.enum(ARTICLE_CATEGORIES),
});

export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;

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
  category: z.enum(ARTICLE_CATEGORIES),
  body_html: z.string().max(200_000, "Body is too long"),
  hero_image_id: z
    .union([
      z.string().regex(uuidRegex, "Invalid UUID"),
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
  const text = stripHtml(bodyHtml);
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
