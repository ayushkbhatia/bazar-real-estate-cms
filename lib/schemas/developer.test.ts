import { describe, expect, it } from "vitest";
import { developerCreateSchema, developerNameKey } from "./developer";

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
