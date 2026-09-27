/**
 * The batched data resolver — the egress guardrail.
 *
 * Every data-backed block declares what it wants (`BlockDef.needs`) and fetches
 * nothing itself. This module walks the whole document first, unions and dedups
 * the requests, and then issues a fixed, small number of queries. Rendering
 * reads from the resulting maps.
 *
 * That split matters more here than it looks. None of `lib/queries/developments`,
 * `areas-guide`, `curated-listings` or `featured-properties` wraps anything in
 * React `cache()`, so a component calling one of them twice really does make two
 * round-trips. A page with eight featured rails would be eight joined catalogue
 * queries on every revalidation — and the joins are not small: `LISTING_FIELDS`
 * pulls a nested `property_media` for every role and throws all but the hero
 * away.
 *
 * Ceiling: at most 6 catalogue fetches for any page, any number of blocks.
 * Forms ride free — `lib/queries/forms.ts` already `cache()`s its loader.
 */

import { cache } from "react";
import {
  listExclusiveProperties,
  listNewThisWeek,
  listPriceDrops,
} from "@/lib/queries/curated-listings";
import { listPropertiesByReference } from "@/lib/queries/featured-properties";
import { listPublishedDevelopments } from "@/lib/queries/developments";
import { getForms } from "@/lib/queries/forms";
import { getPartners, getTestimonials } from "@/lib/queries/content-sections";
import {
  LANDING_MAX_PROJECTS,
  listLandingProjects,
  type LandingProject,
} from "@/lib/queries/landing-projects";
import { listAgents, type AgentProfile } from "@/lib/queries/agents";
import { testimonialLimitOf } from "@/lib/master-pages/library";
import type { ListingRow } from "@/lib/queries/properties";
import type { ResolvedForm } from "@/lib/forms";
import type { ResolvedPartner } from "@/lib/partners/directory-data";
import type { Testimonial } from "@/lib/seeds/awards";
import type { Locale } from "@/lib/i18n/locales";
import type { ResolvedBlock } from "./types";

type DevelopmentRow = Awaited<ReturnType<typeof listPublishedDevelopments>>[number];

/** `${source}:${limit}` — two identical rails collapse to one fetch. */
type QueryKey = string;

export type LandingDataRequest = {
  propertyRefs: string[];
  queries: QueryKey[];
  developments: boolean;
  formKeys: string[];
  /**
   * How many reviews the hungriest testimonial block on the page wants. Null
   * means no block asked. One number rather than one request per block: the
   * list is shared, so the largest slice covers every block that reads it.
   */
  testimonials: number | null;
  /** Whether any block shows the shared partner logos. */
  partners: boolean;
  /**
   * Every project a project section names, deduped. One read serves them
   * all; the two flags below only widen what that read embeds.
   */
  projects: string[];
  /** Some section prices units — embed each project's available inventory. */
  projectUnits: boolean;
  /** Some section draws layouts — embed each project's unit types and plans. */
  projectUnitTypes: boolean;
  /** Advisor slugs, deduped. Non-empty means one roster read. */
  advisors: string[];
};

export type LandingData = {
  propertiesByRef: Map<string, ListingRow>;
  propertiesByQuery: Map<QueryKey, ListingRow[]>;
  developments: DevelopmentRow[];
  forms: Record<string, ResolvedForm>;
  testimonials: Testimonial[];
  partners: ResolvedPartner[];
  projectsBySlug: Map<string, LandingProject>;
  advisorsBySlug: Map<string, AgentProfile>;
};

export const EMPTY_LANDING_DATA: LandingData = {
  propertiesByRef: new Map(),
  propertiesByQuery: new Map(),
  developments: [],
  forms: {},
  testimonials: [],
  partners: [],
  projectsBySlug: new Map(),
  advisorsBySlug: new Map(),
};

/**
 * `listPropertiesByReference` caps its filter at 24, so this is the point past
 * which extra picks would be silently dropped. The catalogue already caps each
 * block's picks at 12; this is the whole-page ceiling.
 */
export const LANDING_MAX_REFS = 24;

