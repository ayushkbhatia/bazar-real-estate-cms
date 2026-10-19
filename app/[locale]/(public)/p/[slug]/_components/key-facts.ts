/**
 * Which fact fills the fifth key-facts tile on a listing page.
 *
 * A villa's plot is what a buyer compares villas on, and in Abu Dhabi
 * almost every villa is freehold, so for villas the tile shows the plot size
 * instead of the tenure. The rule is keyed on the property type alone, so
 * every villa — today's and every one created later, by hand or from
 * Salesforce (`Plot_Size__c` → `plot_ft2`) — gets it with no per-listing
 * setting.
 *
 * A villa without a plot size shows no tile at all rather than an em-dash
 * that reads as "unknown plot", and it does not fall back to tenure: the
 * tenure moves to the specification table for every villa, so it is never
 * lost (see `tenureInSpecification`).
 */

/** Property types whose key facts lead with the plot instead of tenure. */
const PLOT_TYPES: ReadonlySet<string> = new Set(["villa"]);

export type FifthKeyFact =
  | { kind: "plot"; ft2: number }
  | { kind: "tenure" }
  | null;

export function fifthKeyFact(property: {
  type: string;
  plot_ft2: number | null;
}): FifthKeyFact {
  if (!PLOT_TYPES.has(property.type)) return { kind: "tenure" };
  return property.plot_ft2 ? { kind: "plot", ft2: property.plot_ft2 } : null;
}

/**
 * The specification table lists what the key facts don't. For a plot type the
 * tiles carry the plot and not the tenure, so the table swaps them.
 */
export function tenureInSpecification(type: string): boolean {
  return PLOT_TYPES.has(type);
}

export function plotInSpecification(type: string): boolean {
  return !PLOT_TYPES.has(type);
}
