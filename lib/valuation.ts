/**
 * Pure valuation auto-estimate. No DB, no React.
 *
 * The model is deliberately simple and explainable: a baseline AED/ft²
 * for the area + property type, modulated by condition, view, upgrades,
 * and furnishing. The result is a low/mid/high *range* — the credibility
 * lives in the advisor review that follows, not in pretend precision
 * from this calculator alone.
 *
 * The baseline ppf table is hand-tuned to match what we'd see in the
 * Abu Dhabi market today. When the area or type isn't in the table we
 * fall back to a global mean rather than refusing to render, so the
 * live preview pane always has *something* to show — the rendered
 * range will simply be wider (basis.confidence === "broad").
 */

import type { Database } from "@/db/types";

export type ValuationCondition =
  | "original"
  | "lightly_refreshed"
  | "renovated"
  | "fully_renovated";

export type ValuationTenancy =
  | "vacant"
  | "rented_le_6mo"
  | "rented_gt_6mo";

export type ValuationMortgageState = "no" | "yes_partial";

export type PropertyType = Database["public"]["Enums"]["property_type"];
export type Furnishing = Database["public"]["Enums"]["property_furnishing"];

export type ValuationInput = {
  /** Lower-case area slug, e.g. "saadiyat-island". May be null. */
  areaSlug: string | null;
  propertyType: PropertyType;
  beds: number;
  baths: number;
  builtUpFt2: number | null;
  floor: number | null;
  condition: ValuationCondition | null;
  upgrades: string[];
  furnishing: Furnishing | null;
  /** Free-text view label, e.g. "Sea / waterfront", "Park / garden". */
  view: string | null;
};

export type ValuationEstimate = {
  lowAed: number;
  midAed: number;
  highAed: number;
  pricePerFt2Used: number;
  basis: {
    confidence: "tight" | "moderate" | "broad";
    rangeFraction: number;
    multipliers: {
      condition: number;
      view: number;
      upgrades: number;
      furnishing: number;
      floor: number;
    };
    baselinePpf: number;
  };
};

/* ────────────────────────────────────────────────────────────────
 * Baseline AED/ft² table (seeded areas + global fallback)
 * ───────────────────────────────────────────────────────────────*/

const BASELINE_PPF: Record<string, Partial<Record<PropertyType, number>>> = {
  "saadiyat-island": {
    apartment: 1_950,
    villa: 2_650,
    penthouse: 2_950,
    townhouse: 2_300,
  },
  "yas-island": {
    apartment: 1_550,
    villa: 1_900,
    townhouse: 1_700,
    hotel_apartment: 1_650,
  },
  "al-reem-island": {
    apartment: 1_350,
    penthouse: 1_900,
  },
  "al-raha": {
    apartment: 1_400,
    villa: 1_700,
    townhouse: 1_600,
  },
  corniche: {
    apartment: 1_750,
    penthouse: 2_400,
  },
};

const FALLBACK_PPF: Record<PropertyType, number> = {
  apartment: 1_500,
  villa: 1_900,
  penthouse: 2_300,
  townhouse: 1_600,
  hotel_apartment: 1_450,
  commercial: 1_200,
  land: 800,
  office: 1_300,
  building: 1_000,
  retail: 1_400,
  commercial_villa: 1_600,
};

export function baselinePricePerFt2(
  areaSlug: string | null,
  type: PropertyType,
): { ppf: number; confident: boolean } {
  if (areaSlug) {
    const areaTable = BASELINE_PPF[areaSlug];
    const ppf = areaTable?.[type];
    if (ppf) return { ppf, confident: true };
  }
  return { ppf: FALLBACK_PPF[type], confident: false };
}

/* ────────────────────────────────────────────────────────────────
 * Multipliers
 * ───────────────────────────────────────────────────────────────*/

const CONDITION_MULTIPLIERS: Record<ValuationCondition, number> = {
  original: 0.85,
  lightly_refreshed: 0.94,
  renovated: 1.05,
  fully_renovated: 1.15,
};

const FURNISHING_MULTIPLIERS: Record<Furnishing, number> = {
  unfurnished: 1.0,
  semi: 1.02,
  fully: 1.05,
};

export function conditionMultiplier(c: ValuationCondition | null): number {
  return c ? CONDITION_MULTIPLIERS[c] : 1.0;
}

export function furnishingMultiplier(f: Furnishing | null): number {
  return f ? FURNISHING_MULTIPLIERS[f] : 1.0;
}

/**
 * View multiplier — uppercases-insensitive substring match against a few
 * known view classes. Sea/waterfront is the biggest premium; everything
 * else is small. Returns 1.0 for unknown / missing.
 */
