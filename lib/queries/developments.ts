import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseRow } from "@/lib/i18n/localise";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import type { Database } from "@/db/types";
import {
  developmentFactsSchema,
  masterPlanSchema,
  paymentPlanSchema,
  type DevelopmentFacts,
  type MasterPlan,
  type PaymentPlan,
} from "@/lib/schemas/development";
import type {
  DevelopmentUnit as DevelopmentUnitFromUtils,
  UnitFilter as UnitFilterFromUtils,
} from "./development-utils";
import { classifyUnit } from "./development-utils";
import type {
  UnitRowInput,
  UnitStatusInput,
} from "@/lib/schemas/development-inventory";

type DevelopmentStatus = Database["public"]["Enums"]["development_status"];
type UnitStatus = Database["public"]["Enums"]["development_unit_status"];

export type DevelopmentUnit = DevelopmentUnitFromUtils;
export type UnitFilter = UnitFilterFromUtils;

const INDEX_FIELDS =
  "id, name, name_ar, slug, status, handover_date, total_units, starting_price, tagline, tagline_ar, bedrooms_text, bedrooms_text_ar, description, description_ar, published_at, developers:developer_id(name, slug), areas:area_id(name, slug), hero:hero_image_id(storage_key, filename, alt_text, alt_text_ar)";

// `masterplan_id` is joined the same way as `hero_image_id`, because it is
// stored the same way: the CMS's Page images card writes both to columns on
// this row. The page used to look for the site plan among `development_media`
// rows tagged `masterplan` instead, which is a table nothing has ever written
// a masterplan row to — so an uploaded site plan silently never appeared.
/** Exported so a test can pin the media joins — see developments.test.ts. */
export const DETAIL_FIELDS =
  "id, name, name_ar, slug, status, handover_date, total_units, starting_price, tagline, tagline_ar, bedrooms_text, bedrooms_text_ar, description, description_ar, vision, vision_ar, facts, payment_plan, master_plan, amenities, amenities_ar, escrow_account, seo, published_at, developer_id, area_id, lead_advisor_id, hero:hero_image_id(storage_key, filename, alt_text, alt_text_ar), masterplan:masterplan_id(storage_key, filename, alt_text, alt_text_ar), developers:developer_id(id, name, slug, founded_year, description, stats), areas:area_id(name, slug)";

type HeroMedia = {
  storage_key: string;
  filename: string;
  alt_text: string | null;
} | null;

export type DevelopmentIndexRow = {
  id: string;
  name: string;
  slug: string;
  status: DevelopmentStatus;
  handover_date: string | null;
  total_units: number | null;
  starting_price: number | null;
  tagline: string | null;
  bedrooms_text: string | null;
  description: string | null;
  developer: { name: string; slug: string } | null;
  area: { name: string; slug: string } | null;
  hero: HeroMedia;
};

export type DevelopmentDetail = DevelopmentIndexRow & {
  /** Advisor chosen for the page's banner; null falls back to by-area. */
  lead_advisor_id?: string | null;
  /** The site plan picked in the CMS's Page images card. */
  masterplan: HeroMedia;
  vision: string | null;
  facts: DevelopmentFacts;
  payment_plan: PaymentPlan | null;
  master_plan: MasterPlan;
  amenities: string[];
  escrow_account: string | null;
  developer_id: string | null;
  area_id: string | null;
  developer_profile: {
    id: string;
    name: string;
    slug: string;
    founded_year: number | null;
    description: string | null;
    stats: Record<string, unknown> | null;
  } | null;
};

export type FloorPlan = {
  id: string;
  label: string;
  beds: number | null;
  area_ft2: number | null;
  media: HeroMedia;
  /**
   * Set once a plan is filed under a unit type (Sprint 14). The legacy flat
   * "Floor plans" section skips those — they render in "Units & floor plans"
   * instead, and showing the same drawing twice on one page reads as a bug.
   */
  unit_type_id: string | null;
};

export type DevelopmentMedia = {
  role: Database["public"]["Enums"]["development_media_role"];
  sort_order: number;
  media: HeroMedia;
};

