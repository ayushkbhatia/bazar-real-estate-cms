/**
 * The mortgage wizard's Flow switches (Pages & blocks → Wizards → Mortgage
 * application → Flow): what it shows, rather than what it says. Their own
 * module so the flow's client components can read the shape without pulling
 * in the editor's registry and the whole message catalogue it is built from.
 */

export const MORTGAGE_FLOW_DEFAULTS = {
  /** Which service card W1 shows first. */
  w1_first: "consultancy" as "consultancy" | "pre_approval",
  /** W1's "Which one is right for you?" panel. */
  show_w1_rail: true,
  /** W1's "Prefer to talk it through?" line. */
  show_w1_contact: true,
  /** W2's "why we ask" panel. */
  show_w2_rail: true,
} as const;

export type MortgageFlowSettings = {
  w1_first: "consultancy" | "pre_approval";
  show_w1_rail: boolean;
  show_w1_contact: boolean;
  show_w2_rail: boolean;
};
