import { describe, expect, it } from "vitest";
import { defaultForm } from "./resolve";
import {
  buildFormBrief,
  buildSubmissionData,
  extractLead,
  optionLabel,
} from "./submission";
import {
  buildFormSchema,
  fieldErrorsFrom,
  normaliseSubmission,
} from "./validate";

describe("extractLead", () => {
  it("joins a split name", () => {
    const form = defaultForm("home_list_property")!;
    const lead = extractLead(form, {
      first_name: "Layla",
      last_name: "Hassan",
      email: "LAYLA@example.com",
      phone: "+971 50 111 2222",
      purpose: "rent",
    });
    expect(lead.name).toBe("Layla Hassan");
    expect(lead.email).toBe("layla@example.com");
    expect(lead.phone).toBe("+971 50 111 2222");
  });

  it("reads the intent tag off the chosen option, not the raw value", () => {
    const form = defaultForm("home_list_property")!;
    expect(extractLead(form, { purpose: "manage" }).intent).toBe("manage");
  });

  it("collects unmapped answers as extras, skipping the blanks", () => {
    const form = defaultForm("services_manage_lead")!;
    const lead = extractLead(form, {
      name: "Owner",
      phone: "+97150",
      email: "o@example.com",
      location: "Saadiyat Island",
      property_type: "",
      message: "Two-bed, currently vacant.",
    });
    expect(lead.extras.map((e) => e.key)).toEqual(["location"]);
    expect(lead.extras[0]!.label).toBe("Property Location");
    expect(lead.message).toBe("Two-bed, currently vacant.");
  });
});

describe("buildFormBrief", () => {
  it("frames a form with no message box from its brief prefix", () => {
    const form = defaultForm("home_list_property")!;
    const values = {
      first_name: "Layla",
      last_name: "Hassan",
      email: "l@example.com",
      phone: "",
      purpose: "sell",
    };
    const brief = buildFormBrief(form, extractLead(form, values), values);
    expect(brief).toBe("List my property — Sell Your Property.");
  });

  it("prefixes the visitor's own words when there is a message box", () => {
    const form = defaultForm("offplan_project_interest")!;
    const values = {
      first_name: "Sara",
      last_name: "N",
      email: "s@example.com",
      phone: "",
      project: "dev-1",
      timeline: "now",
      note: "Two bedrooms, sea view.",
    };
    const dynamic = { project: [{ label: "Yas Point", value: "dev-1" }] };
    const brief = buildFormBrief(
      form,
      extractLead(form, values, dynamic),
      values,
      {},
      dynamic,
    );
    expect(brief).toContain("New project interest — Yas Point.");
    expect(brief).toContain("Two bedrooms, sea view.");
  });

  it("writes the mortgage scenario into the brief the page supplied it with", () => {
    const form = defaultForm("mortgage_preapproval")!;
    const values = {
      name: "Omar Haddad",
      phone: "+971 50 111 2222",
      email: "omar@example.com",
      stage: "comparing",
      timeline: "three_months",
      message: "Self-employed, two years of accounts.",
    };
    const scenario = "Property price: AED 4,200,000\nMonthly payment: AED 17,065";
    const brief = buildFormBrief(form, extractLead(form, values), values, {
      scenario,
    });
    expect(brief).toContain("Mortgage pre-approval request.");
    expect(brief).toContain("Property price: AED 4,200,000");
    expect(brief).toContain("Monthly payment: AED 17,065");
    expect(brief).toContain("Self-employed, two years of accounts.");
    // The qualifier reads as its label, not as the value it is stored under.
    expect(brief).toContain("Where are you up to?: Comparing banks");
  });

  it("leaves no token behind when a mortgage lead arrives without a scenario", () => {
    // A hand-rolled POST, or the form re-rendered somewhere that isn't the
    // calculator. The brief must still read as a sentence.
    const form = defaultForm("mortgage_preapproval")!;
    const values = {
      name: "Omar Haddad",
      phone: "+971 50 111 2222",
      email: "omar@example.com",
      stage: "",
      timeline: "",
      message: "",
    };
    const brief = buildFormBrief(form, extractLead(form, values), values, {
      scenario: null,
    });
    expect(brief).toBe("Mortgage pre-approval request.");
  });

  it("falls back to the wording an unanswered dropdown needs", () => {
    const form = defaultForm("offplan_project_interest")!;
    const values = { note: "", project: "", timeline: "now" };
    const brief = buildFormBrief(form, extractLead(form, values), values);
    expect(brief).toContain("New project interest — Not sure yet.");
  });

  it("appends an editor's new question as a labelled line", () => {
    const base = defaultForm("contact_enquiry")!;
    const form = {
      ...base,
      fields: [
        ...base.fields,
        {
          key: "floor",
          label: "Which floor?",
          type: "text" as const,
          mapping: "custom" as const,
          required: false,
          enabled: true,
          width: "full" as const,
        },
      ],
    };
    const values = {
      name: "Ali",
      email: "a@example.com",
      phone: "",
      intent: "buy",
      message: "Looking on Reem.",
      floor: "12th",
    };
    const brief = buildFormBrief(form, extractLead(form, values), values);
    expect(brief).toContain("Looking on Reem.");
    expect(brief).toContain("Which floor?: 12th");
  });
});

