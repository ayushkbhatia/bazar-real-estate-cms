/**
 * Which fact fills the fifth key-facts tile on a listing page.
 *
 * A villa's or townhouse's plot is what a buyer compares them on, and in Abu
 * Dhabi almost every one is freehold, so for these types the tile shows the
 * plot size instead of the tenure. The rule is keyed on the property type
 * alone, so every villa and townhouse — today's and every one created later, by hand or from
 * Salesforce (`Plot_Size__c` → `plot_ft2`) — gets it with no per-listing
 * setting.
 *
 * A listing of these types without a plot size shows no tile at all rather than an em-dash
 * that reads as "unknown plot", and it does not fall back to tenure: the
 * tenure moves to the specification table for every one, so it is never
 * lost (see `tenureInSpecification`).
 */

import { typeRules } from "@/lib/properties/type-rules";

/** Property types whose key facts lead with the plot instead of tenure —
 *  villas, townhouses and land (lib/properties/type-rules.ts). */
const leadsWithPlot = (type: string) => typeRules(type).plotInKeyFacts;

export type FifthKeyFact =
  { kind: "plot"; ft2: number } | { kind: "tenure" } | null;

export function fifthKeyFact(property: {
  type: string;
  plot_ft2: number | null;
}): FifthKeyFact {
  if (!leadsWithPlot(property.type)) return { kind: "tenure" };
  return property.plot_ft2 ? { kind: "plot", ft2: property.plot_ft2 } : null;
}

/**
 * The specification table lists what the key facts don't. For a plot type the
 * tiles carry the plot and not the tenure, so the table swaps them.
 */
export function tenureInSpecification(type: string): boolean {
  return leadsWithPlot(type);
}

export function plotInSpecification(type: string): boolean {
  return !leadsWithPlot(type);
}
