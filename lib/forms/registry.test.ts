import { describe, expect, it } from "vitest";
import { FORM_DEFS, getFormDef } from "./registry";
import { defaultForm, resolveForm } from "./resolve";
import { formSaveSchema } from "@/lib/schemas/form";
import { hasOptions } from "./types";
import { ENQUIRY_SOURCES } from "@/lib/schemas/enquiry";

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
    // These four draw their own inputs, so the manager must not offer a field
    // editor that would silently do nothing.
    const bespoke = FORM_DEFS.filter((f) => f.control === "copy").map(
      (f) => f.key,
    );
    expect(bespoke.sort()).toEqual(
      [
        "development_floorplan",
        "insights_newsletter",
        "services_sell_list_property",
        "valuation_report_gate",
      ].sort(),
    );
  });
});
