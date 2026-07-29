import { z } from "zod";
import { uuidLike } from "@/lib/uuid";

/**
 * Schemas + shaped types for the CMS-editable megamenu.
 *
 *   tabs (10)  →  columns (per tab, zone left|right)  →  items (per column)
 *                                                    →  featured_tiles (per tab)
 *
 * The public-side renderer consumes `Megamenu` (the shaped tree) from
 * `lib/queries/megamenu.ts`. The admin editor uses the *EditInput schemas to
 * validate writes before they hit `app/(admin)/admin/navigation/_actions.ts`.
 */

// ───────────────────────────────────────────────────────────────
// Enums (single source — matches the Postgres enums in 0031)
// ───────────────────────────────────────────────────────────────
export const MEGAMENU_ZONES = ["left", "right"] as const;
export type MegamenuZone = (typeof MEGAMENU_ZONES)[number];

export const MEGAMENU_TARGET_KINDS = [
  "area",
  "developer",
  "service",
  "property_type",
  "transaction",
  "page",
  "development",
  "article",
  "external",
] as const;
export type MegamenuTargetKind = (typeof MEGAMENU_TARGET_KINDS)[number];

export const MEGAMENU_BADGE_VARIANTS = [
  "default",
  "hot",
  "luxury",
  "new",
  "trending",
  "partner",
] as const;
export type MegamenuBadgeVariant = (typeof MEGAMENU_BADGE_VARIANTS)[number];

export const MEGAMENU_TILE_VARIANTS = ["dark", "light", "image"] as const;
export type MegamenuTileVariant = (typeof MEGAMENU_TILE_VARIANTS)[number];

export const MEGAMENU_TILE_BADGE_KINDS = ["dot", "icon", "none"] as const;
export type MegamenuTileBadgeKind = (typeof MEGAMENU_TILE_BADGE_KINDS)[number];

export const MEGAMENU_TAB_STATUSES = ["draft", "published"] as const;
export type MegamenuTabStatus = (typeof MEGAMENU_TAB_STATUSES)[number];

// Map badge variant → readable display label. Used in the admin picker.
export const MEGAMENU_BADGE_VARIANT_LABELS: Record<MegamenuBadgeVariant, string> = {
  default: "Default",
  hot: "Hot",
  luxury: "Luxury",
  new: "New",
  trending: "Trending",
  partner: "Partner",
};

// ───────────────────────────────────────────────────────────────
// Shaped read types — what the public-side renderer consumes.
// ───────────────────────────────────────────────────────────────
export type MegamenuItem = {
  id: string;
  position: number;
  label: string;
  href: string;
  target_kind: MegamenuTargetKind | null;
  target_id: string | null;
  icon: string | null;
  badge_label: string | null;
  badge_variant: MegamenuBadgeVariant;
};

export type MegamenuColumn = {
  id: string;
  zone: MegamenuZone;
  position: number;
  heading: string | null;
  items: MegamenuItem[];
};

export type MegamenuFeaturedTile = {
  id: string;
  position: number;
  variant: MegamenuTileVariant;
  badge_label: string | null;
  badge_kind: MegamenuTileBadgeKind;
  headline: string;
  href: string;
  media_asset_id: string | null;
  cta_label: string | null;
};

export type MegamenuTab = {
  id: string;
  slug: string;
  label: string;
  href: string | null;
  has_panel: boolean;
  position: number;
  panel_title: string | null;
  panel_title_href: string | null;
  right_column_title: string | null;
  status: MegamenuTabStatus;
  // Grouped for the renderer — left[] and right[] (each ordered by position).
  columns: { left: MegamenuColumn[]; right: MegamenuColumn[] };
  featured: MegamenuFeaturedTile[];
};

export type Megamenu = {
  tabs: MegamenuTab[];
};

// ───────────────────────────────────────────────────────────────
// Write schemas — used by the admin server actions to validate input.
// Keep the constraints in sync with the SQL column types.
// ───────────────────────────────────────────────────────────────
export const tabMetaEditSchema = z.object({
  label: z.string().min(1).max(60),
  href: z.string().max(240).nullable().optional(),
  has_panel: z.boolean(),
  panel_title: z.string().max(160).nullable().optional(),
  panel_title_href: z.string().max(240).nullable().optional(),
  right_column_title: z.string().max(80).nullable().optional(),
});
export type TabMetaEditInput = z.infer<typeof tabMetaEditSchema>;

export const itemEditSchema = z.object({
  id: uuidLike().optional(), // optional for newly-created rows
  position: z.number().int().min(0),
  label: z.string().min(1).max(120),
  href: z.string().min(1).max(240),
  target_kind: z.enum(MEGAMENU_TARGET_KINDS).nullable().optional(),
  target_id: uuidLike().nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
  badge_label: z.string().max(40).nullable().optional(),
  badge_variant: z.enum(MEGAMENU_BADGE_VARIANTS).default("default"),
});
export type ItemEditInput = z.infer<typeof itemEditSchema>;

export const columnEditSchema = z.object({
  id: uuidLike().optional(),
  zone: z.enum(MEGAMENU_ZONES),
  position: z.number().int().min(0),
  heading: z.string().max(80).nullable().optional(),
  items: z.array(itemEditSchema).min(0).max(50),
});
export type ColumnEditInput = z.infer<typeof columnEditSchema>;

export const featuredTileEditSchema = z.object({
  id: uuidLike().optional(),
  position: z.number().int().min(0).max(1),
  variant: z.enum(MEGAMENU_TILE_VARIANTS).default("dark"),
  badge_label: z.string().max(40).nullable().optional(),
  badge_kind: z.enum(MEGAMENU_TILE_BADGE_KINDS).default("dot"),
  headline: z.string().min(1).max(120),
  href: z.string().min(1).max(240),
  media_asset_id: uuidLike().nullable().optional(),
  cta_label: z.string().max(40).nullable().optional(),
});
export type FeaturedTileEditInput = z.infer<typeof featuredTileEditSchema>;

/** Whole-tab editor payload — sent in a single transactional save. */
export const tabEditPayloadSchema = z.object({
  meta: tabMetaEditSchema,
  columns: z.array(columnEditSchema).min(0).max(8),
  featured: z.array(featuredTileEditSchema).min(0).max(2),
});
export type TabEditPayload = z.infer<typeof tabEditPayloadSchema>;

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
export function defaultNewItem(position: number): ItemEditInput {
  return {
    position,
    label: "New link",
    href: "#",
    target_kind: "external",
    target_id: null,
    icon: null,
    badge_label: null,
    badge_variant: "default",
  };
}

export function defaultNewColumn(
  zone: MegamenuZone,
  position: number,
): ColumnEditInput {
  return {
    zone,
    position,
    heading: null,
    items: [defaultNewItem(0)],
  };
}

export function defaultNewFeaturedTile(position: number): FeaturedTileEditInput {
  return {
    position,
    variant: position === 0 ? "dark" : "light",
    badge_label: null,
    badge_kind: "dot",
    headline: "New tile",
    href: "#",
    media_asset_id: null,
    cta_label: null,
  };
}
