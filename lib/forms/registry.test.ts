import { describe, expect, it } from "vitest";
import { FORM_DEFS, getFormDef } from "./registry";
import { defaultForm, resolveForm } from "./resolve";
import { formSaveSchema } from "@/lib/schemas/form";
import { hasOptions } from "./types";
import { ENQUIRY_SOURCES } from "@/lib/schemas/enquiry";
import { getMasterPage } from "@/lib/master-pages";
import {
  LP_BEDROOMS,
  LP_CALL_WINDOWS,
  LP_FURNISHINGS,
  LP_TYPES,
  LP_URGENCIES,
} from "@/lib/schemas/list-property";

/**
 * The registry is a promise: it is what the site renders today. These are the
 * checks that keep it one — the structural rules the manager and the renderer
 * both assume, plus the literal strings for the forms whose wording someone
 * would notice changing.
 */
describe("form registry", () => {
  it("has a unique key per form", () => {
    const keys = FORM_DEFS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses keys the save schema will accept", () => {
    for (const def of FORM_DEFS) {
      expect(def.key).toMatch(/^[a-z][a-z0-9_]*$/);
      for (const field of def.fields) {
        expect(field.key, `${def.key}.${field.key}`).toMatch(
          /^[a-z][a-z0-9_]*$/,
        );
      }
    }
  });

  it("claims each mapping at most once per form", () => {
    for (const def of FORM_DEFS) {
      const claimed = def.fields
        .map((f) => f.mapping)
        .filter((m) => m !== "custom");
      expect(new Set(claimed).size, def.key).toBe(claimed.length);
    }
  });

  it("gives every dropdown something to drop down", () => {
    for (const def of FORM_DEFS) {
      for (const field of def.fields) {
        if (!hasOptions(field.type)) continue;
        const populated =
          field.optionSource != null || (field.options?.length ?? 0) > 0;
        expect(populated, `${def.key}.${field.key}`).toBe(true);
      }
    }
  });

  it("names a real enquiry source on every form that files one", () => {
    for (const def of FORM_DEFS) {
      if (def.handler !== "enquiry" && def.handler !== "service_lead") continue;
      expect(ENQUIRY_SOURCES, def.key).toContain(def.enquirySource);
    }
  });

  it("round-trips every form through the save schema", () => {
    // What the editor sends back on a no-op save has to be valid, or the very
    // first save of an untouched form would fail.
    for (const def of FORM_DEFS) {
      const form = defaultForm(def.key)!;
      const parsed = formSaveSchema.safeParse({
        key: form.key,
        enabled: form.enabled,
        notify_emails: [],
        copy: form.copy,
        fields: form.fields.map((f) => ({
          ...f,
          options: f.options ?? [],
          placeholder: f.placeholder ?? null,
          help: f.help ?? null,
          // The Arabic twins are required-with-null on the save schema, because
          // saveForm deletes and re-inserts every field row — an omitted twin
          // is destroyed, not left alone. The registry literal carries no `_ar`
          // keys, so the editor fills them from the resolved field exactly as
          // this does (see `toSaveField` in the forms editor). Relaxing the
          // schema to `.default(null)` instead would make a client that forgot
          // one wipe stored Arabic silently, which is the failure this
          // strictness exists to prevent.
          label_ar: f.label_ar ?? null,
          placeholder_ar: f.placeholder_ar ?? null,
          help_ar: f.help_ar ?? null,
          unit_ar: f.unit_ar ?? null,
          optionSource: f.optionSource ?? null,
          rows: f.rows ?? null,
          min: f.min ?? null,
          max: f.max ?? null,
          locked: f.locked ?? false,
        })),
      });
      expect(
        parsed.success ? [] : parsed.error.issues.map((i) => i.message),
        def.key,
      ).toEqual([]);
    }
  });

  it("points every condition backwards, at a field with fixed answers", () => {
    // Visibility resolves in one pass down the list. A condition on a later
    // field, on a free-text field, or on an answer that field can't give would
    // hide the question forever — silently, and only in production.
    for (const def of FORM_DEFS) {
      def.fields.forEach((field, index) => {
        const condition = field.showWhen;
        if (!condition) return;
        const at = def.fields.findIndex((f) => f.key === condition.field);
        const where = `${def.key}.${field.key}`;
        expect(at, where).toBeGreaterThanOrEqual(0);
        expect(at, where).toBeLessThan(index);
        const controller = def.fields[at]!;
        expect(hasOptions(controller.type), where).toBe(true);
        const offered = (controller.options ?? []).map(
          (o) => o.value || o.label,
        );
        for (const value of condition.values) {
          expect(offered, `${where} → ${value}`).toContain(value);
        }
      });
    }
  });

  it("gives every slider a scale to slide along", () => {
    for (const def of FORM_DEFS) {
      for (const field of def.fields.filter((f) => f.type === "range")) {
        const where = `${def.key}.${field.key}`;
        expect(field.min, where).not.toBeNull();
        expect(field.max, where).not.toBeNull();
        expect(field.max!, where).toBeGreaterThan(field.min!);
        expect(field.step ?? 0, where).toBeGreaterThan(0);
      }
    }
  });

  it("points every heading link at a section that exists", () => {
    // The manager renders `headingSource` as a link out and tells the editor
    // which words live there. A stale pageKey is a 404 from a CMS screen; a
    // stale sectionKey is worse — the link lands on a real page and the
    // section it promised is not on it, so the editor concludes the copy is
    // not editable anywhere and retypes it into the form.
    const broken: string[] = [];
    for (const form of FORM_DEFS) {
      const source = form.headingSource;
      if (!source) continue;
      const page = getMasterPage(source.pageKey);
      if (!page) {
        broken.push(`${form.key} → unknown page "${source.pageKey}"`);
        continue;
      }
      if (!page.sections.some((s) => s.key === source.sectionKey)) {
        broken.push(
          `${form.key} → ${source.pageKey} has no section "${source.sectionKey}"`,
        );
      }
    }
    expect(broken, broken.join("\n")).toEqual([]);
  });

  it("only marks a field locked when the handler needs it", () => {
    // A locked field can't be deleted or switched off, so the bar is "the
    // submission is impossible without it", not "we'd rather keep it".
    for (const def of FORM_DEFS) {
      for (const field of def.fields.filter((f) => f.locked)) {
        expect(
          ["email", "message", "phone", "name", "consent"],
          `${def.key}.${field.key}`,
        ).toContain(field.mapping);
      }
    }
  });
});

