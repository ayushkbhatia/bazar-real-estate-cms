import { describe, expect, it } from "vitest";
import {
  activeFields,
  defaultForm,
  renderFormCopy,
  resolveForm,
  visibleFields,
  type StoredField,
} from "./resolve";
import { getFormDef } from "./registry";
import type { FormFieldDef } from "./types";

function stored(overrides: Partial<StoredField> & { key: string }): StoredField {
  return {
    label: "Question",
    type: "text",
    mapping: "custom",
    placeholder: null,
    help: null,
    required: false,
    enabled: true,
    width: "full",
    options: [],
    optionSource: null,
    rows: null,
    min: null,
    max: null,
    locked: false,
    position: 10,
    ...overrides,
  };
}

describe("resolveForm", () => {
  it("renders the registry's fields when nothing is stored", () => {
    const def = getFormDef("home_list_property")!;
    const form = resolveForm("home_list_property", null, null)!;
    expect(form.fields).toEqual(def.fields);
    expect(form.usingDefaults).toBe(true);
  });

  it("lets storage win completely once any field row exists", () => {
    // The point of the manager: a registry field the editor deleted stays
    // deleted, rather than reappearing on the next deploy.
    const form = resolveForm(
      "home_list_property",
      null,
      [
        stored({ key: "email", label: "Your email", mapping: "email", type: "email", position: 10 }),
        stored({ key: "floor", label: "Which floor?", position: 20 }),
      ],
    )!;
    expect(form.fields.map((f) => f.key)).toEqual(["email", "floor"]);
    expect(form.fields[0]!.label).toBe("Your email");
  });

  it("orders stored fields by position, not by arrival", () => {
    const form = resolveForm("home_list_property", null, [
      stored({ key: "second", position: 20 }),
      stored({ key: "first", position: 10 }),
    ])!;
    expect(form.fields.map((f) => f.key)).toEqual(["first", "second"]);
  });

  it("re-attaches a locked field that storage dropped", () => {
    // The message box on the contact form is locked; a stored document
    // without it would otherwise resolve to a form `createEnquiry` rejects.
    const form = resolveForm("contact_enquiry", null, [
      stored({ key: "name", label: "Name", mapping: "name", position: 10 }),
      stored({ key: "email", label: "Email", mapping: "email", type: "email", position: 20 }),
    ])!;
    expect(form.fields.map((f) => f.key)).toContain("message");
  });

  it("puts a re-attached locked field back where it belongs", () => {
    const form = resolveForm("insights_newsletter", null, [
      stored({ key: "note", label: "Anything else?", position: 10 }),
    ])!;
    // Email is first in the registry, so it lands ahead of the stored field
    // rather than being appended after it.
    expect(form.fields.map((f) => f.key)).toEqual(["email", "note"]);
  });

  it("falls back per copy key, so a partial document still renders", () => {
    const form = resolveForm(
      "home_list_property",
      {
        key: "home_list_property",
        enabled: true,
        copy: { submit_label: "Book my valuation" },
        notify_emails: [],
      },
      null,
    )!;
    expect(form.copy.submit_label).toBe("Book my valuation");
    expect(form.copy.success_title).toBe(
      getFormDef("home_list_property")!.copy.success_title,
    );
  });

  it("keeps an explicitly cleared optional string cleared", () => {
    const form = resolveForm(
      "contact_enquiry",
      {
        key: "contact_enquiry",
        enabled: true,
        copy: { consent_note: null },
        notify_emails: [],
      },
      null,
    )!;
    expect(form.copy.consent_note).toBeNull();
  });

  it("returns null for a key the registry doesn't know", () => {
    expect(resolveForm("not_a_form", null, null)).toBeNull();
    expect(defaultForm("not_a_form")).toBeNull();
  });
});

describe("visibleFields", () => {
  it("drops the fields an editor switched off", () => {
    const form = resolveForm("home_list_property", null, [
      stored({ key: "email", mapping: "email", type: "email", position: 10 }),
      stored({ key: "phone", mapping: "phone", enabled: false, position: 20 }),
    ])!;
    expect(visibleFields(form).map((f: FormFieldDef) => f.key)).toEqual([
      "email",
    ]);
  });
});

describe("activeFields", () => {
  const buy = () => defaultForm("buy_hero_enquiry")!;

  it("asks only the residential branch when the purpose is residential", () => {
    const keys = activeFields(buy(), { purpose: "residential" }).map(
      (f) => f.key,
    );
    expect(keys).toContain("property_type");
    expect(keys).toContain("bedrooms");
    expect(keys).not.toContain("commercial_type");
  });

  it("swaps the type list and drops bedrooms for a commercial brief", () => {
    // A warehouse does not have three of them.
    const keys = activeFields(buy(), { purpose: "commercial" }).map(
      (f) => f.key,
    );
    expect(keys).toContain("commercial_type");
    expect(keys).not.toContain("property_type");
    expect(keys).not.toContain("bedrooms");
  });

  it("asks neither branch before the purpose is answered", () => {
    const keys = activeFields(buy(), {}).map((f) => f.key);
    expect(keys).toEqual([
      "name",
      "phone",
      "email",
      "purpose",
      "property_status",
      "location",
      "budget",
      "message",
    ]);
  });

  it("takes a whole branch down with the field it hangs off", () => {
    // A condition pointing at a question that isn't being asked — switched
    // off, deleted, or hidden itself — fails rather than passing by default.
    const form = resolveForm("buy_hero_enquiry", null, [
      stored({ key: "purpose", type: "chips", enabled: false, position: 10 }),
      stored({
        key: "bedrooms",
        type: "select",
        showWhen: { field: "purpose", values: ["residential"] },
        position: 20,
      }),
    ])!;
    expect(activeFields(form, { purpose: "residential" }).map((f) => f.key)).not.toContain(
      "bedrooms",
    );
  });

  it("leaves unconditional forms exactly as visibleFields sees them", () => {
    const form = defaultForm("contact_enquiry")!;
    expect(activeFields(form, {}).map((f) => f.key)).toEqual(
      visibleFields(form).map((f) => f.key),
    );
  });
});

describe("renderFormCopy", () => {
  it("substitutes a token", () => {
    expect(
      renderFormCopy("Interest in {project}", { project: "Yas Point" }),
    ).toBe("Interest in Yas Point");
  });

  it("uses the fallback when the token is empty", () => {
    expect(renderFormCopy("Project — {project|Not sure yet}", {})).toBe(
      "Project — Not sure yet",
    );
    expect(
      renderFormCopy("Project — {project|Not sure yet}", { project: "" }),
    ).toBe("Project — Not sure yet");
  });

  it("leaves an unknown token alone rather than eating the sentence", () => {
    expect(renderFormCopy("Hello {mystery}", {})).toBe("Hello {mystery}");
  });

  it("passes null through", () => {
    expect(renderFormCopy(null, { project: "x" })).toBeNull();
  });
});
