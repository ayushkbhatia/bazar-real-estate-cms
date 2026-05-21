/**
 * Deterministic property scoring against a concierge brief.
 *
 * Pure functions — no DB, no LLM. The LLM picks WHICH properties to evaluate
 * (via `search_properties` / `semantic_search`), and the scoring tool
 * (`score_against_brief`) calls these helpers to attach scores + factor
 * breakdowns deterministically. That keeps "94 match" reproducible and
 * keeps cost down: we don't pay token budget for arithmetic.
 */
import type { ConciergeBrief } from "./brief";

export type ScorableProperty = {
  id: string;
  reference: string;
  title: string;
  price_aed: number;
  mode: "buy" | "rent" | "off_plan" | "commercial";
  type: string;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  amenities: string[];
  flags: {
    exclusive?: boolean;
    vacant_on_transfer?: boolean;
    mortgage_eligible?: boolean;
  } | null;
  area_slug: string | null;
  area_name: string | null;
};

export type FactorStatus = "match" | "partial" | "miss";

export type Factor = {
  label: string;
  status: FactorStatus;
  weight: number; // 0..1; the factor's share of the total score
};

export type PropertyScore = {
  property_id: string;
  score: number; // 0..100, rounded to integer
  factors: Factor[];
};

const FACTOR_WEIGHTS = {
  area: 0.25,
  beds: 0.15,
  price: 0.2,
  amenities: 0.2,
  flags: 0.1,
  mode: 0.1,
} as const;

/** Score a single property against the brief. */
export function scoreProperty(
  property: ScorableProperty,
  brief: ConciergeBrief,
): PropertyScore {
  const factors: Factor[] = [];
  let totalWeight = 0;
  let weightedScore = 0;

  // Area
  if (brief.area_slugs && brief.area_slugs.length > 0) {
    const status: FactorStatus =
      property.area_slug != null && brief.area_slugs.includes(property.area_slug)
        ? "match"
        : "miss";
    factors.push({
      label: status === "match"
        ? `In ${property.area_name ?? property.area_slug ?? "target area"}`
        : `Not in ${brief.area_slugs.join(", ")}`,
      status,
      weight: FACTOR_WEIGHTS.area,
    });
    totalWeight += FACTOR_WEIGHTS.area;
    weightedScore += factorValue(status) * FACTOR_WEIGHTS.area;
  }

  // Beds
  if (brief.beds_min != null || brief.beds_max != null) {
    const min = brief.beds_min ?? 0;
    const max = brief.beds_max ?? 50;
    let status: FactorStatus = "match";
    if (property.beds < min || property.beds > max) {
      // One step outside the range still earns "partial".
      if (property.beds === min - 1 || property.beds === max + 1) status = "partial";
      else status = "miss";
    }
    factors.push({
      label:
        status === "match"
          ? `${property.beds}-bed (in range)`
          : `${property.beds}-bed (target ${min}-${max})`,
      status,
      weight: FACTOR_WEIGHTS.beds,
    });
    totalWeight += FACTOR_WEIGHTS.beds;
    weightedScore += factorValue(status) * FACTOR_WEIGHTS.beds;
  }

  // Price
  if (brief.price_min != null || brief.price_max != null) {
    const min = brief.price_min ?? 0;
    const max = brief.price_max ?? Number.POSITIVE_INFINITY;
    let status: FactorStatus = "match";
    if (property.price_aed < min) status = "partial"; // under-budget = OK-ish
    else if (property.price_aed > max) {
      // Within 10% of cap = partial; beyond = miss.
      status = property.price_aed <= max * 1.1 ? "partial" : "miss";
    }
    factors.push({
      label:
        status === "match"
          ? "Within budget"
          : status === "partial"
            ? "Just outside budget"
            : "Out of budget",
      status,
      weight: FACTOR_WEIGHTS.price,
    });
    totalWeight += FACTOR_WEIGHTS.price;
    weightedScore += factorValue(status) * FACTOR_WEIGHTS.price;
  }

  // Amenities
  if (brief.must_have_amenities && brief.must_have_amenities.length > 0) {
    const required = brief.must_have_amenities.map((a) => a.toLowerCase());
    const haveLower = property.amenities.map((a) => a.toLowerCase());
    const matched = required.filter((req) =>
      haveLower.some((have) => have.includes(req) || req.includes(have)),
    );
    const ratio = matched.length / required.length;
    const status: FactorStatus =
      ratio >= 0.99 ? "match" : ratio > 0 ? "partial" : "miss";
    factors.push({
      label:
        status === "match"
          ? `All ${required.length} requested amenities`
          : `${matched.length} of ${required.length} amenities`,
      status,
      weight: FACTOR_WEIGHTS.amenities,
    });
    totalWeight += FACTOR_WEIGHTS.amenities;
    weightedScore += ratio * FACTOR_WEIGHTS.amenities;
  }

  // Flags
  if (brief.flags) {
    const requested: ("exclusive" | "vacant_on_transfer" | "mortgage_eligible")[] =
      [];
    if (brief.flags.exclusive) requested.push("exclusive");
    if (brief.flags.vacant_on_transfer) requested.push("vacant_on_transfer");
    if (brief.flags.mortgage_eligible) requested.push("mortgage_eligible");
    if (requested.length > 0) {
      const propFlags = property.flags ?? {};
      const matched = requested.filter((k) => propFlags[k]);
      const ratio = matched.length / requested.length;
      const status: FactorStatus =
        ratio >= 0.99 ? "match" : ratio > 0 ? "partial" : "miss";
      factors.push({
        label:
          status === "match"
            ? `All ${requested.length} flagged criteria`
            : `${matched.length} of ${requested.length} flags`,
        status,
        weight: FACTOR_WEIGHTS.flags,
      });
      totalWeight += FACTOR_WEIGHTS.flags;
      weightedScore += ratio * FACTOR_WEIGHTS.flags;
    }
  }

  // Mode
  if (brief.mode) {
    const status: FactorStatus = property.mode === brief.mode ? "match" : "miss";
    factors.push({
      label: status === "match" ? `For ${brief.mode}` : `For ${property.mode}, brief is ${brief.mode}`,
      status,
      weight: FACTOR_WEIGHTS.mode,
    });
    totalWeight += FACTOR_WEIGHTS.mode;
    weightedScore += factorValue(status) * FACTOR_WEIGHTS.mode;
  }

  const score =
    totalWeight === 0 ? 50 : Math.round((weightedScore / totalWeight) * 100);

  return {
    property_id: property.id,
    score: clamp(score, 0, 100),
    factors,
  };
}

/** Score and rank — highest first. Stable sort: ties preserve input order. */
export function rankProperties(
  properties: ScorableProperty[],
  brief: ConciergeBrief,
): PropertyScore[] {
  const scored = properties.map((p) => scoreProperty(p, brief));
  const withIdx = scored.map((s, i) => ({ s, i }));
  withIdx.sort((a, b) => {
    if (b.s.score !== a.s.score) return b.s.score - a.s.score;
    return a.i - b.i;
  });
  return withIdx.map((w) => w.s);
}

function factorValue(s: FactorStatus): number {
  if (s === "match") return 1;
  if (s === "partial") return 0.5;
  return 0;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