/**
 * Resolve a joined `media_assets` row to the shape the page renders.
 *
 * Takes a locale because it is the only place the *nested* alt text can be
 * folded. `localiseRow` is deliberately flat — it walks one level and stops —
 * so the fold applied to the development row above never reaches
 * `raw.hero.alt_text_ar`, and every alt text on /ar would stay English while
 * the surrounding copy translated. Folding here, before the literal is built,
 * is the whole fix; folding after would be discarded by the literal.
 *
 * `localiseDeep` at the row level would also work and is worse: it would
 * recurse into the `facts` / `payment_plan` / `master_plan` jsonb blobs before
 * zod ever sees them.
 */
function pickHero(input: unknown, locale: Locale): HeroMedia {
  if (!input || typeof input !== "object") return null;
  const h = localiseRow(input as Record<string, unknown>, locale);
  if (typeof h.storage_key !== "string") return null;
  return {
    storage_key: h.storage_key,
    filename: String(h.filename ?? ""),
    alt_text: typeof h.alt_text === "string" ? h.alt_text : null,
  };
}

function shapeIndexRow(
  raw: Record<string, unknown>,
  locale: Locale,
): DevelopmentIndexRow {
  return {
    id: raw.id as string,
    name: raw.name as string,
    slug: raw.slug as string,
    status: raw.status as DevelopmentStatus,
    handover_date: (raw.handover_date as string | null) ?? null,
    total_units: (raw.total_units as number | null) ?? null,
    starting_price:
      raw.starting_price != null ? Number(raw.starting_price) : null,
    tagline: (raw.tagline as string | null) ?? null,
    bedrooms_text: (raw.bedrooms_text as string | null) ?? null,
    description: (raw.description as string | null) ?? null,
    developer:
      (raw.developers as { name: string; slug: string } | null) ?? null,
    area: (raw.areas as { name: string; slug: string } | null) ?? null,
    hero: pickHero(raw.hero, locale),
  };
}

/** List all published developments for the public index. */
export async function listPublishedDevelopments(
  opts: {
    /** Narrow to one developer — powers the profile page's projects grid. */
    developerId?: string;
  } = {},
): Promise<DevelopmentIndexRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  let query = supabase
    .from("developments")
    .select(INDEX_FIELDS)
    .not("published_at", "is", null);
  if (opts.developerId) query = query.eq("developer_id", opts.developerId);
  const { data, error } = await query.order("published_at", {
    ascending: false,
  });
  if (error || !data) {
    if (error) console.error("[listPublishedDevelopments]", error);
    return [];
  }
  const locale = await currentLocale();
  return data.map((r) =>
    shapeIndexRow(
      localiseRow(r as unknown as Record<string, unknown>, locale),
      locale,
    ),
  );
}

/** Get a single published development by slug. */
export async function getPublishedDevelopmentBySlug(
  slug: string,
): Promise<DevelopmentDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("developments")
    .select(DETAIL_FIELDS)
    .eq("slug", slug)
    .not("published_at", "is", null)
    .maybeSingle();
  if (error) {
    console.error("[getPublishedDevelopmentBySlug]", error);
    return null;
  }
  if (!data) return null;
  // Folded before shapeDetail, which builds explicit literals and would drop
  // the twins. Fourth shaper in this codebase with that property, after
  // buildMegamenu, reshape and toAgentProfile.
  const locale = await currentLocale();
  return shapeDetail(
    localiseRow(data as unknown as Record<string, unknown>, locale),
    locale,
  );
}