describe("buildSubmissionData", () => {
  it("freezes the labels alongside the answers", () => {
    const form = defaultForm("insights_newsletter")!;
    const data = buildSubmissionData(form, { email: "a@example.com" });
    expect(data.email).toBe("a@example.com");
    expect(data._labels).toEqual({ email: "Email" });
  });
});

describe("optionLabel", () => {
  it("reads back the label a visitor actually saw", () => {
    const form = defaultForm("home_list_property")!;
    const purpose = form.fields.find((f) => f.key === "purpose")!;
    expect(optionLabel(purpose, "rent")).toBe("Rent Your Property");
    // An option deleted since submission has no label left to find; the stored
    // value is better than an empty cell.
    expect(optionLabel(purpose, "gone")).toBe("gone");
  });
});

describe("buildFormSchema", () => {
  it("accepts an enquiry with a phone but no email", () => {
    const form = defaultForm("contact_enquiry")!;
    const values = normaliseSubmission(form, {
      name: "Ali",
      phone: "+971 50 111 2222",
      email: "",
      intent: "buy",
      message: "Looking on Reem.",
    });
    expect(buildFormSchema(form).safeParse(values).success).toBe(true);
  });

  it("rejects an enquiry with neither", () => {
    const form = defaultForm("contact_enquiry")!;
    const values = normaliseSubmission(form, {
      name: "Ali",
      phone: "",
      email: "",
      intent: "buy",
      message: "Looking on Reem.",
    });
    const parsed = buildFormSchema(form).safeParse(values);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(fieldErrorsFrom(parsed.error).email).toBe(
        "We need at least an email or a phone number",
      );
    }
  });

  it("applies a requirement an editor added", () => {
    const base = defaultForm("contact_enquiry")!;
    const form = {
      ...base,
      fields: base.fields.map((f) =>
        f.key === "phone" ? { ...f, required: true } : f,
      ),
    };
    const values = normaliseSubmission(form, {
      name: "Ali",
      phone: "",
      email: "ali@example.com",
      intent: "buy",
      message: "Looking on Reem.",
    });
    expect(buildFormSchema(form).safeParse(values).success).toBe(false);
  });

  it("rejects an option that isn't on offer", () => {
    const form = defaultForm("home_list_property")!;
    const values = normaliseSubmission(form, {
      first_name: "Layla",
      last_name: "Hassan",
      email: "l@example.com",
      phone: "+971 50 111 2222",
      purpose: "demolish",
    });
    expect(buildFormSchema(form).safeParse(values).success).toBe(false);
  });

  it("ignores a field the editor switched off", () => {
    const base = defaultForm("contact_enquiry")!;
    const form = {
      ...base,
      fields: base.fields.map((f) =>
        f.key === "intent" ? { ...f, enabled: false } : f,
      ),
    };
    const values = normaliseSubmission(form, {
      name: "Ali",
      phone: "+971 50 111 2222",
      email: "",
      message: "Looking on Reem.",
    });
    expect(buildFormSchema(form).safeParse(values).success).toBe(true);
    expect(values).not.toHaveProperty("intent");
  });
});

describe("normaliseSubmission", () => {
  it("coerces a checkbox, a number and an address", () => {
    const base = defaultForm("contact_enquiry")!;
    const form = {
      ...base,
      fields: [
        ...base.fields,
        {
          key: "budget",
          label: "Budget",
          type: "number" as const,
          mapping: "budget_max" as const,
          required: false,
          enabled: true,
          width: "full" as const,
        },
        {
          key: "consent",
          label: "Consent",
          type: "checkbox" as const,
          mapping: "consent" as const,
          required: false,
          enabled: true,
          width: "full" as const,
        },
      ],
    };
    const values = normaliseSubmission(form, {
      name: " Ali ",
      email: " ALI@Example.COM ",
      phone: "",
      message: "Hi",
      budget: "1,450,000",
      consent: "on",
    });
    expect(values.name).toBe("Ali");
    expect(values.email).toBe("ali@example.com");
    expect(values.budget).toBe(1450000);
    expect(values.consent).toBe(true);
  });
});
