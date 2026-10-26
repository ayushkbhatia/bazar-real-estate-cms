/**
 * What a listing of each property type is measured by.
 *
 * One table, read by the listing page, every listing card and the CMS, so a
 * plot of land can never show "Bedrooms 0 · Bathrooms 0 · Built-up —" on one
 * surface while another has learnt better. The rule is keyed on the type
 * alone: every listing of that type, today's and every one created later by
 * hand or from Salesforce, follows it with no per-listing setting.
 *
 * A type not in the table keeps the behaviour every listing had before it:
 * rooms, an optional built-up area and an optional plot.
 */

/** Whether an area applies to a type, and whether it must be filled in. */
export type AreaRule = "required" | "optional" | "none";

export type PropertyTypeRules = {
  builtUp: AreaRule;
  plot: AreaRule;
  /** Bedrooms and bathrooms mean something for this type. */
  rooms: boolean;
  /**
   * The plot leads the listing page's key facts (in the tenure's place) when
   * the listing has one. A villa's or townhouse's plot is what a buyer
   * compares them on, and a plot of land is nothing but its plot.
   */
  plotInKeyFacts: boolean;
};

const DEFAULT_RULES: PropertyTypeRules = {
  builtUp: "optional",
  plot: "optional",
  rooms: true,
  plotInKeyFacts: false,
};

const RULES: Readonly<Record<string, PropertyTypeRules>> = {
  villa: { ...DEFAULT_RULES, plotInKeyFacts: true },
  townhouse: { ...DEFAULT_RULES, plotInKeyFacts: true },
  // A plot: its size is the only measure (client, Oct 2026).
  land: {
    builtUp: "none",
    plot: "required",
    rooms: false,
    plotInKeyFacts: true,
  },
};

export function typeRules(type: string | null | undefined): PropertyTypeRules {
  return (type && RULES[type]) || DEFAULT_RULES;
}

/** The facts a listing card shows, with the ones its type has no use for blanked. */
export type ListingFacts = {
  beds: number | null;
  baths: number | null;
  /** The area the card shows: built-up, or the plot for a type without one. */
  areaFt2: number | null;
  areaKind: "built_up" | "plot";
};

export function listingFacts(row: {
  type: string;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  plot_ft2?: number | null;
}): ListingFacts {
  const rules = typeRules(row.type);
  const byPlot = rules.builtUp === "none";
  return {
    beds: rules.rooms ? row.beds : null,
    baths: rules.rooms ? row.baths : null,
    areaFt2: byPlot ? (row.plot_ft2 ?? null) : row.built_up_ft2,
    areaKind: byPlot ? "plot" : "built_up",
  };
}

/**
 * `listingFacts` shaped as ListingCard props, for the many surfaces that draw
 * one: `{...cardFactProps(row)}` in place of beds / baths / area. A missing
 * built-up area still reads 0 on a card, as it always has; a missing plot on
 * a plot-measured type leaves the chip out.
 */
export function cardFactProps(row: Parameters<typeof listingFacts>[0]): {
  beds: number | null;
  baths: number | null;
  area: number | null;
  areaKind: ListingFacts["areaKind"];
} {
  const f = listingFacts(row);
  return {
    beds: f.beds,
    baths: f.baths,
    area: f.areaKind === "built_up" ? (f.areaFt2 ?? 0) : f.areaFt2,
    areaKind: f.areaKind,
  };
}
