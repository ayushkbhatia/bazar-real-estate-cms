/**
 * The /tools/mortgage calculator's controls: where its sliders start and stop,
 * the term options, the type and status it opens on, and the comfort band on
 * the DBR gauge. Edited on Pages & blocks → Mortgage → Mortgage calculator,
 * beside the section's words (client, Oct 2026: "fully editable").
 *
 * Every box is optional. A blank starting value keeps the figure from
 * Settings → Mortgage, which the home page's teaser and the application share;
 * a blank range keeps the range the page shipped with. Numbers are typed into
 * text boxes (the editor has no number field), so this parser is defensive in
 * the same way as `mortgage-teaser.ts`: a range that cannot work (minimum at or
 * above maximum, a step of zero) falls back whole to the shipped range, and a
 * starting value outside its range is pulled into it.
 */
import type { BuyerStatus, MortgageType } from "@/lib/mortgage";

export type MortgageCalculatorControls = {
  price: { min: number; sliderMax: number; max: number; step: number };
  /** Fractions, as the model takes them (0.15 = 15%). */
  down: { min: number; max: number; step: number };
  rate: { min: number; max: number; step: number };
  /** Longest first, as the dropdown lists them. */
  termOptions: number[];
  type: MortgageType;
  status: BuyerStatus;
  /** DBR at or below which the gauge reads "comfortable", as a fraction. */
  gaugeComfort: number;
};

/** Where the calculator opens, after an editor's overrides of Settings → Mortgage. */
export type MortgageOpening = {
  priceAed: number;
  downPaymentPct: number;
  ratePct: number;
  termYears: number;
  annualIncomeAed: number;
};

/** What the calculator shipped with, and what a blank box keeps. */
export const MORTGAGE_CALCULATOR_DEFAULTS: MortgageCalculatorControls = {
  price: { min: 500_000, sliderMax: 10_000_000, max: 50_000_000, step: 50_000 },
  down: { min: 0.15, max: 0.8, step: 0.01 },
  rate: { min: 0, max: 20, step: 0.01 },
  termOptions: [25, 20, 15, 10],
  type: "fixed",
  status: "uae_resident",
  gaugeComfort: 0.35,
};

const TYPES: MortgageType[] = ["fixed", "variable", "hybrid"];
const STATUSES: BuyerStatus[] = ["uae_national", "uae_resident", "non_resident", "gcc_national"];

/** "2,500,000", "2500000 ", "4.25%" → a number; anything else → null. */
function num(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[,\s%]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function priceRange(v: Record<string, unknown>): MortgageCalculatorControls["price"] {
  const d = MORTGAGE_CALCULATOR_DEFAULTS.price;
  const min = num(v.price_min) ?? d.min;
  const max = num(v.price_max) ?? d.max;
  const step = num(v.price_step) ?? d.step;
  // The slider may stop short of the typed maximum, never past it.
  const sliderMax = Math.min(num(v.price_slider_max) ?? d.sliderMax, max);
  if (min < 1 || max > 1_000_000_000 || min >= sliderMax || step <= 0 || step > sliderMax - min) return d;
  return { min, sliderMax, max, step };
}

/** Typed as whole percentages; held as fractions. */
function pctRange(
  v: Record<string, unknown>,
  prefix: "down" | "rate",
  ceiling: number,
): { min: number; max: number; step: number } {
  const d = MORTGAGE_CALCULATOR_DEFAULTS[prefix];
  const scale = prefix === "down" ? 100 : 1;
  const min = num(v[`${prefix}_min`]) ?? d.min * scale;
  const max = num(v[`${prefix}_max`]) ?? d.max * scale;
  const step = num(v[`${prefix}_step`]) ?? d.step * scale;
  if (min < 0 || max > ceiling || min >= max || step <= 0 || step > max - min) return d;
  return { min: min / scale, max: max / scale, step: step / scale };
}

/** "25, 20, 15, 10" → [25, 20, 15, 10]; whole years 1–50, duplicates dropped. */
function terms(raw: unknown): number[] {
  if (typeof raw !== "string" || !raw.trim()) return MORTGAGE_CALCULATOR_DEFAULTS.termOptions;
  const years = [
    ...new Set(
      raw
        .split(/[,،\s]+/)
        .map((s) => Number(s))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 50),
    ),
  ].sort((a, b) => b - a);
  return years.length ? years : MORTGAGE_CALCULATOR_DEFAULTS.termOptions;
}

