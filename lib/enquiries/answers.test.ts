import { describe, it, expect } from "vitest";
import { getFormDef } from "@/lib/forms/registry";
import type { FormDef } from "@/lib/forms/types";
import { displayAnswer, readAnswers, recordsOnlyAsked } from "./answers";

function def(key: string): FormDef {
  const found = getFormDef(key);
  if (!found) throw new Error(`no form ${key}`);
  return found;
}

/**
 * jsonb hands keys back sorted by length, then bytes — never in the order the
 * form asked them. Every fixture below is built in that order on purpose.
 */
function jsonbOrder(record: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(record).sort(
    (a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0),
  );
  return Object.fromEntries(keys.map((k) => [k, record[k]]));
}

describe("readAnswers — the Buy hero brief", () => {
  const form = def("buy_hero_enquiry");
  const data = jsonbOrder({
    name: "Amira Haddad",
    phone: "+971 50 123 4567",
    email: "amira@example.com",
    purpose: "residential",
    property_type: "Villa",
    bedrooms: "6_plus",
    property_status: "off_plan",
    location: "Saadiyat Island",
    budget: "5000000:8000000",
    message: "Sea view, ready by March if possible.",
  });
  const labels = Object.fromEntries(form.fields.map((f) => [f.key, f.label]));

  const read = readAnswers({ data, labels, def: form, fields: form.fields });

  it("reads the answers in the order the form asks them, not jsonb's", () => {
    expect(read.answers.map((a) => a.key)).toEqual([
      "purpose",
      "property_type",
      "bedrooms",
      "property_status",
      "location",
      "budget",
      "message",
    ]);
  });

  it("shows option labels, not stored values", () => {
    const value = (key: string) =>
      read.answers.find((a) => a.key === key)?.value;
    expect(value("purpose")).toBe("Residential");
    expect(value("bedrooms")).toBe("6+ Bedrooms");
    expect(value("property_status")).toBe("Off-Plan");
  });

  it("reads a slider as a band, in the brief's own wording", () => {
    expect(read.answers.find((a) => a.key === "budget")?.value).toBe(
      "AED 5,000,000 – AED 8,000,000",
    );
  });

  it("leaves the contact block to the lead card", () => {
    const keys = read.answers.map((a) => a.key);
    expect(keys).not.toContain("name");
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("phone");
  });

  it("gives the free-text brief the full width", () => {
    expect(read.answers.find((a) => a.key === "message")?.long).toBe(true);
    expect(read.answers.find((a) => a.key === "purpose")?.long).toBe(false);
  });

  it("reports nothing as skipped when everything was answered", () => {
    expect(read.skipped).toEqual([]);
  });
});

describe("readAnswers — what the visitor left out", () => {
  it("lists a question they were shown and left empty", () => {
    const form = def("offplan_project_interest");
    const read = readAnswers({
      data: jsonbOrder({
        first_name: "Omar",
        last_name: "",
        email: "omar@example.com",
        phone: "+971 501234567",
        project: "",
        timeline: "three_months",
        note: null,
      }),
      labels: {},
      def: form,
      fields: form.fields,
    });
    expect(read.skipped).toEqual(["Project of interest", "Anything else? (optional)"]);
    // An unanswered last name is a contact detail, not a skipped question.
    expect(read.skipped).not.toContain("Last name");
    expect(read.answers.map((a) => a.value)).toEqual(["Next 3 months"]);
  });

  it("does not infer skips from a bespoke handler that writes null for questions it never asked", () => {
    // The owner wizard hides bedrooms for land and stores null anyway.
    const form = def("services_sell_list_property");
    expect(recordsOnlyAsked(form)).toBe(false);
    const read = readAnswers({
      data: jsonbOrder({
        intent: "sell",
        category: "residential",
        property_type: "Land",
        bedrooms: null,
      }),
      labels: {},
      def: form,
      fields: form.fields,
    });
    expect(read.skipped).toEqual([]);
  });
});

describe("readAnswers — labels", () => {
  it("shows the question as the visitor read it when it has been reworded since", () => {
    const form = def("contact_enquiry");
    const read = readAnswers({
      data: { intent: "buy", message: "Looking in Yas." },
      labels: { intent: "What brings you here?", message: "Tell us more" },
      def: form,
      fields: form.fields,
    });
    const intent = read.answers.find((a) => a.key === "intent")!;
    expect(intent.label).toBe("I'm looking to");
    expect(intent.askedAs).toBe("What brings you here?");
    // Unchanged wording isn't repeated.
    expect(read.answers.find((a) => a.key === "message")!.askedAs).toBeNull();
  });

  it("carries the Arabic question for a lead from /ar", () => {
    const form = def("contact_enquiry");
    const read = readAnswers({
      data: { intent: "rent" },
      labels: { intent: "أبحث عن" },
      def: form,
      fields: form.fields,
    });
    expect(read.answers[0]).toMatchObject({
      label: "I'm looking to",
      askedAs: "أبحث عن",
      value: "Rent",
    });
  });

  it("prefers today's label over a bespoke handler's stale constant", () => {
    // The wizard froze "I want to"; the page asks "I am looking to".
    const form = def("services_sell_list_property");
    const read = readAnswers({
      data: { intent: "rent_out", reference: "BZ-RL-4F2A" },
      labels: { intent: "I want to", reference: "Reference" },
      def: form,
      fields: form.fields,
    });
    expect(read.answers[0]).toMatchObject({
      key: "intent",
      label: "I am looking to",
      askedAs: null,
      value: "Rent out",
    });
    // A key with no field keeps its frozen label.
    expect(read.answers[1]).toMatchObject({
      label: "Reference",
      value: "BZ-RL-4F2A",
    });
  });
});