function str(values: Record<string, unknown>, key: string): string | null {
  const v = values[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Pure: what the whole document needs, deduped. No I/O. */
export function collectDataRequest(
  blocks: ResolvedBlock[],
): LandingDataRequest {
  const propertyRefs = new Set<string>();
  const queries = new Set<QueryKey>();
  const formKeys = new Set<string>();
  const projects = new Set<string>();
  const advisors = new Set<string>();
  let developments = false;
  let testimonials: number | null = null;
  let partners = false;
  let projectUnits = false;
  let projectUnitTypes = false;

  for (const block of blocks) {
    if (!block.enabled || !block.def) continue;
    const needs = block.def.needs ?? [];
    const values = block.values as Record<string, unknown>;

    if (needs.includes("form")) {
      const key = str(values, "form_key");
      if (key) formKeys.add(key);
    }

    if (needs.includes("developments")) developments = true;

    if (needs.includes("partners")) partners = true;

    // A project section with no project picked asks for nothing — it renders
    // nothing either, and the editor and the gate say so (content-gap.ts).
    if (needs.includes("project")) {
      const slug = str(values, "development");
      if (slug) {
        projects.add(slug);
        if (needs.includes("project_units")) projectUnits = true;
        if (needs.includes("project_unit_types")) projectUnitTypes = true;
      }
    }

    if (needs.includes("advisor")) {
      const slug = str(values, "agent");
      if (slug) advisors.add(slug);
    }

    if (needs.includes("testimonials")) {
      const want = testimonialLimitOf(str(values, "limit"));
      testimonials = Math.max(testimonials ?? 0, want);
    }

    if (needs.includes("properties_picked") || needs.includes("properties_query")) {
      const source = str(values, "source") ?? "picked";
      if (source === "picked") {
        const picks = Array.isArray(values.picks) ? values.picks : [];
        for (const pick of picks) {
          const ref = str((pick ?? {}) as Record<string, unknown>, "slug");
          if (ref) propertyRefs.add(ref);
        }
      } else {
        queries.add(`${source}:${str(values, "limit") ?? "4"}`);
      }
    }
  }

  return {
    propertyRefs: [...propertyRefs].slice(0, LANDING_MAX_REFS),
    queries: [...queries],
    developments,
    formKeys: [...formKeys],
    testimonials,
    partners,
    projects: [...projects].slice(0, LANDING_MAX_PROJECTS),
    projectUnits,
    projectUnitTypes,
    advisors: [...advisors],
  };
}

async function runQuery(key: QueryKey): Promise<ListingRow[]> {
  const [source, rawLimit] = key.split(":");
  const limit = Number.parseInt(rawLimit ?? "4", 10) || 4;
  switch (source) {
    case "exclusive":
      return listExclusiveProperties({ limit });
    case "new_this_week":
      return listNewThisWeek({ limit });
    case "price_drops":
      return listPriceDrops({ limit });
    default:
      return [];
  }
}

/**
 * Issue the fetches.
 *
 * Each `?:` is load-bearing: a page with no live-inventory block must make
 * *zero* catalogue queries, not four empty ones.
 *
 * `locale` is the route's, passed down rather than read ambiently by the newer
 * readers: an ambient read that falls through to `headers()` takes a
 * prerendered route dynamic (lib/queries/areas-guide.ts records one that did).
 * The older readers here still resolve it themselves, which they always have.
 */
export async function resolveLandingData(
  request: LandingDataRequest,
  locale?: Locale,
): Promise<LandingData> {
  const [
    refRows,
    queryResults,
    developments,
    forms,
    testimonials,
    partners,
    projects,
    roster,
  ] = await Promise.all([
    request.propertyRefs.length > 0
      ? listPropertiesByReference(request.propertyRefs)
      : Promise.resolve([] as ListingRow[]),
    Promise.all(request.queries.map((key) => runQuery(key))),
    request.developments
      ? listPublishedDevelopments()
      : Promise.resolve([] as DevelopmentRow[]),
    request.formKeys.length > 0
      ? getForms(request.formKeys)
      : Promise.resolve({} as Record<string, ResolvedForm>),
    request.testimonials !== null
      ? getTestimonials(request.testimonials)
      : Promise.resolve([] as Testimonial[]),
    request.partners
      ? getPartners(locale)
      : Promise.resolve([] as ResolvedPartner[]),
    request.projects.length > 0
      ? listLandingProjects(request.projects, {
          units: request.projectUnits,
          unitTypes: request.projectUnitTypes,
          locale,
        })
      : Promise.resolve([] as LandingProject[]),
    request.advisors.length > 0
      ? listAgents(locale)
      : Promise.resolve([] as AgentProfile[]),
  ]);

  const wanted = new Set(request.advisors);
  return {
    propertiesByRef: new Map(refRows.map((r) => [r.reference, r])),
    propertiesByQuery: new Map(
      request.queries.map((key, i) => [key, queryResults[i] ?? []]),
    ),
    developments,
    forms,
    testimonials,
    partners,
    projectsBySlug: new Map(projects.map((p) => [p.slug, p])),
    // The roster is small and read whole; only the advisors a block named are
    // kept, so nothing else about the team rides into the page.
    advisorsBySlug: new Map(
      roster.filter((a) => wanted.has(a.slug)).map((a) => [a.slug, a]),
    ),
  };
}

/**
 * One page, one call.
 *
 * `cache()`-wrapped on the *blocks* array, which is stable within a render, so
 * the public route and the admin preview can each call it wherever it reads
 * best without doubling the queries.
 */
export const loadLandingData = cache(
  async (blocks: ResolvedBlock[], locale?: Locale): Promise<LandingData> =>
    resolveLandingData(collectDataRequest(blocks), locale),
);
