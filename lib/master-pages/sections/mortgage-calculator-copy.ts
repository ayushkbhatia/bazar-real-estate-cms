/**
 * The mortgage calculator's own words, as sections of the Mortgage page.
 *
 * Every section head on /tools/mortgage was already a field; what wasn't was
 * the calculator itself — the slider labels, the monthly payment and totals,
 * the debt-burden gauge, the closing-cost lines, the scenario cards and the
 * PDF button. Those are next-intl messages (`tools.mortgage` in
 * `messages/{en,ar}/tools.json`) read by client components, and they are made
 * editable the way the mortgage application wizard's are (`catalogue-copy.ts`):
 * each message a field keyed by its path under `tools.mortgage`, the
 * catalogue's English and Arabic the defaults, only the differences stored,
 * and the page laying them over the catalogue for the calculator to read.
 *
 * These sections are copy, not layout: `locked`, so they can't be hidden or
 * moved, and the calculator renders nothing for their keys.
 */

import enTools from "@/messages/en/tools.json";
import arTools from "@/messages/ar/tools.json";
import {
  catalogueCopyIssues,
  catalogueOverlay,
  catalogueStoredValues,
  flattenCatalogue,
  isCountedMessage,
  type Catalogue,
  type CatalogueCopyIssue,
  type MessageTree,
} from "../catalogue-copy";
import { area, text } from "../fields";
import type { Locale } from "@/lib/i18n/locales";
import type { ResolvedSection, SectionDef, SectionValues, SimpleFieldDef } from "../types";

const EN = new Map(flattenCatalogue(enTools.mortgage as Catalogue));
const AR = new Map(flattenCatalogue(arTools.mortgage as Catalogue));

type Group = {
  key: string;
  label: string;
  description: string;
  /** Whether a message (by its path under `tools.mortgage`) belongs here. */
  owns: (path: string) => boolean;
};

const starts = (...prefixes: string[]) => (path: string) => prefixes.some((p) => path.startsWith(p));

/** In the order a visitor meets them. Every message belongs to exactly one. */
const GROUPS: readonly Group[] = [
  {
    key: "calc_inputs",
    label: "Calculator · Your numbers",
    description:
      "The calculator's inputs: property price, down payment and its minimum warning, interest rate, term, mortgage type, buyer status and annual income.",
    owns: starts(
      "propertyPrice",
      "downPayment",
      "belowGuidance",
      "interestRate",
      "term",
      "mortgageType",
      "type",
      "buyerStatus",
      "status",
      "annualIncome",
      "affordabilityHelp",
    ),
  },
  {
    key: "calc_results",
    label: "Calculator · Results and affordability",
    description:
      "The monthly payment and what's under it, the affordability line, and the debt-burden ratio gauge with its explainer.",
    owns: starts("monthlyPayment", "borrowedFor", "totalToPay", "totalInterest", "principalShare", "affordability", "dbr"),
  },
  {
    key: "calc_closing",
    label: "Calculator · Cash to close",
    description: "The total cash needed at close, each closing-cost line and the note beside it, and the currency note.",
    owns: starts("cash"),
  },
  {
    key: "calc_compare",
    label: "Calculator · Scenarios and schedule",
    description: "The three scenario cards and the amortization chart.",
    owns: starts("scenario", "amort"),
  },
  {
    key: "calc_summary",
    label: "Calculator · Your scenario and PDF",
    description: "The scenario summary beside the pre-approval band, and the PDF button with its messages.",
    owns: starts("line", "pdf"),
  },
];

function groupOf(path: string): Group {
  // `affordabilityHelp` sits under the income input; the other `affordability…`
  // messages are results. First match wins, so the inputs claim it first.
  const group = GROUPS.find((g) => g.owns(path));
  if (!group) throw new Error(`mortgage-calculator-copy: "${path}" belongs to no section`);
  return group;
}

// ── Labels ───────────────────────────────────────────────────────

