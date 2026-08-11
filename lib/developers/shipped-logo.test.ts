import { describe, it, expect } from "vitest";
import {
  findShippedDeveloper,
  resolveDeveloperLogo,
  shippedLogo,
} from "./shipped-logo";

describe("findShippedDeveloper", () => {
  it("matches on the shipped slug", () => {
    expect(findShippedDeveloper("aldar")?.name).toBe("Aldar Properties");
  });

  it("matches on the name when the catalogue slug differs", () => {
    // The live case this exists for: the catalogue row is `modon-properties`,
    // the shipped art is filed under `modon`. Without the name fallback the
    // admin record for MODON shows an empty logo picker.
    expect(findShippedDeveloper("MODON Properties")?.slug).toBe("modon");
    expect(findShippedDeveloper("Modon Properties")?.slug).toBe("modon");
  });

  it("returns null for a developer that ships nothing", () => {
    expect(findShippedDeveloper("national-holding")).toBeNull();
    expect(findShippedDeveloper("")).toBeNull();
  });
});

describe("shippedLogo", () => {
  it("carries both the trimmed art and the padded master canvas", () => {
    const logo = shippedLogo({ slug: "aldar" });
    expect(logo?.trimmed?.src).toBe("/developers/trimmed/aldar.png");
    expect(logo?.master.src).toBe("/developers/aldar.png");
  });

  it("falls back from an unmatched slug to the name", () => {
    const logo = shippedLogo({
      slug: "modon-properties",
      name: "MODON Properties",
    });
    expect(logo?.master.src).toBe("/developers/modon.png");
  });

  it("is null when neither slug nor name ships art", () => {
    expect(shippedLogo({ slug: "national-holding", name: "National Holding" }))
      .toBeNull();
  });
});

describe("resolveDeveloperLogo", () => {
  it("puts an uploaded logo ahead of the shipped art", () => {
    const out = resolveDeveloperLogo({
      uploadedUrl: "https://cdn.example/new.png",
      slug: "aldar",
    });
    expect(out?.src).toBe("https://cdn.example/new.png");
  });

  it("uses the trimmed shipped art when nothing is uploaded", () => {
    expect(resolveDeveloperLogo({ slug: "aldar" })?.src).toBe(
      "/developers/trimmed/aldar.png",
    );
  });

  it("returns null so the caller can draw initials", () => {
    expect(
      resolveDeveloperLogo({ slug: "national-holding", name: "National Holding" }),
    ).toBeNull();
  });
});
