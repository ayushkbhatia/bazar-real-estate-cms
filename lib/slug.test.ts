import { describe, it, expect } from "vitest";
import { slugify, generatePropertyReference } from "./slug";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Mamsha 3-Bed Beachfront")).toBe("mamsha-3-bed-beachfront");
  });

  it("strips bullets and other punctuation", () => {
    expect(slugify("Nudra · 5-bed villa with pool")).toBe(
      "nudra-5-bed-villa-with-pool",
    );
  });

  it("collapses runs of separators", () => {
    expect(slugify("foo   bar   baz")).toBe("foo-bar-baz");
    expect(slugify("foo---bar")).toBe("foo-bar");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  hello world  ")).toBe("hello-world");
    expect(slugify("--leading and trailing--")).toBe("leading-and-trailing");
  });

  it("handles accented characters by dropping diacritics", () => {
    expect(slugify("São Paulo")).toBe("sao-paulo");
    expect(slugify("café résumé")).toBe("cafe-resume");
  });

  it("returns empty string for non-slug-able input", () => {
    expect(slugify("...!!!")).toBe("");
    expect(slugify("")).toBe("");
  });
});

describe("generatePropertyReference", () => {
  it("matches BAZ-<emirate>-<5 digits> format", () => {
    for (let i = 0; i < 50; i++) {
      const ref = generatePropertyReference();
      expect(ref).toMatch(/^BAZ-AD-0\d{4}$/);
    }
  });

  it("uses the supplied emirate code (uppercased)", () => {
    expect(generatePropertyReference("dxb")).toMatch(/^BAZ-DXB-0\d{4}$/);
    expect(generatePropertyReference("AD")).toMatch(/^BAZ-AD-0\d{4}$/);
  });
});