describe("readAnswers — bespoke handlers and context", () => {
  it("reads the valuation gate's numbers and choices", () => {
    const form = def("valuation_report_gate");
    const read = readAnswers({
      data: jsonbOrder({
        email: "a@b.com",
        name: "Layla",
        phone: "+971 55 000 0000",
        intent: "sell",
        valuation_aed: 2_450_000,
        property_summary: "3BR apartment, Al Raha Beach",
      }),
      labels: {
        intent: "Why are you valuing?",
        valuation_aed: "Instant estimate (AED)",
        property_summary: "Property",
      },
      def: form,
      fields: form.fields,
    });
    expect(read.answers).toEqual([
      expect.objectContaining({ key: "intent", value: "Selling soon" }),
      expect.objectContaining({
        key: "property_summary",
        label: "Property",
        value: "3BR apartment, Al Raha Beach",
      }),
      expect.objectContaining({
        key: "valuation_aed",
        label: "Instant estimate (AED)",
        value: "AED 2,450,000",
      }),
    ]);
  });

  it("reads the owner wizard's area with its unit and its consent box", () => {
    const form = def("services_sell_list_property");
    const read = readAnswers({
      data: { area_sqft: 1450, consent: true, furnishing: "semi_furnished" },
      labels: {},
      def: form,
      fields: form.fields,
    });
    expect(read.answers.map((a) => a.value)).toEqual([
      "1,450 ft²",
      "Semi-furnished",
    ]);
    expect(read.consented).toBe(true);
  });

  it("lifts the mortgage scenario out of the answers", () => {
    const form = def("mortgage_preapproval");
    const read = readAnswers({
      data: {
        stage: "comparing",
        _scenario: "Price AED 3,000,000 · 20% down · 25 years · 4.2%",
      },
      labels: { _scenario: "Scenario" },
      def: form,
      fields: form.fields,
    });
    expect(read.scenario).toBe("Price AED 3,000,000 · 20% down · 25 years · 4.2%");
    expect(read.answers.map((a) => a.key)).toEqual(["stage"]);
    expect(read.answers[0]!.value).toBe("Comparing banks");
  });

  it("names the project a development answer points at", () => {
    const form = def("offplan_project_interest");
    const read = readAnswers({
      data: { project: "dev-1" },
      labels: {},
      def: form,
      fields: form.fields,
      records: { development: { id: "dev-1", name: "Saadiyat Lagoons" } },
    });
    expect(read.answers[0]!.value).toBe("Saadiyat Lagoons");

    const orphan = readAnswers({
      data: { project: "dev-gone" },
      labels: {},
      def: form,
      fields: form.fields,
    });
    expect(orphan.answers[0]!.value).toBe("A project no longer on file");
  });

  it("still reads a record whose form is gone", () => {
    const read = readAnswers({
      data: jsonbOrder({ email: "x@y.com", floor: "12", view: "Sea" }),
      labels: { floor: "Which floor?", view: "View" },
      def: null,
      fields: null,
    });
    expect(read.answers).toEqual([
      expect.objectContaining({ key: "floor", label: "Which floor?", value: "12" }),
      expect.objectContaining({ key: "view", label: "View", value: "Sea" }),
    ]);
    expect(read.skipped).toEqual([]);
  });
});

describe("displayAnswer", () => {
  it("treats blanks as no answer and false as one", () => {
    expect(displayAnswer("", "k", null)).toBeNull();
    expect(displayAnswer("   ", "k", null)).toBeNull();
    expect(displayAnswer(null, "k", null)).toBeNull();
    expect(displayAnswer(false, "k", null)).toBe("No");
    expect(displayAnswer(true, "k", null)).toBe("Yes");
  });

  it("humanises a live option's slug it can't look up", () => {
    const field = def("services_manage_lead").fields.find(
      (f) => f.key === "property_type",
    )!;
    expect(displayAnswer("hotel_apartment", "property_type", field)).toBe(
      "Hotel Apartment",
    );
  });

  it("leaves typed prose alone", () => {
    const field = def("buy_hero_enquiry").fields.find(
      (f) => f.key === "location",
    )!;
    expect(displayAnswer("near_the beach", "location", field)).toBe(
      "near_the beach",
    );
  });
});
