import { describe, expect, it } from "vitest";
import { defaultForm } from "./resolve";
import { buildFormBrief, extractLead } from "./submission";
import { buildFormSchema, normaliseSubmission } from "./validate";
import { buildSearchRedirect } from "./search";

/**
 * The /rent brief is the first form whose button navigates, so these hold it
 * to the two halves of that promise: the lead is complete, and the search the
 * visitor lands on is the one they described.
 */

const form = () => defaultForm("rent_hero_enquiry")!;

const areas = [
  { label: "Saadiyat Island", value: "saadiyat-island" },
  { label: "Al Reem Island", value: "al-reem-island" },
];

const residential = {
  location: "Saadiyat Island",
  category: "residential",
  property_type: "villa",
  commercial_type: "office",
  bedrooms: "3:5",
  budget: "150000:400000",
  first_name: "Layla",
  last_name: "Hassan",
  email: "layla@example.com",
  phone: "+971 50 111 2222",
};

const commercial = {
  location: "Mussafah",
  category: "commercial",
  property_type: "villa",
  commercial_type: "retail",
  bedrooms: "3:5",
  budget: "",
  first_name: "Omar",
  last_name: "Aziz",
  email: "omar@example.com",
  phone: "+971 50 333 4444",
};

describe("the rent brief, as the design asks for it", () => {
  it("asks residential for bedrooms and the residential type list", () => {
    const values = normaliseSubmission(form(), residential);
    expect(Object.keys(values)).toEqual([
      "location",
      "category",
      "property_type",
      "bedrooms",
      "budget",
      "first_name",
      "last_name",
      "email",
      "phone",
    ]);
  });

  it("asks commercial for a different type list, and not for bedrooms", () => {
    const values = normaliseSubmission(form(), commercial);
    expect(Object.keys(values)).toContain("commercial_type");
    expect(Object.keys(values)).not.toContain("property_type");
    expect(Object.keys(values)).not.toContain("bedrooms");
  });

  it("doesn't hold a commercial tenant to the residential questions", () => {
    const values = normaliseSubmission(form(), commercial);
    const parsed = buildFormSchema(form(), {}, values).safeParse(values);
    expect(parsed.success ? [] : parsed.error.issues.map((i) => i.message)).toEqual([]);
  });

  it("files the price band on the enquiry and the rest in the brief", () => {
    const values = normaliseSubmission(form(), residential);
    const lead = extractLead(form(), values);
    expect(lead.budgetMin).toBe(150000);
    expect(lead.budgetMax).toBe(400000);
    expect(lead.name).toBe("Layla Hassan");

    const brief = buildFormBrief(form(), lead, values);
    expect(brief).toContain("Rental brief — Residential in Saadiyat Island.");
    expect(brief).toContain("Bedrooms: 3 – 5");
    expect(brief).toContain("Expected Price: AED 150,000 – AED 400,000");
    expect(brief).toContain("Property Type: Villa");
    // The question the visitor never saw doesn't reach the desk.
    expect(brief).not.toContain("Office");
  });

  it("reads an untouched slider as no answer, not as the whole scale", () => {
    const values = normaliseSubmission(form(), commercial);
    const lead = extractLead(form(), values);
    expect(lead.budgetMin).toBeNull();
    expect(lead.budgetMax).toBeNull();
    expect(buildFormBrief(form(), lead, values)).not.toContain("Expected Price");
  });

  it("files the lead as a rental even though nothing asks", () => {
    expect(form().def.defaultIntent).toBe("rent");
    expect(form().fields.some((f) => f.mapping === "intent")).toBe(false);
  });
});

describe("Find Rentals lands on the matching search", () => {
  it("sends a picked community as its slug and the sliders as bounds", () => {
    const values = normaliseSubmission(form(), residential);
    const url = buildSearchRedirect(form(), values, { location: areas });
    const params = new URLSearchParams(url!.split("?")[1]);

    expect(url!.startsWith("/rent/search?")).toBe(true);
    expect(params.get("area")).toBe("saadiyat-island");
    expect(params.get("type")).toBe("villa");
    expect(params.get("beds")).toBe("3");
    expect(params.get("price_min")).toBe("150000");
    expect(params.get("price_max")).toBe("400000");
  });

  it("sends a typed location as free text — an invented slug matches nothing", () => {
    const values = normaliseSubmission(form(), commercial);
    const params = new URLSearchParams(
      buildSearchRedirect(form(), values, { location: areas })!.split("?")[1],
    );
    expect(params.get("q")).toBe("Mussafah");
    expect(params.get("area")).toBeNull();
    expect(params.get("type")).toBe("retail");
  });

  it("leaves out the handles nobody moved, and the questions nobody saw", () => {
    const values = normaliseSubmission(form(), {
      ...residential,
      // Lower handle moved, upper still parked: one bound, not two.
      budget: "150000:",
    });
    const params = new URLSearchParams(
      buildSearchRedirect(form(), values, { location: areas })!.split("?")[1],
    );
    expect(params.get("price_min")).toBe("150000");
    expect(params.get("price_max")).toBeNull();

    const commercialParams = new URLSearchParams(
      buildSearchRedirect(form(), normaliseSubmission(form(), commercial), {
        location: areas,
      })!.split("?")[1],
    );
    // The hidden bedroom answer must not filter what a commercial tenant sees.
    expect(commercialParams.get("beds")).toBeNull();
  });

  it("stays put for a form that doesn't redirect", () => {
    expect(buildSearchRedirect(defaultForm("contact_enquiry")!, {})).toBeNull();
  });
});
