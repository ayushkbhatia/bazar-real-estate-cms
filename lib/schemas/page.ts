import { z } from "zod";

const slugRegex = /^[a-z0-9][a-z0-9-/]*[a-z0-9]$/;

/** Block-content schema. Persisted as `pages.blocks` jsonb. */

const ctaSchema = z.object({
  label: z.string().min(1).max(60),
  href: z.string().min(1).max(240),
});

const imageRefSchema = z.object({
  media_id: z.string().nullable().optional(),
  alt: z.string().max(160).nullable().optional(),
  label: z.string().max(80).nullable().optional(),
});

export const heroBlockSchema = z.object({
  type: z.literal("hero"),
  eyebrow: z.string().max(60).nullable().optional(),
  title: z.string().min(1).max(160),
  subtitle: z.string().max(280).nullable().optional(),
  image: imageRefSchema.nullable().optional(),
  cta: ctaSchema.nullable().optional(),
});

export const stripBlockSchema = z.object({
  type: z.literal("strip"),
  eyebrow: z.string().max(60).nullable().optional(),
  heading: z.string().min(1).max(160),
  body: z.string().max(2000).nullable().optional(),
  align: z.enum(["left", "center"]).default("left"),
});

export const splitBlockSchema = z.object({
  type: z.literal("split"),
  eyebrow: z.string().max(60).nullable().optional(),
  heading: z.string().min(1).max(160),
  body: z.string().max(2000).nullable().optional(),
  image: imageRefSchema.nullable().optional(),
  image_side: z.enum(["left", "right"]).default("right"),
});

export const gridBlockSchema = z.object({
  type: z.literal("grid"),
  heading: z.string().max(160).nullable().optional(),
  items: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        body: z.string().max(800).nullable().optional(),
        href: z.string().max(240).nullable().optional(),
      }),
    )
    .min(1)
    .max(12),
});

export const bannerBlockSchema = z.object({
  type: z.literal("banner"),
  title: z.string().min(1).max(160),
  body: z.string().max(800).nullable().optional(),
  cta: ctaSchema.nullable().optional(),
  variant: z.enum(["ink", "accent", "soft"]).default("ink"),
});

export const blockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  stripBlockSchema,
  splitBlockSchema,
  gridBlockSchema,
  bannerBlockSchema,
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockKind = Block["type"];

export const BLOCK_KINDS = [
  "hero",
  "strip",
  "split",
  "grid",
  "banner",
] as const;

export const BLOCK_KIND_LABELS: Record<BlockKind, string> = {
  hero: "Hero",
  strip: "Strip",
  split: "Split",
  grid: "Grid",
  banner: "Banner",
};

/** Sensible defaults for a freshly-added block. */
export function defaultBlockFor(type: BlockKind): Block {
  switch (type) {
    case "hero":
      return {
        type: "hero",
        title: "New hero headline",
        subtitle: null,
        eyebrow: null,
        image: null,
        cta: null,
      };
    case "strip":
      return {
        type: "strip",
        eyebrow: null,
        heading: "New section heading",
        body: null,
        align: "left",
      };
    case "split":
      return {
        type: "split",
        eyebrow: null,
        heading: "New split section",
        body: null,
        image: null,
        image_side: "right",
      };
    case "grid":
      return {
        type: "grid",
        heading: null,
        items: [
          { title: "First item", body: null, href: null },
          { title: "Second item", body: null, href: null },
          { title: "Third item", body: null, href: null },
        ],
      };
    case "banner":
      return {
        type: "banner",
        title: "Banner headline",
        body: null,
        cta: null,
        variant: "ink",
      };
  }
}

/** Coerce a jsonb-stored array into Block[], dropping anything malformed. */
export function parseBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => blockSchema.safeParse(b))
    .filter((r): r is { success: true; data: Block } => r.success)
    .map((r) => r.data);
}

/** Edit-form-level page schema (title, slug, status, SEO; blocks live elsewhere). */
export const PAGE_STATUSES = ["draft", "published"] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

export const pageCreateSchema = z.object({
  title: z.string().min(3, "Title is too short").max(160, "Title is too long"),
  slug: z
    .string()
    .min(2, "Slug is too short")
    .max(140, "Slug is too long")
    .regex(slugRegex, "Lowercase letters, digits, slashes, and hyphens only"),
});

export type PageCreateInput = z.infer<typeof pageCreateSchema>;

export const pageEditSchema = z.object({
  title: z.string().min(3).max(160),
  slug: z
    .string()
    .min(2)
    .max(140)
    .regex(slugRegex, "Lowercase letters, digits, slashes, and hyphens only"),
  meta_title: z.string().max(70).nullable().optional(),
  meta_description: z.string().max(180).nullable().optional(),
});

export type PageEditInput = z.infer<typeof pageEditSchema>;

export function normalisePageEditInput(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const k of ["meta_title", "meta_description"] as const) {
    const v = out[k];
    if (v === "" || v === undefined) out[k] = null;
  }
  for (const k of ["title", "slug"] as const) {
    const v = out[k];
    if (typeof v === "string") out[k] = v.trim();
  }
  return out;
}
