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
import { getTestimonials } from "@/lib/queries/content-sections";
import { testimonialLimitOf } from "@/lib/master-pages/library";
import type { ListingRow } from "@/lib/queries/properties";
import type { ResolvedForm } from "@/lib/forms";
import type { Testimonial } from "@/lib/seeds/awards";
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
};

export type LandingData = {
  propertiesByRef: Map<string, ListingRow>;
  propertiesByQuery: Map<QueryKey, ListingRow[]>;
  developments: DevelopmentRow[];
  forms: Record<string, ResolvedForm>;
  testimonials: Testimonial[];
};

export const EMPTY_LANDING_DATA: LandingData = {
  propertiesByRef: new Map(),
  propertiesByQuery: new Map(),
  developments: [],
  forms: {},
  testimonials: [],
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
  let developments = false;
  let testimonials: number | null = null;

  for (const block of blocks) {
    if (!block.enabled || !block.def) continue;
    const needs = block.def.needs ?? [];
    const values = block.values as Record<string, unknown>;

    if (needs.includes("form")) {
      const key = str(values, "form_key");
      if (key) formKeys.add(key);
    }

    if (needs.includes("developments")) developments = true;

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
 */
export async function resolveLandingData(
  request: LandingDataRequest,
): Promise<LandingData> {
  const [refRows, queryResults, developments, forms, testimonials] =
    await Promise.all([
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
    ]);

  return {
    propertiesByRef: new Map(refRows.map((r) => [r.reference, r])),
    propertiesByQuery: new Map(
      request.queries.map((key, i) => [key, queryResults[i] ?? []]),
    ),
    developments,
    forms,
    testimonials,
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
  async (blocks: ResolvedBlock[]): Promise<LandingData> =>
    resolveLandingData(collectDataRequest(blocks)),
);
