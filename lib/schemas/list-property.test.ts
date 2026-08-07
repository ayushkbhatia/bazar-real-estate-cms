import { describe, expect, it } from "vitest";
import {
  bedroomsApply,
  buildBrief,
  buildReference,
  buildSummary,
  listPropertySchema,
  normaliseUaeMobile,
  parseAreaSqft,
  toEnquiryTimeline,
  type ListPropertyInput,
} from "./list-property";

const VALID: ListPropertyInput = {
  intent: "sell",
  location: "Saadiyat Island",
  area_slug: "saadiyat-island",
  category: "residential",
  property_type: "Apartment",
  bedrooms: "2",
  area_sqft: 1450,
  furnishing: "fully_furnished",
  urgency: "two_months",
  name: "Aisha Al Nuaimi",
  mobile: "50 123 4567",
  email: "Aisha@Example.com",
  call_window: "afternoon",
  consent: true,
};

describe("normaliseUaeMobile", () => {
  it("accepts the shapes owners actually type", () => {
    for (const raw of [
      "501234567",
      "50 123 4567",
      "050-123-4567",
      "+971 50 123 4567",
      "00971501234567",
    ]) {
      expect(normaliseUaeMobile(raw), raw).toBe("+971501234567");
    }
  });

  it("accepts an Abu Dhabi landline", () => {
    expect(normaliseUaeMobile("2 632 2223")).toBe("+97126322223");
  });

  it("rejects numbers that aren't UAE-shaped", () => {
    for (const raw of ["", "123", "5012345678901", "+44 7700 900000"]) {
      expect(normaliseUaeMobile(raw), raw).toBeNull();
    }
  });
});

describe("parseAreaSqft", () => {
  it("strips the separators the field allows", () => {
    expect(parseAreaSqft("1,450")).toBe(1450);
    expect(parseAreaSqft("1450")).toBe(1450);
  });

  it("returns null for an empty field", () => {
    expect(parseAreaSqft("")).toBeNull();
    expect(parseAreaSqft(",,")).toBeNull();
  });
});

describe("bedroomsApply", () => {
  it("is a residential question only", () => {
    expect(bedroomsApply("residential", "Apartment")).toBe(true);
    expect(bedroomsApply("commercial", "Office")).toBe(false);
  });

  it("skips land and other", () => {
    expect(bedroomsApply("residential", "Land")).toBe(false);
    expect(bedroomsApply("residential", "Other")).toBe(false);
  });

  it("is false until a type is picked", () => {
    expect(bedroomsApply("residential", "")).toBe(false);
  });
});

describe("listPropertySchema", () => {
  it("accepts a filled-in form", () => {
    const parsed = listPropertySchema.safeParse(VALID);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("aisha@example.com");
  });

  it("requires bedrooms when the type carries them", () => {
    const parsed = listPropertySchema.safeParse({ ...VALID, bedrooms: null });
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues[0]?.path).toEqual(["bedrooms"]);
  });

  it("does not require bedrooms for land", () => {
    const parsed = listPropertySchema.safeParse({
      ...VALID,
      property_type: "Land",
      bedrooms: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a type from the other category", () => {
    const parsed = listPropertySchema.safeParse({
      ...VALID,
      category: "commercial",
      property_type: "Apartment",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a submission without consent", () => {
    const parsed = listPropertySchema.safeParse({ ...VALID, consent: false });
    expect(parsed.success).toBe(false);
  });

  it("rejects an implausible built-up area", () => {
    expect(listPropertySchema.safeParse({ ...VALID, area_sqft: 4 }).success).toBe(
      false,
    );
  });

  it("rejects a non-UAE mobile", () => {
    expect(
      listPropertySchema.safeParse({ ...VALID, mobile: "+44 7700 900000" })
        .success,
    ).toBe(false);
  });
});

describe("buildSummary", () => {
  it("joins the answers the advisor needs at a glance", () => {
    expect(buildSummary(VALID)).toBe(
      "For sale · Saadiyat Island · Apartment · 2 bed · 1,450 ft²",
    );
  });

  it("says studio rather than '(Studio) bed'", () => {
    expect(buildSummary({ ...VALID, bedrooms: "Studio" })).toContain("Studio");
    expect(buildSummary({ ...VALID, bedrooms: "Studio" })).not.toContain(
      "Studio bed",
    );
  });

  it("drops bedrooms the type doesn't have", () => {
    const summary = buildSummary({
      ...VALID,
      property_type: "Land",
      bedrooms: "2",
    });
    expect(summary).not.toContain("bed");
  });

  it("switches the lead-in for a letting", () => {
    expect(buildSummary({ ...VALID, intent: "rent_out" })).toMatch(
      /^To rent out ·/,
    );
  });
});

describe("buildReference", () => {
  it("is stable for a given enquiry", () => {
    const id = "3f2a1b4c-0000-0000-0000-000000000001";
    expect(buildReference(id, "sell")).toBe(buildReference(id, "sell"));
  });

  it("marks sale and letting apart", () => {
    const id = "3f2a1b4c-0000-0000-0000-000000000001";
    expect(buildReference(id, "sell")).toMatch(/^BZ-SL-\d{5}$/);
    expect(buildReference(id, "rent_out")).toMatch(/^BZ-RL-\d{5}$/);
  });
});

describe("buildBrief", () => {
  it("quotes the reference so the desk can find the lead by it", () => {
    const brief = buildBrief({ ...VALID, reference: "BZ-SL-48210" });
    expect(brief).toContain("BZ-SL-48210");
    expect(brief).toContain("Saadiyat Island");
    expect(brief).toContain("Best time to call: Afternoon");
  });
});

describe("toEnquiryTimeline", () => {
  it("maps urgency onto the enquiry timeline the desk filters on", () => {
    expect(toEnquiryTimeline("this_month")).toBe("now");
    expect(toEnquiryTimeline("two_months")).toBe("three_months");
    expect(toEnquiryTimeline("flexible")).toBe("browsing");
    expect(toEnquiryTimeline(null)).toBeNull();
  });
});
