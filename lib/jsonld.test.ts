import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

beforeAll(() => {
  vi.stubEnv(
    "NEXT_PUBLIC_SITE_URL",
    "https://bazar-real-estate-cms.example",
  );
  vi.resetModules();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

async function importModule() {
  vi.resetModules();
  return import("./jsonld");
}

const PROPERTY = {
  reference: "BAZ-AD-04891",
  slug: "mamsha-3-bed-beachfront-apartment",
  title: "Mamsha · 3-bed beachfront apartment",
  short_description: "Three-bedroom beachfront residence.",
  description: "Long description here.",
  price_aed: 4_200_000,
  beds: 3,
  baths: 4,
  built_up_ft2: 2840,
  type: "apartment",
  mode: "buy",
  geo: { lat: 24.544, lng: 54.4406 },
  areas: { name: "Saadiyat Island", slug: "saadiyat-island" },
  hero: { storage_key: "listings/x.jpg", alt_text: null },
  published_at: "2026-05-01T00:00:00Z",
};

describe("propertyJsonLd", () => {
  it("produces a valid RealEstateListing + Offer + Accommodation JSON-LD", async () => {
    const { propertyJsonLd } = await importModule();
    const ld = propertyJsonLd(
      PROPERTY,
      "https://example.com/hero.jpg",
    );
    expect(ld["@context"]).toBe("https://schema.org");
    // Sprint 4c: replaces /Product.
    expect(ld["@type"]).toBe("RealEstateListing");
    expect(ld.url).toBe(
      "https://bazar-real-estate-cms.example/p/mamsha-3-bed-beachfront-apartment-baz-ad-04891",
    );
    expect(ld.identifier).toBe("BAZ-AD-04891");
    expect(ld.image).toEqual(["https://example.com/hero.jpg"]);

    const offer = ld.offers as Record<string, unknown>;
    expect(offer["@type"]).toBe("Offer");
    expect(offer.priceCurrency).toBe("AED");
    expect(offer.price).toBe(4_200_000);

    const acc = ld.mainEntity as Record<string, unknown>;
    expect(acc["@type"]).toBe("Accommodation");
    expect(acc.numberOfBedrooms).toBe(3);
    expect((acc.geo as Record<string, unknown>).latitude).toBe(24.544);
  });

  it("omits image when no hero URL is supplied", async () => {
    const { propertyJsonLd } = await importModule();
    const ld = propertyJsonLd(PROPERTY, null);
    expect(ld.image).toBeUndefined();
  });

  it("uses short_description before description before title for description", async () => {
    const { propertyJsonLd } = await importModule();
    expect(
      propertyJsonLd({ ...PROPERTY, short_description: "Short" }, null)
        .description,
    ).toBe("Short");
    expect(
      propertyJsonLd(
        { ...PROPERTY, short_description: null, description: "Long" },
        null,
      ).description,
    ).toBe("Long");
    expect(
      propertyJsonLd(
        { ...PROPERTY, short_description: null, description: null },
        null,
      ).description,
    ).toBe(PROPERTY.title);
  });
});

describe("organizationJsonLd", () => {
  it("returns the brand organization block", async () => {
    const { organizationJsonLd } = await importModule();
    const ld = organizationJsonLd();
    expect(ld["@type"]).toBe("RealEstateAgent");
    expect(ld.name).toBe("Bazar Real Estate");
    expect(ld.url).toBe("https://bazar-real-estate-cms.example");
  });
});
