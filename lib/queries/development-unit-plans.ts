import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import {
  MAX_PLANS_SHOWN,
  seedUnitTypes,
  type UnitTypeInput,
} from "@/lib/schemas/development-unit-plans";

/**
 * Reads for `developments > unit types > floor plans`.
 *
 * Two shapes, because the two callers want different things: the public page
 * wants only what is switched on, with media resolved to URLs and the layout
 * count already trimmed to what it renders; the CMS wants everything,
 * including the switched-off rows it has to draw a toggle for.
 */

export type PlanCard = {
  id: string;
  label: string;
  description: string | null;
  beds: number | null;
  baths: number | null;
  area_ft2: number | null;
  image_url: string | null;
  image_alt: string | null;
  /** Kept alongside the URL because the gated card rebuilds its own. */
  image_key: string | null;
};

export type UnitTypeCard = {
  id: string;
  label: string;
  beds: number | null;
  blurb: string | null;
  size_from_ft2: number | null;
  size_to_ft2: number | null;
  price_from_aed: number | null;
  plans: PlanCard[];
  /** True when nothing is stored and these are derived placeholders. */
  placeholder: boolean;
};

const SELECT_FIELDS =
  "id, label, beds, blurb, size_from_ft2, size_to_ft2, price_from_aed, enabled, sort_order, " +
  "plans:floor_plans(id, label, description, beds, baths, area_ft2, enabled, sort_order, " +
  "media:media_id(storage_key, alt_text, deleted_at))";

type RawPlan = {
  id: string;
  label: string;
  description: string | null;
  beds: number | null;
  baths: number | null;
  area_ft2: number | null;
  enabled: boolean;
  sort_order: number;
  media: {
    storage_key: string;
    alt_text: string | null;
    deleted_at: string | null;
  } | null;
};

type RawType = {
  id: string;
  label: string;
  beds: number | null;
  blurb: string | null;
  size_from_ft2: number | null;
  size_to_ft2: number | null;
  price_from_aed: number | string | null;
  enabled: boolean;
  sort_order: number;
  plans: RawPlan[] | null;
};

function shapePlan(p: RawPlan): PlanCard {
  // A trashed asset falls back to the placeholder rather than a broken image.
  const media = p.media && !p.media.deleted_at ? p.media : null;
  return {
    id: p.id,
    label: p.label,
    description: p.description,
    beds: p.beds,
    baths: p.baths,
    area_ft2: p.area_ft2,
    image_url: media ? mediaPublicUrl(media.storage_key) : null,
    image_alt: media?.alt_text ?? null,
    image_key: media?.storage_key ?? null,
  };
}

const bySortOrder = (a: { sort_order: number }, b: { sort_order: number }) =>
  a.sort_order - b.sort_order;

/**
 * What the public section renders. Switched-off types and layouts are dropped,
 * and each type is trimmed to the four layouts the design shows.
 *
 * A type with no layouts at all is dropped too: a button that opens onto
 * nothing is worse than one fewer button.
 */
export async function listUnitTypesForPage(
  developmentId: string,
): Promise<UnitTypeCard[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("development_unit_types")
    .select(SELECT_FIELDS)
    .eq("development_id", developmentId)
    .eq("enabled", true)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    if (error) console.error("[listUnitTypesForPage]", error);
    return [];
  }

  return (data as unknown as RawType[])
    .sort(bySortOrder)
    .map((t) => ({
      id: t.id,
      label: t.label,
      beds: t.beds,
      blurb: t.blurb,
      size_from_ft2: t.size_from_ft2,
      size_to_ft2: t.size_to_ft2,
      price_from_aed: t.price_from_aed != null ? Number(t.price_from_aed) : null,
      plans: (t.plans ?? [])
        .filter((p) => p.enabled)
        .sort(bySortOrder)
        .slice(0, MAX_PLANS_SHOWN)
        .map(shapePlan),
      placeholder: false,
    }))
    .filter((t) => t.plans.length > 0);
}

/**
 * Placeholder cards for a project that has no unit types stored.
 *
 * Migration 0081 seeds real, editable rows for everything in the catalogue
 * when the feature ships, so in practice this covers a project created
 * afterwards — or one whose types were all deleted. Deriving from
 * `bedrooms_text` means even those pages say something true about the project
 * rather than showing a hole where a section should be.
 */
export function placeholderUnitTypes(bedroomsText: string | null): UnitTypeCard[] {
  return seedUnitTypes(bedroomsText).map((t, i) => ({
    id: `placeholder-${i}`,
    label: t.label,
    beds: t.beds,
    blurb: t.blurb,
    size_from_ft2: null,
    size_to_ft2: null,
    price_from_aed: null,
    plans: t.plans.map((p, j) => ({
      id: `placeholder-${i}-${j}`,
      label: p.label,
      description: p.description,
      beds: p.beds,
      baths: null,
      area_ft2: null,
      image_url: null,
      image_alt: null,
      image_key: null,
    })),
    placeholder: true,
  }));
}

/**
 * Everything on the record, switched-off rows included — the shape the CMS
 * card edits and posts back. Ids are carried through so a save can tell an
 * edit from an insert.
 */
export async function listUnitTypesForAdmin(
  developmentId: string,
): Promise<UnitTypeInput[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("development_unit_types")
    .select(
      "id, label, beds, blurb, size_from_ft2, size_to_ft2, price_from_aed, enabled, sort_order, " +
        "plans:floor_plans(id, label, description, beds, baths, area_ft2, media_id, enabled, sort_order)",
    )
    .eq("development_id", developmentId)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    if (error) console.error("[listUnitTypesForAdmin]", error);
    return [];
  }

  type AdminPlan = Omit<RawPlan, "media"> & { media_id: string | null };
  type AdminType = Omit<RawType, "plans"> & { plans: AdminPlan[] | null };

  return (data as unknown as AdminType[]).sort(bySortOrder).map((t) => ({
    id: t.id,
    label: t.label,
    beds: t.beds,
    blurb: t.blurb,
    size_from_ft2: t.size_from_ft2,
    size_to_ft2: t.size_to_ft2,
    price_from_aed: t.price_from_aed != null ? Number(t.price_from_aed) : null,
    enabled: t.enabled,
    plans: (t.plans ?? []).sort(bySortOrder).map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      beds: p.beds,
      baths: p.baths,
      area_ft2: p.area_ft2,
      media_id: p.media_id,
      enabled: p.enabled,
    })),
  }));
}