function shapeDetail(
  raw: Record<string, unknown>,
  locale: Locale,
): DevelopmentDetail {
  const base = shapeIndexRow(raw, locale);

  const facts = developmentFactsSchema.safeParse(raw.facts ?? {});
  const masterPlan = masterPlanSchema.safeParse(raw.master_plan ?? {});
  const paymentPlan = paymentPlanSchema.safeParse(raw.payment_plan ?? null);
  // A stored plan that fails to parse is dropped, and dropping it takes the
  // timeline, the hero stat and the FAQ entry with it. That used to happen
  // silently — say so, so the next shape drift is one log line rather than a
  // support ticket. A genuinely absent plan is not a failure worth reporting.
  if (!paymentPlan.success && raw.payment_plan != null) {
    console.warn(
      `[developments] payment_plan on "${raw.slug}" did not match the schema and was dropped:`,
      paymentPlan.error.issues
        .map((i) => `${i.path.join(".") || "plan"}: ${i.message}`)
        .join("; "),
    );
  }

  const dev = (raw.developers as Record<string, unknown> | null) ?? null;

  return {
    ...base,
    // Same shape as the hero, so the same picker validates it.
    masterplan: pickHero(raw.masterplan, locale),
    vision: (raw.vision as string | null) ?? null,
    facts: facts.success ? facts.data : {},
    payment_plan: paymentPlan.success ? paymentPlan.data : null,
    master_plan: masterPlan.success ? masterPlan.data : {},
    amenities: Array.isArray(raw.amenities) ? (raw.amenities as string[]) : [],
    escrow_account: (raw.escrow_account as string | null) ?? null,
    developer_id: (raw.developer_id as string | null) ?? null,
    lead_advisor_id: (raw.lead_advisor_id as string | null) ?? null,
    area_id: (raw.area_id as string | null) ?? null,
    developer_profile: dev
      ? {
          id: String(dev.id),
          name: String(dev.name),
          slug: String(dev.slug),
          founded_year: (dev.founded_year as number | null) ?? null,
          description: (dev.description as string | null) ?? null,
          stats: (dev.stats as Record<string, unknown> | null) ?? null,
        }
      : null,
  };
}

/*
 * One select for both readers, so the public page and the CMS grid cannot drift
 * apart on which columns exist. `getDevelopmentForAdmin` learning about the
 * twins three PRs after the other two selects did is exactly what this avoids.
 *
 * PostgREST's inferred row type does not survive a concatenated string, so the
 * rows are cast to `RawUnit` below — which is the same trade the unit-types
 * reader makes, and the reason both shapes are written out here rather than
 * inferred.
 */
const UNIT_FIELDS =
  "id, unit_type, unit_type_ar, beds, built_up_ft2, plot_ft2, lagoon_access, lagoon_access_ar, " +
  "orientation, orientation_ar, price_aed, plot_number, status, floor_plan_id, sort_order";

type RawUnit = {
  id: string;
  unit_type: string;
  unit_type_ar: string | null;
  beds: number | null;
  built_up_ft2: number | null;
  plot_ft2: number | null;
  lagoon_access: string | null;
  lagoon_access_ar: string | null;
  orientation: string | null;
  orientation_ar: string | null;
  price_aed: number | string | null;
  plot_number: string | null;
  status: UnitStatus;
  floor_plan_id: string | null;
  sort_order: number;
};

/** List units for a development, by sort_order. */
export async function listDevelopmentUnits(
  developmentId: string,
): Promise<DevelopmentUnit[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("development_units")
    .select(UNIT_FIELDS)
    .eq("development_id", developmentId)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  const locale = await currentLocale();
  return (data as unknown as RawUnit[]).map((r) => {
    // Classify from the English, fold after. `classifyUnit`'s rules are
    // English word matches, so doing it the other way round leaves every chip
    // reading zero on /ar with a full table underneath it.
    const categories = classifyUnit(r);
    const t = localiseRow(r, locale);
    return {
      id: t.id,
      unit_type: t.unit_type,
      beds: t.beds,
      built_up_ft2: t.built_up_ft2,
      plot_ft2: t.plot_ft2,
      lagoon_access: t.lagoon_access,
      orientation: t.orientation,
      price_aed: t.price_aed != null ? Number(t.price_aed) : null,
      plot_number: t.plot_number,
      status: t.status,
      floor_plan_id: t.floor_plan_id,
      categories,
    };
  });
}

/**
 * The same rows for the CMS grid — every column, no Arabic fold, and the
 * server client so an unpublished project is still editable.
 */
