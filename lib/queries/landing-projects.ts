import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseJoins, localiseRow } from "@/lib/i18n/localise";
import type { Locale } from "@/lib/i18n/locales";
import { mediaPublicUrl } from "@/lib/media";
import {
  developmentFactsSchema,
  masterPlanSchema,
  paymentPlanSchema,
  type DevelopmentFacts,
  type MasterPlanPin,
  type PaymentPlan,
} from "@/lib/schemas/development";
import {
  shapeUnitTypesForPage,
  type UnitTypeCard,
} from "./development-unit-plans";

/**
 * Projects as the Page Builder's project sections read them.
 *
 * A campaign page for a launch wants the same payment plan, site plan, floor
 * plans and map pin the project's own page shows — and wants them to stay in
 * step with the record rather than be retyped per campaign. So those sections
 * name a project and read it here.
 *
 * ONE round-trip for every project section on the page, however many there
 * are and however many projects they name. The unit inventory and the unit
 * types ride along as embedded resources, and only when a section on the page
 * asked for them — a page with a site plan and nothing else never pulls a
 * floor plan. Compare the project page itself, which spends six queries on the
 * same facts; a landing page is revalidated on its own timer and has no
 * business multiplying that per section.
 *
 * A read failure answers with no projects rather than throwing: an absent band
 * on an otherwise-fine campaign page is the better outcome than a 500 for the
 * whole page (lib/queries/read-failure.ts draws the same line).
 */

/** Distinct projects one page may read. Past this, sections simply drop. */
export const LANDING_MAX_PROJECTS = 12;

export type LandingProjectImage = { url: string; alt: string | null };

/** A unit on sale, as the payment-plan calculator prices it. */
export type LandingProjectUnit = {
  id: string;
  unitType: string | null;
  beds: number | null;
  builtUpFt2: number | null;
  priceAed: number | null;
};

export type LandingProject = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  vision: string | null;
  developerName: string | null;
  areaName: string | null;
  startingPrice: number | null;
  bedroomsText: string | null;
  totalUnits: number | null;
  handoverDate: string | null;
  facts: DevelopmentFacts;
  /**
   * Kept WITH its `_ar` keys, deliberately. `PaymentPlanSection` finds the
   * handover row by testing the English label, and folds each milestone at
   * the point of display — folding here would mis-split the totals on every
   * Arabic page. See `useMilestoneText` in the project page's `_payment-plan`.
   */
  paymentPlan: PaymentPlan | null;
  masterPlanPins: MasterPlanPin[];
  /** The site plan picked in the project's Page images card. */
  masterplan: LandingProjectImage | null;
  hero: LandingProjectImage | null;
  coords: { lat: number; lng: number } | null;
  /** `meta.floorplan_gated` — layouts blurred behind a lead form. */
  floorplanGated: boolean;
  /** Available units, sort order. Empty unless `units` was asked for. */
  units: LandingProjectUnit[];
  /** Enabled types with layouts. Empty unless `unitTypes` was asked for. */
  unitTypes: UnitTypeCard[];
};

const BASE_FIELDS =
  "id, slug, name, name_ar, tagline, tagline_ar, description, description_ar, vision, vision_ar, starting_price, bedrooms_text, bedrooms_text_ar, total_units, handover_date, facts, payment_plan, master_plan, meta, " +
  "hero:hero_image_id(storage_key, alt_text, alt_text_ar), " +
  "masterplan:masterplan_id(storage_key, alt_text, alt_text_ar), " +
  "developers:developer_id(name, name_ar), areas:area_id(name, name_ar)";

const UNIT_FIELDS =
  "units:development_units(id, unit_type, unit_type_ar, beds, built_up_ft2, price_aed, status, sort_order)";

const UNIT_TYPE_FIELDS =
  "unit_types:development_unit_types(id, label, label_ar, beds, blurb, blurb_ar, size_from_ft2, size_to_ft2, price_from_aed, enabled, sort_order, " +
  "plans:floor_plans(id, label, label_ar, description, description_ar, beds, baths, area_ft2, enabled, sort_order, " +
  "media:media_id(storage_key, alt_text, alt_text_ar, deleted_at)))";