describe("the forms as they render today", () => {
  it("keeps the home owner card's five questions in order", () => {
    const form = defaultForm("home_list_property")!;
    expect(form.fields.map((f) => f.key)).toEqual([
      "first_name",
      "last_name",
      "email",
      "phone",
      "purpose",
    ]);
    expect(form.fields[4]!.options?.map((o) => o.label)).toEqual([
      "Sell Your Property",
      "Rent Your Property",
      "Manage Your Property",
    ]);
    expect(form.copy.submit_label).toBe("Submit");
    expect(form.copy.success_title).toBe("Thanks — we've got it.");
  });

  it("keeps the rent brief's ten questions, and the three that branch on Category", () => {
    const form = defaultForm("rent_hero_enquiry")!;
    expect(form.fields.map((f) => f.key)).toEqual([
      "location",
      "category",
      "property_type",
      "commercial_type",
      "bedrooms",
      "budget",
      "first_name",
      "last_name",
      "email",
      "phone",
    ]);
    expect(form.fields[2]!.showWhen).toEqual({
      field: "category",
      values: ["residential"],
    });
    expect(form.fields[3]!.showWhen).toEqual({
      field: "category",
      values: ["commercial"],
    });
    expect(form.fields[4]!.showWhen?.values).toEqual(["residential"]);
    // The price slider fills both budget columns through the mapping that
    // already parsed "min:max".
    expect(form.fields[5]!.mapping).toBe("budget_band");
    expect(form.fields[5]!.unit).toBe("AED");
    expect(form.copy.submit_label).toBe("Find Rentals");
  });

  it("binds a redirect only to fields the form actually asks", () => {
    // A binding naming a field nobody answers is a filter that silently never
    // applies — the worst kind, because the search still returns results.
    for (const def of FORM_DEFS) {
      const keys = new Set(def.fields.map((f) => f.key));
      for (const key of Object.keys(def.searchRedirect?.bind ?? {})) {
        expect(keys, `${def.key}.${key}`).toContain(key);
      }
    }
  });

  it("keeps the contact enquiry's field order and confirmation", () => {
    const form = defaultForm("contact_enquiry")!;
    expect(form.fields.map((f) => f.key)).toEqual([
      "name",
      "phone",
      "email",
      "intent",
      "message",
    ]);
    expect(form.fields[0]!.width).toBe("half");
    expect(form.fields[1]!.width).toBe("half");
    expect(form.copy.success_body).toContain("within 2 hours");
    expect(form.copy.consent_note).toBe(
      "By submitting you agree to be contacted by a Bazar advisor.",
    );
  });

  it("keeps the off-plan registration asking for a project and a timeline", () => {
    const form = defaultForm("offplan_project_interest")!;
    expect(form.fields.map((f) => f.key)).toEqual([
      "first_name",
      "last_name",
      "email",
      "phone",
      "project",
      "timeline",
      "note",
    ]);
    expect(form.fields[4]!.optionSource).toBe("offplan_projects");
    expect(form.fields[4]!.mapping).toBe("development_id");
    expect(form.copy.submit_label).toBe("Register interest");
  });

  it("asks the mortgage desk's six questions and files them as a mortgage lead", () => {
    const def = getFormDef("mortgage_preapproval")!;
    const form = defaultForm("mortgage_preapproval")!;
    expect(form.fields.map((f) => f.key)).toEqual([
      "name",
      "phone",
      "email",
      "stage",
      "timeline",
      "message",
    ]);
    // A pre-approval cannot be chased anonymously, so both routes are required
    // here where the generic enquiry form takes either.
    expect(form.fields[1]!.required).toBe(true);
    expect(form.fields[2]!.required).toBe(true);
    expect(def.enquirySource).toBe("mortgage");
    expect(form.copy.submit_label).toBe("Request pre-approval");
  });

  it("carries the calculator's scenario in the brief, not in a field", () => {
    // The numbers are supplied by the page at submit time. If they were a
    // field an editor could delete them, and every mortgage lead would arrive
    // saying nothing more than that someone wants a mortgage.
    const def = getFormDef("mortgage_preapproval")!;
    expect(def.briefPrefix).toContain("{scenario|}");
    expect(def.fields.some((f) => f.key === "scenario")).toBe(false);
  });

  it("asks the Buy hero's brief in the order the design specifies", () => {
    const form = defaultForm("buy_hero_enquiry")!;
    expect(form.fields.map((f) => f.key)).toEqual([
      "name",
      "phone",
      "email",
      "purpose",
      "property_type",
      "commercial_type",
      "bedrooms",
      "property_status",
      "location",
      "budget",
      "message",
    ]);
    expect(form.fields.map((f) => f.label)).toEqual([
      "Full Name",
      "Phone Number",
      "Email Address",
      "Property Purpose",
      "Property Type",
      "Property Type",
      "Number of Bedrooms",
      "Property Status",
      "Preferred Location",
      "Budget Range",
      "Message",
    ]);
    expect(form.copy.submit_label).toBe("Find My Property");
  });

  it("offers the two property-type lists the design draws", () => {
    const form = defaultForm("buy_hero_enquiry")!;
    const labels = (key: string) =>
      form.fields.find((f) => f.key === key)!.options?.map((o) => o.label);
    expect(labels("purpose")).toEqual(["Residential", "Commercial"]);
    expect(labels("property_type")).toEqual([
      "Apartment",
      "Townhouse",
      "Villa",
      "Penthouse",
    ]);
    expect(labels("commercial_type")).toEqual([
      "Land",
      "Office",
      "Building",
      "Retail Space",
      "Commercial Villa",
    ]);
    expect(labels("bedrooms")).toEqual([
      "1 Bedroom",
      "2 Bedrooms",
      "3 Bedrooms",
      "4 Bedrooms",
      "5 Bedrooms",
      "6+ Bedrooms",
    ]);
    expect(labels("property_status")).toEqual(["Off-Plan", "Ready", "Resale"]);
  });

  it("still files a Buy lead as a buy, with no intent control to ask", () => {
    const def = getFormDef("buy_hero_enquiry")!;
    expect(def.fields.some((f) => f.mapping === "intent")).toBe(false);
    expect(def.defaultIntent).toBe("buy");
  });

  it("cannot switch the contact page's enquiry box off", () => {
    expect(getFormDef("contact_enquiry")?.alwaysOn).toBe(true);
    // `resolveForm` is the enforcement point, so a stored `enabled: false`
    // still resolves to a visible form.
    const stored = {
      key: "contact_enquiry",
      enabled: false,
      copy: {},
      notify_emails: [],
    };
    expect(defaultForm("contact_enquiry")!.enabled).toBe(true);
    expect(resolveForm("contact_enquiry", stored, null)!.enabled).toBe(true);
  });

  it("leaves the bespoke forms marked as such", () => {
    // These three draw their own inputs and are hard-wired, so the manager must
    // not offer a field editor that would silently do nothing.
    const bespoke = FORM_DEFS.filter((f) => f.control === "copy").map(
      (f) => f.key,
    );
    expect(bespoke.sort()).toEqual(
      [
        "development_floorplan",
        "insights_newsletter",
        "valuation_report_gate",
      ].sort(),
    );
  });

  it("lists the forms that own their wording but not their layout", () => {
    // `labels` is a promise the component has to keep: it reads the resolved
    // wording for every question it draws. Adding a key here without wiring the
    // component gives an editor a box that changes nothing, which is the exact
    // failure the tier was built to end.
    const wordingOnly = FORM_DEFS.filter((f) => f.control === "labels").map(
      (f) => f.key,
    );
    expect(wordingOnly.sort()).toEqual(["services_sell_list_property"]);
  });

  /**
   * The sell wizard, question for question.
   *
   * `/services/sell` draws its own inputs from `messages/{en,ar}/forms.json`,
   * and the manager offers these strings as the thing an editor changes. If the
   * two disagree, the editor is renaming a label that renders nowhere — which
   * is what shipped for six of them: "I want to" against a page reading "I am
   * looking to", "Where is the property?" against "Location", "How soon?"
   * against "How soon do you want to sell?".
   *
   * Held as literals rather than read from the catalogue on purpose: a test
   * that reads both sides from the same file would pass while both were wrong.
   */
  it("asks the sell wizard's questions in the page's own words", () => {
    const def = getFormDef("services_sell_list_property")!;
    const label = (key: string) => def.fields.find((f) => f.key === key)?.label;

    expect(label("intent")).toBe("I am looking to");
    expect(label("location")).toBe("Location");
    expect(label("category")).toBe("Category & type");
    expect(label("property_type")).toBe("Property type");
    expect(label("bedrooms")).toBe("Bedrooms");
    expect(label("area_sqft")).toBe("Built-up area");
    expect(label("furnishing")).toBe("Furnishing");
    expect(label("urgency")).toBe("How soon do you want to sell?");
    expect(label("urgency_rent_out")).toBe("How soon do you want it let?");
    expect(label("name")).toBe("Full name");
    expect(label("mobile")).toBe("Mobile");
    expect(label("email")).toBe("Email");
    expect(label("call_window")).toBe("Best time to call");

    // The consent row is the exception, and says so: the sentence beside the
    // checkbox is legal copy Pages & blocks owns, so this label is the row's
    // name in the manager rather than anything the visitor reads.
    const consent = def.fields.find((f) => f.key === "consent")!;
    expect(consent.copyFromPage).toBe(true);
  });

  /**
   * Option VALUES are the wire format: `listPropertySchema` validates against
   * them and `LP_TYPES_WITHOUT_BEDROOMS` matches "Land" and "Other" by value.
   * A renamed label is copy; a renamed value is a rejected submission.
   */
  it("offers the sell wizard's answers under the values the server accepts", () => {
    const def = getFormDef("services_sell_list_property")!;
    const values = (key: string) =>
      (def.fields.find((f) => f.key === key)?.options ?? []).map((o) => o.value);

    expect(values("intent")).toEqual(["sell", "rent_out"]);
    expect(values("category")).toEqual(["residential", "commercial"]);
    expect(values("property_type")).toEqual([
      ...LP_TYPES.residential,
      ...LP_TYPES.commercial,
    ]);
    expect(values("bedrooms")).toEqual([...LP_BEDROOMS]);
    expect(values("furnishing")).toEqual([...LP_FURNISHINGS]);
    expect(values("urgency")).toEqual([...LP_URGENCIES]);
    expect(values("urgency_rent_out")).toEqual([...LP_URGENCIES]);
    expect(values("call_window")).toEqual([...LP_CALL_WINDOWS]);
  });

  /**
   * The two urgency rows ask the same question of two different owners, so
   * exactly one is ever on screen. A missing or overlapping condition would put
   * both sentences on the page at once.
   */
  it("shows one urgency question per intent", () => {
    const def = getFormDef("services_sell_list_property")!;
    const sell = def.fields.find((f) => f.key === "urgency")!;
    const rent = def.fields.find((f) => f.key === "urgency_rent_out")!;

    expect(sell.showWhen).toEqual({ field: "intent", values: ["sell"] });
    expect(rent.showWhen).toEqual({ field: "intent", values: ["rent_out"] });
  });
});