export async function listDevelopmentUnitsForAdmin(
  developmentId: string,
): Promise<UnitRowInput[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("development_units")
    .select(UNIT_FIELDS)
    .eq("development_id", developmentId)
    .order("sort_order", { ascending: true });
  if (error || !data) {
    if (error) console.error("[listDevelopmentUnitsForAdmin]", error);
    return [];
  }
  return (data as unknown as RawUnit[]).map((r) => {
    return {
      id: r.id,
      unit_type: r.unit_type,
      unit_type_ar: r.unit_type_ar ?? null,
      beds: r.beds,
      built_up_ft2: r.built_up_ft2,
      plot_ft2: r.plot_ft2,
      lagoon_access: r.lagoon_access,
      lagoon_access_ar: r.lagoon_access_ar ?? null,
      orientation: r.orientation,
      orientation_ar: r.orientation_ar ?? null,
      price_aed: r.price_aed != null ? Number(r.price_aed) : null,
      plot_number: r.plot_number,
      status: r.status as UnitStatusInput,
      floor_plan_id: r.floor_plan_id,
    };
  });
}

/** List floor plans for a development. */
export async function listFloorPlans(
  developmentId: string,
): Promise<FloorPlan[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("floor_plans")
    .select(
      "id, label, beds, area_ft2, unit_type_id, media:media_id(storage_key, filename, alt_text, alt_text_ar)",
    )
    .eq("development_id", developmentId)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  const locale = await currentLocale();
  return data.map((r) => {
    const raw = r as unknown as Record<string, unknown>;
    return {
      id: String(raw.id),
      label: String(raw.label),
      beds: (raw.beds as number | null) ?? null,
      area_ft2: (raw.area_ft2 as number | null) ?? null,
      media: pickHero(raw.media, locale),
      unit_type_id: (raw.unit_type_id as string | null) ?? null,
    };
  });
}

/** List media (renders, gallery) for a development. */
export async function listDevelopmentMedia(
  developmentId: string,
): Promise<DevelopmentMedia[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("development_media")
    .select(
      "role, sort_order, media:media_id(storage_key, filename, alt_text, alt_text_ar)",
    )
    .eq("development_id", developmentId)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  const locale = await currentLocale();
  return data.map((r) => {
    const raw = r as unknown as Record<string, unknown>;
    return {
      role: raw.role as DevelopmentMedia["role"],
      sort_order: (raw.sort_order as number) ?? 0,
      media: pickHero(raw.media, locale),
    };
  });
}

/** Admin: list ALL developments (any publish state) for the CMS table. */
export async function listAllDevelopmentsForAdmin(): Promise<
  DevelopmentIndexRow[]
> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developments")
    .select(INDEX_FIELDS)
    .order("created_at", { ascending: false });
  if (error || !data) {
    if (error) console.error("[listAllDevelopmentsForAdmin]", error);
    return [];
  }
  // DEFAULT_LOCALE, not the request locale: this is the CMS grid, which is
  // English by decision (ADR-0007) and where an editor needs to see the
  // English they are about to change.
  return data.map((r) =>
    shapeIndexRow(r as unknown as Record<string, unknown>, DEFAULT_LOCALE),
  );
}

/** Admin: full development row by id (any publish state). */
export async function getDevelopmentForAdmin(id: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developments")
    .select(
      // Its own select, separate from INDEX_FIELDS and DETAIL_FIELDS — which
      // is exactly how the twins were missed when they were added: two of the
      // three selects learned about them and this one did not, so the editor's
      // Arabic inputs loaded nothing on a project that had Arabic.
      "id, name, name_ar, slug, status, handover_date, total_units, starting_price, description, description_ar, tagline, tagline_ar, bedrooms_text, bedrooms_text_ar, vision, vision_ar, amenities, amenities_ar, escrow_account, developer_id, area_id, published_at, facts, payment_plan, master_plan",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// Re-export pure utilities so existing imports keep working.
export {
  developmentUrl,
  filterUnits,
  countUnitsByFilter,
} from "./development-utils";