/** Pure: the select for what the page asked for. Exported for its test. */
export function landingProjectSelect(opts: {
  units?: boolean;
  unitTypes?: boolean;
}): string {
  return [
    BASE_FIELDS,
    opts.units ? UNIT_FIELDS : null,
    opts.unitTypes ? UNIT_TYPE_FIELDS : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function image(raw: unknown, locale: Locale): LandingProjectImage | null {
  if (!raw || typeof raw !== "object") return null;
  // One level down, where the row's own fold does not reach.
  const m = localiseRow(raw as Record<string, unknown>, locale);
  if (typeof m.storage_key !== "string") return null;
  return {
    url: mediaPublicUrl(m.storage_key),
    alt: typeof m.alt_text === "string" && m.alt_text.trim() ? m.alt_text : null,
  };
}

function coordsOf(meta: unknown): { lat: number; lng: number } | null {
  const c = (meta as { coords?: { lat?: unknown; lng?: unknown } } | null)
    ?.coords;
  if (!c) return null;
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

type RawUnit = {
  id: string;
  unit_type: string | null;
  unit_type_ar?: string | null;
  beds: number | null;
  built_up_ft2: number | null;
  price_aed: number | string | null;
  status: string;
  sort_order: number | null;
};

/**
 * Shape one raw row. Exported so the fold test runs the real shaper against a
 * fixture rather than a stand-in.
 */
export function shapeLandingProject(
  raw: Record<string, unknown>,
  locale: Locale,
): LandingProject {
  // Folded before the literal below is built — a shaper that builds explicit
  // literals drops any twin it was not told about, so folding after it would
  // silently do nothing. The joined developer and area sit one level down.
  const row = localiseJoins(localiseRow(raw, locale), ["developers", "areas"], locale);

  const facts = developmentFactsSchema.safeParse(row.facts ?? {});
  const masterPlan = masterPlanSchema.safeParse(row.master_plan ?? {});
  const paymentPlan = paymentPlanSchema.safeParse(row.payment_plan ?? null);
  const meta = (row.meta as Record<string, unknown> | null) ?? null;

  const units = (Array.isArray(row.units) ? (row.units as RawUnit[]) : [])
    .filter((u) => u.status === "available")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((u) => {
      const t = localiseRow(u as unknown as Record<string, unknown>, locale) as unknown as RawUnit;
      return {
        id: t.id,
        unitType: t.unit_type ?? null,
        beds: t.beds ?? null,
        builtUpFt2: t.built_up_ft2 ?? null,
        priceAed: t.price_aed != null ? Number(t.price_aed) : null,
      };
    });

  const str = (key: string) => {
    const v = row[key];
    return typeof v === "string" && v.trim() !== "" ? v : null;
  };

  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    tagline: str("tagline"),
    description: str("description"),
    vision: str("vision"),
    developerName:
      (row.developers as { name?: string } | null)?.name ?? null,
    areaName: (row.areas as { name?: string } | null)?.name ?? null,
    startingPrice:
      row.starting_price != null ? Number(row.starting_price) : null,
    bedroomsText: str("bedrooms_text"),
    totalUnits: (row.total_units as number | null) ?? null,
    handoverDate: str("handover_date"),
    facts: facts.success ? facts.data : {},
    paymentPlan: paymentPlan.success ? paymentPlan.data : null,
    masterPlanPins: masterPlan.success ? (masterPlan.data.pins ?? []) : [],
    masterplan: image(row.masterplan, locale),
    hero: image(row.hero, locale),
    coords: coordsOf(meta),
    floorplanGated: meta?.floorplan_gated === true,
    units,
    unitTypes: shapeUnitTypesForPage(row.unit_types, locale),
  };
}

type ReadOptions = { units?: boolean; unitTypes?: boolean; locale?: Locale };

async function readProjects(
  slugs: string[] | null,
  opts: ReadOptions,
  caller: string,
): Promise<LandingProject[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createSupabasePublicClient();
    let query = supabase
      .from("developments")
      .select(landingProjectSelect(opts))
      .not("published_at", "is", null);
    if (slugs) query = query.in("slug", slugs);
    // Filters on the EMBEDDED rows, not the projects: a project with nothing
    // on sale still comes back, with an empty inventory.
    if (opts.units) query = query.eq("units.status", "available");
    if (opts.unitTypes) query = query.eq("unit_types.enabled", true);

    const { data, error } = await query;
    if (error || !data) {
      if (error) console.error(`[${caller}]`, error);
      return [];
    }
    const locale = opts.locale ?? (await currentLocale());
    return (data as unknown as Record<string, unknown>[]).map((raw) =>
      shapeLandingProject(raw, locale),
    );
  } catch (error) {
    console.error(`[${caller}]`, error);
    return [];
  }
}

/**
 * Published projects by slug, for the page's project sections. Order is not
 * meaningful — each section looks its project up by slug.
 */
export async function listLandingProjects(
  slugs: string[],
  opts: ReadOptions = {},
): Promise<LandingProject[]> {
  if (slugs.length === 0) return [];
  return readProjects(
    slugs.slice(0, LANDING_MAX_PROJECTS),
    opts,
    "listLandingProjects",
  );
}

/**
 * Every published project, shaped the same way — for the Page Builder EDITOR,
 * which has to say which projects lack a payment plan or a site plan before
 * anyone picks one. Same shaper as the page itself, so the editor's "this
 * project has no floor plans" and the page's missing section are one fact.
 */
export async function listAllLandingProjects(
  opts: ReadOptions = {},
): Promise<LandingProject[]> {
  return readProjects(null, opts, "listAllLandingProjects");
}
