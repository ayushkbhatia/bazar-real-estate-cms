import { describe, expect, it } from "vitest";
import { mergeValues } from "@/lib/master-pages";
import * as adapt from "./adapters";
import { EMPTY_LANDING_DATA, type LandingData } from "./data";
import { heroMedia } from "./blocks/openers";
import { featuredProperties, featuredDevelopments } from "./blocks/listings";
import { faq, featureScroll, propTypes, steps, tiles } from "./blocks/content";
import { chips, ctaBand } from "./blocks/conversion";
import { aboutBazar, whyBand } from "./blocks/trust";
import type { BlockDef } from "./types";
import type { ListingRow } from "@/lib/queries/properties";

/** Values exactly as a freshly-added, untouched block would resolve. */
function defaults(def: BlockDef) {
  return mergeValues(def, null);
}

function row(reference: string): ListingRow {
  return {
    id: `id-${reference}`,
    reference,
    title: `Listing ${reference}`,
    price_aed: 1_000_000,
    beds: 2,
    baths: 2,
    built_up_ft2: 1200,
    areas: { name: "Saadiyat" },
    hero: null,
  } as unknown as ListingRow;
}

function data(over: Partial<LandingData> = {}): LandingData {
  return { ...EMPTY_LANDING_DATA, ...over };
}

describe("adapters over untouched defaults", () => {
  it("hero_media carries the registry copy through", () => {
    const p = adapt.heroMediaProps(defaults(heroMedia));
    expect(p.title).toBe(heroMedia.defaults.title);
    expect(p.imageUrl).toBeNull();
    // The placeholder caption survives so the art is still captioned.
    expect(p.image).toBe("abu dhabi · corniche skyline");
    // An empty stat list means "no kicker row", not "an empty kicker row".
    expect(p.kicker).toBeUndefined();
  });

  it("about_bazar leaves the component's own defaults in charge", () => {
    const p = adapt.aboutBazarProps(defaults(aboutBazar));
    expect(p.heading).toBe("About Bazar Real Estate");
    // undefined, not [] — WhoWeAre falls back to its three audited stats.
    expect(p.stats).toBeUndefined();
  });

  it("why_band drops an empty stat grid", () => {
    expect(adapt.whyBandProps(defaults(whyBand)).stats).toBeUndefined();
  });

  it("list-driven blocks render nothing before an editor fills them", () => {
    expect(adapt.faqProps(defaults(faq)).items).toEqual([]);
    expect(adapt.stepsProps(defaults(steps)).steps).toEqual([]);
    expect(adapt.tilesProps(defaults(tiles)).items).toEqual([]);
    expect(adapt.propTypesProps(defaults(propTypes)).items).toEqual([]);
    expect(adapt.featureRowsProps(defaults(featureScroll)).items).toEqual([]);
    expect(adapt.chipsProps(defaults(chips)).chips).toEqual([]);
  });
});

describe("pair adapters", () => {
  it("drops blank rows an editor added and abandoned", () => {
    const items = adapt.faqProps({
      items: [
        { q: "Real question", a: "Answer" },
        { q: "", a: "" },
        { q: "  ", a: "Orphan answer" },
      ],
    }).items;
    expect(items).toEqual([["Real question", "Answer"]]);
  });

  it("drops unnamed cards from every card grid", () => {
    expect(
      adapt.tilesProps({ items: [{ name: "", desc: "x" }, { name: "Buy" }] }).items,
    ).toHaveLength(1);
    expect(
      adapt.propTypesProps({ items: [{ name: "" }, { name: "Villa" }] }).items,
    ).toHaveLength(1);
  });
});

describe("closed-set selects", () => {
  it("maps the column count and refuses anything else", () => {
    expect(adapt.propTypesProps({ cols: "5", items: [] }).cols).toBe(5);
    expect(adapt.propTypesProps({ cols: "4", items: [] }).cols).toBe(4);
    // Not a value the picker offers — falls back rather than reaching the
    // component's `colClass` lookup with a key that isn't there.
    expect(adapt.propTypesProps({ cols: "9", items: [] }).cols).toBe(3);
    expect(adapt.propTypesProps({ items: [] }).cols).toBe(3);
  });

  it("maps the CTA treatment and falls back to ink", () => {
    expect(adapt.ctaBandProps({ ...defaults(ctaBand), variant: "soft" }).variant)
      .toBe("soft");
    expect(adapt.ctaBandProps({ ...defaults(ctaBand), variant: "neon" }).variant)
      .toBe("ink");
  });
});

describe("featured_properties", () => {
  const values = {
    ...defaults(featuredProperties),
    source: "picked",
    picks: [{ slug: "A" }, { slug: "GONE" }, { slug: "B" }],
  };

  it("resolves picks in pick order", () => {
    const p = adapt.featuredPropertiesProps(
      values,
      data({
        propertiesByRef: new Map([
          ["B", row("B")],
          ["A", row("A")],
        ]),
      }),
    );
    expect(p.items.map((i) => i.title)).toEqual(["Listing A", "Listing B"]);
  });

  it("drops a pick that no longer resolves rather than linking nowhere", () => {
    const p = adapt.featuredPropertiesProps(
      values,
      data({ propertiesByRef: new Map([["A", row("A")]]) }),
    );
    expect(p.items).toHaveLength(1);
  });

  it("reads a query-driven rail from its cache key and honours the limit", () => {
    const p = adapt.featuredPropertiesProps(
      { ...values, source: "new_this_week", limit: "4" },
      data({
        propertiesByQuery: new Map([
          ["new_this_week:4", [row("1"), row("2"), row("3"), row("4"), row("5")]],
        ]),
      }),
    );
    expect(p.items).toHaveLength(4);
  });

  it("returns nothing when the query produced nothing", () => {
    const p = adapt.featuredPropertiesProps(
      { ...values, source: "price_drops", limit: "4" },
      data(),
    );
    expect(p.items).toEqual([]);
  });
});

describe("featured_developments", () => {
  it("passes the prefetched rows through so the section can't self-query", () => {
    const developments = [{ slug: "one" }] as never;
    const p = adapt.featuredDevelopmentsProps(
      { ...defaults(featuredDevelopments), picks: [{ slug: "one" }] },
      data({ developments }),
    );
    expect(p.developments).toBe(developments);
    expect(p.featuredSlugs).toEqual(["one"]);
  });
});

describe("images", () => {
  it("carries the resolved url and alt onto the component props", () => {
    const p = adapt.heroMediaProps({
      ...defaults(heroMedia),
      image: {
        media_id: "abc",
        alt: "Corniche at dusk",
        label: "hero",
        url: "https://cdn/x.jpg",
      },
    });
    expect(p.imageUrl).toBe("https://cdn/x.jpg");
    expect(p.imageAlt).toBe("Corniche at dusk");
  });

  it("falls back to the placeholder when the asset was trashed", () => {
    // attachImageUrls sets `url: null` for a deleted asset rather than leaving
    // a broken src behind.
    const p = adapt.heroMediaProps({
      ...defaults(heroMedia),
      image: { media_id: "gone", alt: "x", label: "hero", url: null },
    });
    expect(p.imageUrl).toBeNull();
    expect(p.image).toBe("hero");
  });
});
