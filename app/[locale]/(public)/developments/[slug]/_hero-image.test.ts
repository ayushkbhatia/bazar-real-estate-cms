import { describe, expect, it } from "vitest";
import { DEVELOPMENT_SECTIONS } from "@/lib/master-pages/subpages";
import { resolveSections, img, type MasterPageDef } from "@/lib/master-pages";
import { developmentPageDef } from "@/lib/master-pages/subpages";
import { resolveHeroImage } from "./_hero-image";

const COVER = "https://cdn.test/storage/cover.jpg";
const BANNER = "https://cdn.test/storage/banner.jpg";

describe("resolveHeroImage", () => {
  it("prefers the Hero section's banner", () => {
    const hero = resolveHeroImage({
      banner: { media_id: "m1", alt: "Lagoon at dusk", label: null, url: BANNER },
      coverUrl: COVER,
      coverAlt: "Cover",
      name: "The Canopies",
    });
    expect(hero).toEqual({
      url: BANNER,
      alt: "Lagoon at dusk",
      source: "banner",
    });
  });

  it("falls back to the cover image when no banner is set", () => {
    // The whole point of the fallback: a hundred-odd live pages have never
    // seen this field, and they must keep rendering exactly as they do now.
    const hero = resolveHeroImage({
      banner: { media_id: null, alt: null, label: null, url: null },
      coverUrl: COVER,
      coverAlt: "Cover alt",
      name: "The Canopies",
    });
    expect(hero).toEqual({ url: COVER, alt: "Cover alt", source: "cover" });
  });

  it("falls back when the section has never been saved at all", () => {
    const hero = resolveHeroImage({
      banner: null,
      coverUrl: COVER,
      coverAlt: null,
      name: "The Canopies",
    });
    expect(hero.source).toBe("cover");
    expect(hero.alt).toBe("The Canopies");
  });

  it("falls back when the banner asset has been trashed", () => {
    // attachImageUrls resolves a deleted asset to a null url while leaving the
    // media_id in place — that must not blank the top of the page.
    const hero = resolveHeroImage({
      banner: { media_id: "gone", alt: null, label: null, url: null },
      coverUrl: COVER,
      coverAlt: null,
      name: "The Canopies",
    });
    expect(hero.source).toBe("cover");
  });

  it("names the project when neither image has alt text", () => {
    const hero = resolveHeroImage({
      banner: { media_id: "m1", alt: "  ", label: null, url: BANNER },
      coverUrl: COVER,
      coverAlt: null,
      name: "The Canopies",
    });
    expect(hero.alt).toBe("The Canopies");
  });

  it("reports no image when the project has neither", () => {
    const hero = resolveHeroImage({
      banner: null,
      coverUrl: null,
      coverAlt: null,
      name: "The Canopies",
    });
    expect(hero).toEqual({ url: null, alt: "The Canopies", source: "none" });
  });
});

describe("the development hero carries its own banner field", () => {
  const hero = DEVELOPMENT_SECTIONS.find((s) => s.key === "hero")!;

  it("declares an image field the editor can render", () => {
    const field = hero.fields.find((f) => f.key === "image");
    expect(field?.kind).toBe("image");
  });

  it("defaults to empty, so the cover image keeps the page", () => {
    const def = developmentPageDef({
      name: "The Canopies",
      slug: "the-canopies",
    });
    const resolved = resolveSections(def as MasterPageDef, null);
    const values = resolved.find((s) => s.key === "hero")!.values;
    expect(img(values, "image")?.media_id).toBeNull();
  });
});