/** The controls from the section's stored values. */
export function mortgageCalculatorControls(v: Record<string, unknown>): MortgageCalculatorControls {
  const d = MORTGAGE_CALCULATOR_DEFAULTS;
  const comfort = num(v.gauge_comfort);
  return {
    price: priceRange(v),
    down: pctRange(v, "down", 100),
    rate: pctRange(v, "rate", 50),
    termOptions: terms(v.term_options),
    type: TYPES.includes(v.type_default as MortgageType) ? (v.type_default as MortgageType) : d.type,
    status: STATUSES.includes(v.status_default as BuyerStatus)
      ? (v.status_default as BuyerStatus)
      : d.status,
    gaugeComfort: comfort != null && comfort > 0 && comfort < 100 ? comfort / 100 : d.gaugeComfort,
  };
}

/**
 * Where the calculator opens: an editor's starting value where one is typed,
 * else Settings → Mortgage, and either way inside the editor's ranges and on
 * one of the term options.
 */
export function mortgageOpening(
  v: Record<string, unknown>,
  settings: MortgageOpening,
  c: MortgageCalculatorControls,
): MortgageOpening {
  const price = num(v.price_default) ?? settings.priceAed;
  const down = num(v.down_default);
  const rate = num(v.rate_default) ?? settings.ratePct;
  const term = num(v.term_default) ?? settings.termYears;
  const income = num(v.income_default);
  return {
    priceAed: clamp(price, c.price.min, c.price.max),
    downPaymentPct: clamp(down != null ? down / 100 : settings.downPaymentPct, c.down.min, c.down.max),
    ratePct: clamp(rate, c.rate.min, c.rate.max),
    // The nearest option, so the dropdown never opens on a blank.
    termYears: c.termOptions.reduce((best, y) => (Math.abs(y - term) < Math.abs(best - term) ? y : best)),
    annualIncomeAed: income != null && income >= 0 ? income : settings.annualIncomeAed,
  };
}

/** The boxes on the section, in the order the editor shows them. */
export const MORTGAGE_CALCULATOR_CONTROL_FIELDS: [string, string, string][] = [
  ["price_default", "Property price · starting value (AED)", "From Settings → Mortgage"],
  ["price_min", "Property price · minimum (AED)", "500,000"],
  ["price_slider_max", "Property price · where the slider stops (AED)", "10,000,000"],
  ["price_max", "Property price · highest that can be typed (AED)", "50,000,000"],
  ["price_step", "Property price · slider step (AED)", "50,000"],
  ["down_default", "Down payment · starting value (%)", "From Settings → Mortgage"],
  ["down_min", "Down payment · minimum (%)", "15"],
  ["down_max", "Down payment · maximum (%)", "80"],
  ["down_step", "Down payment · slider step (%)", "1"],
  ["rate_default", "Interest rate · starting value (%)", "From Settings → Mortgage"],
  ["rate_min", "Interest rate · lowest accepted (%)", "0"],
  ["rate_max", "Interest rate · highest accepted (%)", "20"],
  ["rate_step", "Interest rate · step (%)", "0.01"],
  ["term_options", "Loan term · options (years, comma-separated)", "25, 20, 15, 10"],
  ["term_default", "Loan term · starting value (years)", "From Settings → Mortgage"],
  ["income_default", "Annual income · starting value (AED)", "From Settings → Mortgage"],
  ["gauge_comfort", "Debt-burden gauge · comfortable up to (%)", "35"],
];

export const MORTGAGE_TYPE_OPTIONS = [
  { value: "fixed", label: "Fixed" },
  { value: "variable", label: "Variable" },
  { value: "hybrid", label: "Hybrid" },
];

export const BUYER_STATUS_OPTIONS = [
  { value: "uae_national", label: "UAE national" },
  { value: "uae_resident", label: "UAE resident" },
  { value: "non_resident", label: "Non-resident" },
  { value: "gcc_national", label: "GCC national" },
];
