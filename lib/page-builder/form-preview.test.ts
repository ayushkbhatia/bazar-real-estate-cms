import { describe, expect, it } from "vitest";
import { FORM_DEFS, defaultForm } from "@/lib/forms";
import type { FormFieldDef, ResolvedForm } from "@/lib/forms/types";
import {
  PREVIEW_OPTION_LIMIT,
  buildFormPreview,
  buildFormPreviews,
} from "./form-preview";

function f(
  key: string,
  over: Partial<FormFieldDef> = {},
): FormFieldDef {
  return {
    key,
    label: key,
    type: "text",
    mapping: "custom",
    required: false,
    enabled: true,
    width: "full",
    ...over,
  };
}

function formWith(fields: FormFieldDef[], enabled = true): ResolvedForm {
  const base = defaultForm("contact_enquiry")!;
  return { ...base, enabled, fields };
}

describe("buildFormPreview", () => {
  it("keeps the order and drops switched-off fields, counting them", () => {
    const p = buildFormPreview(
      formWith([f("a"), f("b", { enabled: false }), f("c", { required: true })]),
    );
    expect(p.fields.map((x) => x.key)).toEqual(["a", "c"]);
    expect(p.fields[1].required).toBe(true);
    expect(p.hiddenFields).toBe(1);
  });

  it("names a conditional field's trigger by its labels, not its stored values", () => {
    const p = buildFormPreview(
      formWith([
        f("purpose", {
          label: "Property Purpose",
          type: "chips",
          options: [
            { label: "Residential", value: "residential" },
            { label: "Commercial", value: "commercial" },
          ],
        }),
        f("beds", { showWhen: { field: "purpose", values: ["residential"] } }),
      ]),
    );
    expect(p.fields[0].condition).toBeNull();
    expect(p.fields[1].condition).toBe(
      "Shown when Property Purpose is Residential",
    );
  });

  it("caps the option list and says how many are left", () => {
    const options = Array.from({ length: PREVIEW_OPTION_LIMIT + 3 }, (_, i) => ({
      label: `Option ${i}`,
      value: `o${i}`,
    }));
    const p = buildFormPreview(formWith([f("s", { type: "select", options })]));
    expect(p.fields[0].options).toHaveLength(PREVIEW_OPTION_LIMIT);
    expect(p.fields[0].moreOptions).toBe(3);
  });

  it("labels record-backed options by their source", () => {
    const p = buildFormPreview(
      formWith([f("p", { type: "select", optionSource: "offplan_projects" })]),
    );
    expect(p.fields[0].optionSource).toBe("Live off-plan projects");
  });

  it("carries the enabled flag, so a switched-off form can be called out", () => {
    expect(buildFormPreview(formWith([f("a")], false)).enabled).toBe(false);
  });
});

describe("buildFormPreviews", () => {
  it("previews every registry form, keyed by the value the picker stores", () => {
    const forms = FORM_DEFS.map((d) => defaultForm(d.key)!);
    const previews = buildFormPreviews(forms);
    for (const form of forms) {
      const p = previews[form.key];
      expect(p, form.key).toBeDefined();
      expect(p.editHref).toBe(`/admin/forms/${form.key}`);
      expect(p.submitLabel.trim(), form.key).not.toBe("");
      expect(p.fields.length + p.hiddenFields).toBe(form.fields.length);
    }
  });
});
