/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { fillFormCopy, fillFormField } from "./arabic";
import { resolveForm } from "./resolve";
import { FORM_DEFS } from "./registry";
import { localiseRow } from "@/lib/i18n/localise";
import { localiseDeep } from "@/lib/i18n/localise";
import type { ArabicStore } from "@/lib/i18n/arabic-store";
import type { FormCopy, FormFieldDef } from "./types";

const store: ArabicStore = {
  Submit: { ar: "إرسال", by: "machine" },
  "Full name": { ar: "الاسم الكامل", by: "machine" },
  "e.g. Ahmed": { ar: "مثال: أحمد", by: "machine" },
  Apartment: { ar: "شقة", by: "machine" },
  Villa: { ar: "فيلا", by: "machine" },
};

const copy = (over: Partial<FormCopy> = {}): FormCopy =>
  ({
    title: null,
    subtitle: null,
    submit_label: "Submit",
    pending_label: "Sending…",
    success_title: "Thank you.",
    success_body: "We'll be in touch.",
    consent_note: null,
    ...over,
  }) as FormCopy;

const field = (over: Partial<FormFieldDef> = {}): FormFieldDef =>
  ({
    key: "name",
    label: "Full name",
    type: "text",
    mapping: "none",
    placeholder: "e.g. Ahmed",
    help: null,
    required: true,
    enabled: true,
    width: "full",
    options: [],
    optionSource: null,
    rows: null,
    min: null,
    max: null,
    step: null,
    unit: null,
    showWhen: null,
    locked: false,
    ...over,
  }) as FormFieldDef;

describe("fillFormCopy", () => {
  it("fills a blank twin from the store", () => {
    expect(fillFormCopy(copy(), store).submit_label_ar).toBe("إرسال");
  });

  it("never overwrites Arabic an editor wrote", () => {
    const out = fillFormCopy(copy({ submit_label_ar: "أرسل الآن" }), store);
    expect(out.submit_label_ar).toBe("أرسل الآن");
  });

  it("leaves a key the store has never seen alone", () => {
    expect(fillFormCopy(copy(), store).pending_label_ar).toBeUndefined();
  });

  it("folds to Arabic on /ar", () => {
    const filled = fillFormCopy(copy(), store) as Record<string, unknown>;
    expect(localiseRow(filled, "ar").submit_label).toBe("إرسال");
    expect(localiseRow(filled, "en").submit_label).toBe("Submit");
  });
});

describe("fillFormField", () => {
  it("fills label and placeholder", () => {
    const out = fillFormField(field(), store) as unknown as Record<string, unknown>;
    expect(out.label_ar).toBe("الاسم الكامل");
    expect(out.placeholder_ar).toBe("مثال: أحمد");
  });

  it("fills option labels, which is what localiseDeep was already waiting for", () => {
    const out = fillFormField(
      field({ options: [{ label: "Apartment", value: "apartment" }, { label: "Villa", value: "villa" }] }),
      store,
    );
    expect(out.options?.map((o) => o.label_ar)).toEqual(["شقة", "فيلا"]);
    // The read fold already handled this shape — the labels rendered English
    // only because `parseOptions` dropped the key.
    const folded = localiseDeep(out.options, "ar");
    expect(folded?.map((o) => o.label)).toEqual(["شقة", "فيلا"]);
  });

  it("leaves an option an editor already translated", () => {
    const out = fillFormField(
      field({ options: [{ label: "Apartment", value: "apartment", label_ar: "وحدة سكنية" }] }),
      store,
    );
    expect(out.options?.[0]?.label_ar).toBe("وحدة سكنية");
  });

  it("adds nothing where there is nothing to add", () => {
    const out = fillFormField(field({ label: "Nobody has translated this" }), store) as unknown as Record<string, unknown>;
    expect(out.label_ar).toBeUndefined();
  });
});

describe("resolveForm applies it after the merge", () => {
  it("uses the editor's English, not the registry default", () => {
    /*
     * The bug this ordering avoids, measured at 303 slots on the master pages:
     * filling the DEFAULTS serves the default's Arabic under an editor's
     * replacement text. Running after `mergeCopy` means the English being
     * matched is the English the visitor reads.
     */
    const key = FORM_DEFS[0]!.key;
    const form = resolveForm(key, { enabled: true, copy: { submit_label: "Send brief" } } as never, null);
    expect(form!.copy.submit_label).toBe("Send brief");
    // No entry for "Send brief", so no Arabic — and English renders, which is
    // the designed fallback.
    expect((form!.copy as Record<string, unknown>).submit_label_ar ?? null).toBeNull();
  });
});
