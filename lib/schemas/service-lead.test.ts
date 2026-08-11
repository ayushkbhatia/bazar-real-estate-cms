import { describe, it, expect } from "vitest";
import {
  buildServiceBrief,
  normaliseServiceLead,
  serviceLeadSchema,
  SERVICE_PROPERTY_TYPES,
  type ServiceLeadInput,
} from "./service-lead";

const contact = {
  name: "Amal Haddad",
  phone: "+971 50 123 4567",
  email: "Amal@Example.com",
};

const parse = (raw: Record<string, unknown>) =>
  serviceLeadSchema.safeParse(normaliseServiceLead(raw));

const issuePaths = (result: ReturnType<typeof parse>) =>
  result.success ? [] : result.error.issues.map((i) => String(i.path[0]));

describe("serviceLeadSchema", () => {
  it("accepts a complete management lead and lowercases the email", () => {
    const result = parse({
      kind: "management",
      ...contact,
      location: "  Al Reem Island ",
      property_type: "Apartment",
      message: "Two units, both tenanted.",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.email).toBe("amal@example.com");
    expect(result.data.location).toBe("Al Reem Island");
  });

  it("requires the qualification fields the management form asks for", () => {
    const result = parse({ kind: "management", ...contact });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(["location", "property_type"]);
  });

  it("requires an interest on the consultation form, not a location", () => {
    expect(parse({ kind: "consultation", ...contact }).success).toBe(false);
    expect(issuePaths(parse({ kind: "consultation", ...contact }))).toEqual([
      "interest",
    ]);

    const ok = parse({
      kind: "consultation",
      ...contact,
      interest: "Buying",
      intent: "buy",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects an intent the rest of the system doesn't know", () => {
    const result = parse({
      kind: "consultation",
      ...contact,
      interest: "Leasing my yacht",
      intent: "charter",
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("intent");
  });

  it("still asks for a way to reach the person", () => {
    expect(issuePaths(parse({ kind: "consultation", interest: "Buying" }))).toEqual(
      ["name", "phone", "email"],
    );
  });

  it("offers residential and commercial property types, without duplicates", () => {
    expect(SERVICE_PROPERTY_TYPES).toContain("Apartment");
    expect(SERVICE_PROPERTY_TYPES).toContain("Office");
    expect(new Set(SERVICE_PROPERTY_TYPES).size).toBe(
      SERVICE_PROPERTY_TYPES.length,
    );
  });
});

describe("buildServiceBrief", () => {
  it("leads with the lead kind and carries the qualification answers", () => {
    const input: ServiceLeadInput = {
      kind: "management",
      ...contact,
      location: "Al Reem Island",
      property_type: "Apartment",
      message: "Two units, both tenanted.",
    };
    expect(buildServiceBrief(input)).toBe(
      [
        "Property management enquiry",
        "Location: Al Reem Island",
        "Property type: Apartment",
        "",
        "Two units, both tenanted.",
      ].join("\n"),
    );
  });

  it("omits the blank lines a consultation lead never fills", () => {
    expect(
      buildServiceBrief({
        kind: "consultation",
        ...contact,
        interest: "Investing",
        intent: "invest",
      }),
    ).toBe(["Property consultation enquiry", "Interested in: Investing"].join("\n"));
  });
});
