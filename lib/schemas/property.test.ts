import { describe, it, expect } from "vitest";
import { MAX_AMENITIES } from "@/lib/amenities";
import {
  propertyOverviewSchema,
  propertyPricingSchema,
  propertyDetailsSchema,
  propertyLocationSchema,
  propertyAmenitiesSchema,
  propertySeoSchema,
  propertyEditSchema,
  propertyCreateSchema,
  normaliseEditInput,
  formForMode,
  isSaleMode,
  toSelectableForm,
  PROPERTY_FORMS,
  PROPERTY_FORM_HINTS,
  PROPERTY_FORM_LABELS,
  PROPERTY_MODES,
} from "./property";

describe("propertyOverviewSchema", () => {
  it("accepts a valid overview", () => {
    const res = propertyOverviewSchema.safeParse({
      title: "Mamsha · 3-bed beachfront",
      short_description: "Three-bedroom apartment with sea views.",
      type: "apartment",
      mode: "buy",
      developer_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(res.success).toBe(true);
  });

  it("requires a developer", () => {
    const res = propertyOverviewSchema.safeParse({
      title: "A perfectly fine title",
      type: "apartment",
      mode: "buy",
    });
    expect(res.success).toBe(false);
    if (!res.success)
      expect(res.error.issues.some((i) => i.path[0] === "developer_id")).toBe(
        true,
      );
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
});

describe("propertyDetailsSchema", () => {
  it("accepts a fully-populated details payload", () => {
    const res = propertyDetailsSchema.safeParse({
      year_built: 2023,
      tenure: "freehold",
      furnishing: "fully",
      view: "Sea view",
      orientation: "North-east",
      parking_bays: 2,
      floor: 7,
      address_line: "Mamsha Al Saadiyat",
      listing_permit_no: "ORN-12345-AD",
      listing_permit_expires_at: "2026-12-31",
      dld_plot_number: "PLOT-001-A",
    });
    expect(res.success).toBe(true);
  });

  it("rejects a year_built outside the plausible range", () => {
    const r1 = propertyDetailsSchema.safeParse({ year_built: 1800 });
    expect(r1.success).toBe(false);
    const r2 = propertyDetailsSchema.safeParse({ year_built: 2200 });
    expect(r2.success).toBe(false);
  });

  it("rejects an invalid date for listing_permit_expires_at", () => {
    const res = propertyDetailsSchema.safeParse({
      listing_permit_expires_at: "not-a-date",
    });
    expect(res.success).toBe(false);
  });

  it("accepts nullable / empty fields", () => {
    const res = propertyDetailsSchema.safeParse({});
    expect(res.success).toBe(true);
  });
});

describe("propertyLocationSchema", () => {
  it("accepts a valid UUID", () => {
    const res = propertyLocationSchema.safeParse({
      area_id: "11111111-0000-0000-0000-000000000002",
    });
    expect(res.success).toBe(true);
  });

  it("accepts null + transforms empty string to null", () => {
    const res = propertyLocationSchema.safeParse({ area_id: "" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.area_id).toBeNull();
  });

  it("rejects a non-UUID string", () => {
    const res = propertyLocationSchema.safeParse({
      area_id: "not-a-uuid",
    });
    expect(res.success).toBe(false);
  });
});

describe("propertyAmenitiesSchema", () => {
  it("accepts up to the cap", () => {
    const res = propertyAmenitiesSchema.safeParse({
      amenities: ["Pool", "Gym", "Concierge"],
    });
    expect(res.success).toBe(true);
  });

  // The cap is one above the 50 a listing is meant to be able to hold, so a
  // full 50 selections never lands on the boundary.
  it("accepts a full 50 with room to spare", () => {
    const res = propertyAmenitiesSchema.safeParse({
      amenities: Array.from({ length: 50 }, (_, i) => `Item ${i}`),
    });
    expect(res.success).toBe(true);
  });

  it("rejects beyond the cap", () => {
    const res = propertyAmenitiesSchema.safeParse({
      amenities: Array.from({ length: MAX_AMENITIES + 1 }, (_, i) => `Item ${i}`),
    });
    expect(res.success).toBe(false);
  });

  it("rejects when amenities is missing (callers must default to [])", () => {
    const res = propertyAmenitiesSchema.safeParse({});
    expect(res.success).toBe(false);
  });
});

describe("propertySeoSchema", () => {
  it("accepts a lowercase hyphenated slug", () => {
    const res = propertySeoSchema.safeParse({
      slug: "mamsha-3-bed-beachfront-apartment",
      meta_title: "Mamsha 3-bed",
      meta_description: "Three-bed Saadiyat apartment.",
    });
    expect(res.success).toBe(true);
  });

  it("rejects uppercase or spaces in slug", () => {
    const r1 = propertySeoSchema.safeParse({
      slug: "Mamsha 3-Bed",
    });
    expect(r1.success).toBe(false);
    const r2 = propertySeoSchema.safeParse({
      slug: "mamsha_3_bed",
    });
    expect(r2.success).toBe(false);
  });

  it("rejects meta_description over 180 characters", () => {
    const res = propertySeoSchema.safeParse({
      slug: "ok-slug",
      meta_description: "x".repeat(181),
    });
    expect(res.success).toBe(false);
  });
});

describe("propertyEditSchema (merged)", () => {
  it("validates a full payload across all tabs", () => {
    const res = propertyEditSchema.safeParse({
      title: "A valid title",
      type: "apartment",
      mode: "buy",
      developer_id: "11111111-1111-1111-1111-111111111111",
      price_aed: 1_000_000,
      beds: 1,
      baths: 1,
      amenities: ["Pool"],
      slug: "valid-slug",
    });
    expect(res.success).toBe(true);
  });

  it("collects errors from multiple tabs", () => {
    const res = propertyEditSchema.safeParse({
      title: "Hi",
      type: "apartment",
      mode: "buy",
      price_aed: -1,
      beds: 1,
      baths: 1,
      slug: "Bad Slug",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("title");
      expect(paths).toContain("price_aed");
      expect(paths).toContain("slug");
    }
  });
});

describe("propertyCreateSchema", () => {
  it("requires the minimal create fields", () => {
    const res = propertyCreateSchema.safeParse({
      title: "New listing",
      type: "apartment",
      mode: "buy",
      price_aed: 1_000_000,
      beds: 2,
      baths: 2,
    });
    expect(res.success).toBe(true);
  });

  it("rejects missing price", () => {
    const res = propertyCreateSchema.safeParse({
      title: "New listing",
      type: "apartment",
      mode: "buy",
      beds: 2,
      baths: 2,
    });
    expect(res.success).toBe(false);
  });
});

describe("normaliseEditInput", () => {
  it("turns empty strings into nulls for nullable fields", () => {
    const out = normaliseEditInput({
      short_description: "",
      view: "",
      orientation: "",
      year_built: "",
      service_charge_per_ft2: "",
      built_up_ft2: "",
      listing_permit_no: "",
      listing_permit_expires_at: "",
    }) as Record<string, unknown>;
    expect(out.short_description).toBeNull();
    expect(out.view).toBeNull();
    expect(out.year_built).toBeNull();
    expect(out.service_charge_per_ft2).toBeNull();
    expect(out.listing_permit_expires_at).toBeNull();
  });

  it("coerces numeric strings to numbers", () => {
    const out = normaliseEditInput({
      price_aed: "4200000",
      beds: "3",
      baths: "4",
      built_up_ft2: "2840",
      year_built: "2023",
      parking_bays: "2",
    }) as Record<string, unknown>;
    expect(out.price_aed).toBe(4_200_000);
    expect(out.beds).toBe(3);
    expect(out.baths).toBe(4);
    expect(out.built_up_ft2).toBe(2840);
    expect(out.year_built).toBe(2023);
    expect(out.parking_bays).toBe(2);
  });

  it("splits a comma-separated amenities string into an array", () => {
    const out = normaliseEditInput({
      amenities: "Pool, Gym , Concierge , ",
    }) as Record<string, unknown>;
    expect(out.amenities).toEqual(["Pool", "Gym", "Concierge"]);
  });

  it("handles a newline-separated amenities string", () => {
    const out = normaliseEditInput({
      amenities: "Pool\nGym\nConcierge",
    }) as Record<string, unknown>;
    expect(out.amenities).toEqual(["Pool", "Gym", "Concierge"]);
  });

  it("leaves arrays alone, defaults non-array/non-string to []", () => {
    expect(
      (normaliseEditInput({ amenities: ["Pool", "Gym"] }) as Record<string, unknown>)
        .amenities,
    ).toEqual(["Pool", "Gym"]);
    expect(
      (normaliseEditInput({ amenities: undefined }) as Record<string, unknown>)
        .amenities,
    ).toEqual([]);
  });

  it("tidies and de-duplicates a custom amenity array from the picker", () => {
    // The picker lets a lister type free text, so the server can't assume the
    // array is already clean.
    const out = normaliseEditInput({
      amenities: ["Pool", "pool ", " Rooftop   cinema", "", 7],
    }) as Record<string, unknown>;
    expect(out.amenities).toEqual(["Pool", "Rooftop cinema"]);
  });
});

// --- Property form (completion axis) --------------------------------------
//
// `ready_new` means "developer first sale, never previously owned" — it is
// provenance, not age. `off_plan` became selectable in 0110: off-plan is a way
// of buying, so it is written on the completion axis as well as on `mode`, and
// a DB trigger keeps the two spellings in step.

const BASE_OVERVIEW = {
  title: "Saadiyat · 3-bed garden villa",
  type: "villa",
  developer_id: "11111111-1111-1111-1111-111111111111",
} as const;

describe("PROPERTY_FORMS", () => {
  it("offers the three completion forms, off-plan first", () => {
    expect(PROPERTY_FORMS).toEqual(["off_plan", "ready_new", "resale"]);
  });

  it("offers off_plan, which 0110 made a written value", () => {
    expect(PROPERTY_FORMS).toContain("off_plan");
  });

  it("labels every selectable form", () => {
    for (const form of PROPERTY_FORMS) {
      expect(PROPERTY_FORM_LABELS[form]).toBeTruthy();
      expect(PROPERTY_FORM_HINTS[form]).toBeTruthy();
    }
    expect(PROPERTY_FORM_LABELS.ready_new).toBe("Ready (new)");
  });

  it("spells out that Ready (new) is about never having been owned", () => {
    expect(PROPERTY_FORM_HINTS.ready_new).toMatch(/never previously owned/i);
  });
});

describe("isSaleMode", () => {
  it("treats buy and commercial as sale modes", () => {
    expect(isSaleMode("buy")).toBe(true);
    expect(isSaleMode("commercial")).toBe(true);
  });

  it("counts off_plan as a sale mode — buying a plan is still buying", () => {
    expect(isSaleMode("off_plan")).toBe(true);
  });

  it("excludes rent, which the DB check keeps form-free", () => {
    expect(isSaleMode("rent")).toBe(false);
  });

  it("is safe on null/undefined/garbage", () => {
    expect(isSaleMode(null)).toBe(false);
    expect(isSaleMode(undefined)).toBe(false);
    expect(isSaleMode("nonsense")).toBe(false);
  });
});

describe("toSelectableForm", () => {
  it("passes through the two selectable forms", () => {
    expect(toSelectableForm("ready_new")).toBe("ready_new");
    expect(toSelectableForm("resale")).toBe("resale");
  });

  it("passes off_plan through — the picker renders it since 0110", () => {
    expect(toSelectableForm("off_plan")).toBe("off_plan");
  });

  it("collapses empty, null, undefined, and unknown values to null", () => {
    expect(toSelectableForm("")).toBeNull();
    expect(toSelectableForm(null)).toBeNull();
    expect(toSelectableForm(undefined)).toBeNull();
    expect(toSelectableForm("READY_NEW")).toBeNull();
  });
});

describe("formForMode", () => {
  it("keeps the form on sale modes", () => {
    expect(formForMode("buy", "resale")).toBe("resale");
    expect(formForMode("commercial", "ready_new")).toBe("ready_new");
  });

  it("clears the form when the mode moves to rent", () => {
    expect(formForMode("rent", "resale")).toBeNull();
  });

  it("keeps the form on off_plan, which is a sale mode now", () => {
    expect(formForMode("off_plan", "off_plan")).toBe("off_plan");
  });

  it("stays null when there was no form to begin with", () => {
    expect(formForMode("buy", null)).toBeNull();
    expect(formForMode("buy", undefined)).toBeNull();
  });
});

describe("property_form validation", () => {
  it("accepts a form on a buy listing", () => {
    const res = propertyOverviewSchema.safeParse({
      ...BASE_OVERVIEW,
      mode: "buy",
      property_form: "ready_new",
    });
    expect(res.success).toBe(true);
  });

  it("accepts a form on a commercial listing", () => {
    const res = propertyOverviewSchema.safeParse({
      ...BASE_OVERVIEW,
      mode: "commercial",
      property_form: "resale",
    });
    expect(res.success).toBe(true);
  });

  it("rejects a form on a rent listing, flagged on property_form", () => {
    const res = propertyOverviewSchema.safeParse({
      ...BASE_OVERVIEW,
      mode: "rent",
      property_form: "resale",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const issue = res.error.issues.find(
        (i) => i.path[0] === "property_form",
      );
      expect(issue?.message).toMatch(/rent/i);
    }
  });

  it("accepts a null form on every mode", () => {
    for (const mode of PROPERTY_MODES) {
      expect(
        propertyOverviewSchema.safeParse({
          ...BASE_OVERVIEW,
          mode,
          property_form: null,
        }).success,
      ).toBe(true);
    }
  });

  it("accepts an omitted form on every mode", () => {
    for (const mode of PROPERTY_MODES) {
      expect(
        propertyOverviewSchema.safeParse({ ...BASE_OVERVIEW, mode }).success,
      ).toBe(true);
    }
  });

  it("accepts off_plan as a property_form on a buy row", () => {
    const res = propertyOverviewSchema.safeParse({
      ...BASE_OVERVIEW,
      mode: "buy",
      property_form: "off_plan",
    });
    expect(res.success).toBe(true);
  });

  it("applies the same rule on the full edit schema", () => {
    const base = {
      ...BASE_OVERVIEW,
      price_aed: 3_200_000,
      beds: 3,
      baths: 4,
      amenities: [],
      slug: "saadiyat-3-bed-garden-villa",
    };
    expect(
      propertyEditSchema.safeParse({
        ...base,
        mode: "buy",
        property_form: "resale",
      }).success,
    ).toBe(true);
    expect(
      propertyEditSchema.safeParse({
        ...base,
        mode: "rent",
        property_form: "resale",
      }).success,
    ).toBe(false);
    expect(
      propertyEditSchema.safeParse({
        ...base,
        mode: "rent",
        property_form: null,
      }).success,
    ).toBe(true);
  });

  it("applies the same rule on the create schema", () => {
    const base = {
      title: "New listing",
      type: "apartment",
      price_aed: 1_000_000,
      beds: 2,
      baths: 2,
    };
    expect(
      propertyCreateSchema.safeParse({
        ...base,
        mode: "buy",
        property_form: "ready_new",
      }).success,
    ).toBe(true);
    expect(
      propertyCreateSchema.safeParse({
        ...base,
        mode: "rent",
        property_form: "ready_new",
      }).success,
    ).toBe(false);
    expect(
      propertyCreateSchema.safeParse({ ...base, mode: "rent" }).success,
    ).toBe(true);
  });

  it("normalises a blank form field to null before validation", () => {
    const out = normaliseEditInput({ property_form: "" }) as Record<
      string,
      unknown
    >;
    expect(out.property_form).toBeNull();

    const missing = normaliseEditInput({}) as Record<string, unknown>;
    expect(missing.property_form).toBeNull();
  });
});