export function viewMultiplier(view: string | null): number {
  if (!view) return 1.0;
  const v = view.toLowerCase();
  if (v.includes("sea") || v.includes("water") || v.includes("beach"))
    return 1.08;
  if (v.includes("skyline") || v.includes("city")) return 1.04;
  if (v.includes("park") || v.includes("garden")) return 1.02;
  if (v.includes("pool") || v.includes("community")) return 1.01;
  return 1.0;
}

/**
 * Floor multiplier — small premium for high floors in apartments and
 * penthouses; flat for everything else.
 */
export function floorMultiplier(
  floor: number | null,
  type: PropertyType,
): number {
  if (floor == null) return 1.0;
  if (type !== "apartment" && type !== "penthouse" && type !== "hotel_apartment")
    return 1.0;
  if (floor >= 30) return 1.06;
  if (floor >= 15) return 1.03;
  if (floor >= 5) return 1.01;
  return 1.0;
}

/**
 * Upgrades multiplier — additive across selected upgrades, capped at
 * 1.10 to stop someone ticking every box from quoting a 1.5× premium.
 * Weights are deliberately small; condition + view + ppf carry most of
 * the signal.
 */
const UPGRADE_WEIGHTS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /designer kitchen/i, weight: 0.03 },
  { pattern: /marble|stone flooring/i, weight: 0.02 },
  { pattern: /smart home/i, weight: 0.015 },
  { pattern: /primary suite|dressing room/i, weight: 0.015 },
  { pattern: /custom joinery|built-ins/i, weight: 0.01 },
  { pattern: /cinema|av room/i, weight: 0.01 },
  { pattern: /pool|outdoor terrace/i, weight: 0.02 },
  { pattern: /bathroom remodel/i, weight: 0.015 },
];

export function upgradesMultiplier(upgrades: string[]): number {
  let sum = 0;
  for (const upgrade of upgrades) {
    for (const { pattern, weight } of UPGRADE_WEIGHTS) {
      if (pattern.test(upgrade)) {
        sum += weight;
        break;
      }
    }
  }
  return 1 + Math.min(sum, 0.1);
}

/* ────────────────────────────────────────────────────────────────
 * Top-level estimate
 * ───────────────────────────────────────────────────────────────*/

export function estimateValuation(
  input: ValuationInput,
): ValuationEstimate | null {
  if (!input.builtUpFt2 || input.builtUpFt2 <= 0) return null;

  const { ppf: baselinePpf, confident } = baselinePricePerFt2(
    input.areaSlug,
    input.propertyType,
  );
  const condM = conditionMultiplier(input.condition);
  const viewM = viewMultiplier(input.view);
  const upgM = upgradesMultiplier(input.upgrades);
  const furnM = furnishingMultiplier(input.furnishing);
  const floorM = floorMultiplier(input.floor, input.propertyType);

  const effectivePpf = baselinePpf * condM * viewM * upgM * furnM * floorM;
  const mid = effectivePpf * input.builtUpFt2;

  // Width of the range reflects our confidence. Confident areas/types
  // get a tighter band; fallback values widen it.
  const completeness = answeredFields(input);
  const rangeFraction = completeness >= 5 && confident ? 0.06
    : completeness >= 4 ? 0.09
    : confident ? 0.12 : 0.16;

  const low = mid * (1 - rangeFraction);
  const high = mid * (1 + rangeFraction);

  return {
    lowAed: round(low),
    midAed: round(mid),
    highAed: round(high),
    pricePerFt2Used: Math.round(effectivePpf),
    basis: {
      confidence:
        rangeFraction <= 0.07
          ? "tight"
          : rangeFraction <= 0.1
            ? "moderate"
            : "broad",
      rangeFraction,
      multipliers: {
        condition: condM,
        view: viewM,
        upgrades: upgM,
        furnishing: furnM,
        floor: floorM,
      },
      baselinePpf,
    },
  };
}

function answeredFields(input: ValuationInput): number {
  // Used to decide range width — counts the optional, signal-carrying
  // fields the owner filled in.
  let n = 0;
  if (input.condition) n++;
  if (input.upgrades.length > 0) n++;
  if (input.furnishing) n++;
  if (input.view) n++;
  if (input.floor != null) n++;
  if (input.areaSlug) n++;
  return n;
}

function round(n: number): number {
  if (!Number.isFinite(n)) return 0;
  // Round to nearest 1,000 AED — anything finer is fake precision.
  return Math.round(n / 1_000) * 1_000;
}

/** Format an AED value as "AED 3.9M" / "AED 4.5M" for the live preview pane. */
export function formatRangeAed(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
