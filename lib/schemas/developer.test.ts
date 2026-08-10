import { describe, expect, it } from "vitest";
import {
  developerCreateSchema,
  developerEditSchema,
  developerNameKey,
  normaliseDeveloperInput,
} from "./developer";

describe("developerCreateSchema", () => {
  it("trims and accepts a plain name", () => {
    const parsed = developerCreateSchema.parse({ name: "  Aldar Properties " });
    expect(parsed.name).toBe("Aldar Properties");
  });

  it("rejects a name that is too short to be a company", () => {
    expect(developerCreateSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(developerCreateSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects an over-long name", () => {
    const result = developerCreateSchema.safeParse({ name: "x".repeat(121) });
    expect(result.success).toBe(false);
  });
});

describe("developerEditSchema", () => {
  const base = { name: "Aldar Properties", slug: "aldar" };

  it("accepts the minimum a record needs", () => {
    expect(developerEditSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a slug that isn't URL-safe", () => {
    for (const slug of ["Aldar", "al dar", "aldar/props", "-aldar"]) {
      expect(
        developerEditSchema.safeParse({ ...base, slug }).success,
        slug,
      ).toBe(false);
    }
  });

  it("rejects a founding year that can't be real", () => {
    expect(
      developerEditSchema.safeParse({ ...base, founded_year: 1200 }).success,
    ).toBe(false);
    expect(
      developerEditSchema.safeParse({ ...base, founded_year: 2999 }).success,
    ).toBe(false);
    expect(
      developerEditSchema.safeParse({ ...base, founded_year: 2005 }).success,
    ).toBe(true);
  });
});

describe("normaliseDeveloperInput", () => {
  it("turns a blank description into null rather than an empty string", () => {
    expect(normaliseDeveloperInput({ description: "" }).description).toBeNull();
    expect(
      normaliseDeveloperInput({ description: undefined }).description,
    ).toBeNull();
  });

  it("reads the year back from a number input's string", () => {
    expect(normaliseDeveloperInput({ founded_year: "2005" }).founded_year).toBe(
      2005,
    );
    expect(
      normaliseDeveloperInput({ founded_year: "" }).founded_year,
    ).toBeNull();
    expect(
      normaliseDeveloperInput({ founded_year: "not a year" }).founded_year,
    ).toBeNull();
  });

  it("trims the name and slug so a stray space can't create a second row", () => {
    const out = normaliseDeveloperInput({ name: "  Aldar ", slug: " aldar " });
    expect(out.name).toBe("Aldar");
    expect(out.slug).toBe("aldar");
  });

  it("round-trips through the edit schema", () => {
    const parsed = developerEditSchema.safeParse(
      normaliseDeveloperInput({
        name: " Aldar Properties ",
        slug: "aldar",
        description: "",
        founded_year: "2005",
      }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.description).toBeNull();
    expect(parsed.data.founded_year).toBe(2005);
  });
});

describe("developerNameKey", () => {
  it("collapses case, spacing and punctuation to one key", () => {
    const key = developerNameKey("Aldar Properties");
    expect(developerNameKey("  aldar   properties  ")).toBe(key);
    expect(developerNameKey("ALDAR PROPERTIES")).toBe(key);
    expect(developerNameKey("Aldar-Properties")).toBe(key);
    expect(key).toBe("aldar-properties");
  });

  it("strips diacritics so accented duplicates collide", () => {
    expect(developerNameKey("Émaar")).toBe(developerNameKey("Emaar"));
  });

  it("returns an empty key for a name with nothing sluggable in it", () => {
    // The action refuses this rather than inserting a row with an empty slug,
    // which would collide with the next such name.
    expect(developerNameKey("!!!")).toBe("");
  });

  it("keeps genuinely different developers apart", () => {
    expect(developerNameKey("Aldar")).not.toBe(
      developerNameKey("Aldar Properties"),
    );
  });
});
