import { describe, it, expect } from "vitest";
import {
  propertyOverviewSchema,
  propertyPricingSchema,
  propertyEditSchema,
  normaliseEditInput,
} from "./property";

describe("propertyOverviewSchema", () => {
  it("accepts a valid overview", () => {
    const res = propertyOverviewSchema.safeParse({
      title: "Mamsha · 3-bed beachfront",
      short_description: "Three-bedroom apartment with sea views.",
      type: "apartment",
      mode: "buy",
    });
    expect(res.success).toBe(true);
  });

  it("rejects a title that is too short", () => {
    const res = propertyOverviewSchema.safeParse({
      title: "Hi",
      type: "apartment",
      mode: "buy",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].path).toEqual(["title"]);
  });

  it("rejects an unknown type", () => {
    const res = propertyOverviewSchema.safeParse({
      title: "A perfectly fine title",
      type: "spaceship",
      mode: "buy",
    });
    expect(res.success).toBe(false);
  });

  it("accepts null short_description", () => {
    const res = propertyOverviewSchema.safeParse({
      title: "A perfectly fine title",
      short_description: null,
      type: "villa",
      mode: "rent",
    });
    expect(res.success).toBe(true);
  });
});

describe("propertyPricingSchema", () => {
  it("accepts a valid pricing payload", () => {
    const res = propertyPricingSchema.safeParse({
      price_aed: 4_200_000,
      service_charge_per_ft2: 18.5,
      beds: 3,
      baths: 4,
      built_up_ft2: 2840,
      plot_ft2: null,
    });
    expect(res.success).toBe(true);
  });

  it("rejects a negative price", () => {
    const res = propertyPricingSchema.safeParse({
      price_aed: -1,
      beds: 1,
      baths: 1,
    });
    expect(res.success).toBe(false);
  });

  it("rejects non-integer beds", () => {
    const res = propertyPricingSchema.safeParse({
      price_aed: 100_000,
      beds: 2.5,
      baths: 1,
    });
    expect(res.success).toBe(false);
  });

  it("rejects unrealistically high price", () => {
    const res = propertyPricingSchema.safeParse({
      price_aed: 2_000_000_000,
      beds: 1,
      baths: 1,
    });
    expect(res.success).toBe(false);
  });
});

describe("propertyEditSchema (merged)", () => {
  it("validates both tabs together", () => {
    const res = propertyEditSchema.safeParse({
      title: "A valid title",
      type: "apartment",
      mode: "buy",
      price_aed: 1_000_000,
      beds: 1,
      baths: 1,
    });
    expect(res.success).toBe(true);
  });

  it("collects errors across both tabs", () => {
    const res = propertyEditSchema.safeParse({
      title: "Hi",
      type: "apartment",
      mode: "buy",
      price_aed: -1,
      beds: 1,
      baths: 1,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("title");
      expect(paths).toContain("price_aed");
    }
  });
});

describe("normaliseEditInput", () => {
  it("turns empty strings into nulls for nullable fields", () => {
    const out = normaliseEditInput({
      short_description: "",
      service_charge_per_ft2: "",
      built_up_ft2: "",
      plot_ft2: "",
    }) as Record<string, unknown>;
    expect(out.short_description).toBeNull();
    expect(out.service_charge_per_ft2).toBeNull();
    expect(out.built_up_ft2).toBeNull();
    expect(out.plot_ft2).toBeNull();
  });

  it("coerces numeric strings to numbers", () => {
    const out = normaliseEditInput({
      price_aed: "4200000",
      beds: "3",
      baths: "4",
      built_up_ft2: "2840",
    }) as Record<string, unknown>;
    expect(out.price_aed).toBe(4_200_000);
    expect(out.beds).toBe(3);
    expect(out.baths).toBe(4);
    expect(out.built_up_ft2).toBe(2840);
  });

  it("leaves real numbers and nulls alone", () => {
    const out = normaliseEditInput({
      price_aed: 4_200_000,
      beds: 3,
      built_up_ft2: null,
    }) as Record<string, unknown>;
    expect(out.price_aed).toBe(4_200_000);
    expect(out.beds).toBe(3);
    expect(out.built_up_ft2).toBeNull();
  });
});