const WORDS: Record<string, string> = {
  aria: "screen-reader text",
  slider: "slider (screen-reader text)",
  dbr: "DBR",
  dld: "DLD",
  noc: "NOC",
  pdf: "PDF",
  amort: "chart",
  pct: "percentage",
  uae: "UAE",
  gcc: "GCC",
};

function words(segment: string): string {
  return segment
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((w) => WORDS[w.toLowerCase()] ?? w.toLowerCase())
    .join(" ");
}

/** "cashLine.dld_transfer" → "Cash line · DLD transfer"; "propertyPriceAria" → "Property price screen-reader text". */
function labelFor(path: string): string {
  const label = path.split(".").map(words).join(" · ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fieldFor(path: string): SimpleFieldDef {
  const message = EN.get(path)!;
  const long = message.length > 90;
  const max = Math.max(long ? 600 : 160, Math.ceil(message.length * 2));
  // Every message gets an Arabic twin, even a near-symbol one like "Y{year}":
  // the catalogue's Arabic differs, and a field with no twin would hand /ar
  // the English.
  return long ? area(path, labelFor(path), { max, optional: false }) : text(path, labelFor(path), { max, optional: false });
}

/** Every calculator message the editor offers, by path under `tools.mortgage`. */
export const MORTGAGE_CALCULATOR_COPY_KEYS: readonly string[] = [...EN.entries()]
  .filter(([, message]) => !isCountedMessage(message))
  .map(([key]) => key);

function buildSections(): SectionDef[] {
  const byGroup = new Map<string, string[]>(GROUPS.map((g) => [g.key, []]));
  for (const path of MORTGAGE_CALCULATOR_COPY_KEYS) byGroup.get(groupOf(path).key)!.push(path);
  return GROUPS.map((group): SectionDef => {
    const paths = byGroup.get(group.key)!;
    const defaults: SectionValues = {};
    for (const path of paths) {
      defaults[path] = EN.get(path)!;
      defaults[`${path}_ar`] = AR.get(path) ?? EN.get(path)!;
    }
    return {
      key: group.key,
      label: group.label,
      description: group.description,
      locked: true,
      dataNote:
        "Keep anything in {curly braces}: the calculator fills it in with the visitor's figures. The numbers themselves — fees, LTV tiers, DBR bands, the opening scenario — are in Settings → Mortgage.",
      fields: paths.map(fieldFor),
      defaults,
    };
  });
}

export const MORTGAGE_CALCULATOR_COPY_SECTIONS: readonly SectionDef[] = buildSections();

const COPY_KEYS = new Set(GROUPS.map((g) => g.key));

/** Whether a section of the Mortgage page is calculator copy rather than a band of the page. */
export function isCalculatorCopySection(key: string): boolean {
  return COPY_KEYS.has(key);
}

/** The save's checks for the calculator copy: placeholders kept, nothing unformattable. */
export function calculatorCopyIssues(sections: readonly { key: string; values: SectionValues }[]): CatalogueCopyIssue[] {
  return catalogueCopyIssues(
    sections.flatMap((section) => {
      const def = MORTGAGE_CALCULATOR_COPY_SECTIONS.find((s) => s.key === section.key);
      return def ? [{ label: def.label, fields: def.fields, values: section.values }] : [];
    }),
    EN,
  );
}

/** Calculator copy as stored: only what differs from the catalogue. Other sections pass through. */
export function calculatorCopyStoredValues<T extends { key: string; values: SectionValues }>(sections: readonly T[]): T[] {
  return sections.map((section) =>
    isCalculatorCopySection(section.key) ? { ...section, values: catalogueStoredValues(section.values, EN, AR) } : section,
  );
}

/** The `tools.mortgage` messages an editor changed, for one locale; empty when nothing is. */
export function calculatorCopyOverlay(sections: readonly ResolvedSection[], locale: Locale): MessageTree {
  return catalogueOverlay(
    sections.filter((s) => isCalculatorCopySection(s.key)),
    locale,
    EN,
    AR,
  );
}
