/**
 * The home page's mortgage calculator band: its sliders' starting values and
 * ranges, and how an editor's typed numbers become them.
 *
 * The numbers are typed into text boxes (the master-page editor has no number
 * field), so everything here is defensive: a box left blank, a value that is
 * not a number, a minimum above its maximum or a step of zero falls back to
 * the shipped slider rather than breaking the band. A starting value outside
 * its range is pulled into it. The words live beside these in the section's
 * fields and fall back to the catalogue (`common.mortgageTeaser`).
 */

export type SliderSettings = {
  value: number;
  min: number;
  max: number;
  step: number;
};

export type MortgageTeaserControls = {
  price: SliderSettings;
  down: SliderSettings;
  rate: SliderSettings;
  term: SliderSettings;
};

/** What the band shipped with, and what a blank box keeps. */
export const MORTGAGE_TEASER_DEFAULTS: MortgageTeaserControls = {
  price: { value: 2_500_000, min: 500_000, max: 20_000_000, step: 50_000 },
  down: { value: 20, min: 5, max: 80, step: 1 },
  rate: { value: 4.25, min: 1.5, max: 9, step: 0.05 },
  term: { value: 25, min: 5, max: 30, step: 1 },
};

/** "2,500,000", "2500000 ", "4.25%" → a number; anything else → null. */
function num(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[,\s%]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function slider(
  values: Record<string, unknown>,
  prefix: "price" | "down" | "rate" | "term",
  bounds: { floor: number; ceiling: number },
): SliderSettings {
  const d = MORTGAGE_TEASER_DEFAULTS[prefix];
  const min = num(values[`${prefix}_min`]) ?? d.min;
  const max = num(values[`${prefix}_max`]) ?? d.max;
  const step = num(values[`${prefix}_step`]) ?? d.step;
  // A range that cannot work is the shipped range, whole: half an editor's
  // range beside half of ours would be a slider nobody chose.
  if (
    min < bounds.floor ||
    max > bounds.ceiling ||
    min >= max ||
    step <= 0 ||
    step > max - min
  )
    return d;
  const value = num(values[`${prefix}_default`]) ?? d.value;
  return { min, max, step, value: Math.min(max, Math.max(min, value)) };
}

/** The four sliders from the section's stored values. */
export function mortgageTeaserControls(
  values: Record<string, unknown>,
): MortgageTeaserControls {
  return {
    price: slider(values, "price", { floor: 1, ceiling: 1_000_000_000 }),
    down: slider(values, "down", { floor: 0, ceiling: 100 }),
    rate: slider(values, "rate", { floor: 0, ceiling: 50 }),
    term: slider(values, "term", { floor: 1, ceiling: 50 }),
  };
}
