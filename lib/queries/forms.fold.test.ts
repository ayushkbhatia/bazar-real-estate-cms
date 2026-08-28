/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import type { Locale } from "@/lib/i18n/locales";
import { expectFolds } from "@/lib/i18n/fold-harness";
import { resolveForm, type StoredField } from "@/lib/forms/resolve";
import { localiseFields, localiseResolved } from "@/lib/queries/forms";

/**
 * Proof that `form_fields.options` folds — the option LABEL, and nothing else
 * in the bag.
 *
 * The column has carried a `label_ar` per option since the twins landed:
 * `parseOptions` reads it, `fillFormArabic` fills it, `localiseDeep` folds it.
 * What it never had was an input — the option label was the one visitor-facing
 * string in the Forms Manager with no Arabic control, and `toSaveField` dropped
 * the key on the way out, so a save destroyed whatever was there. Now that an
 * editor can type into it, this is the spec that says the typing arrives.
 *
 * `getForm` is a database read wrapped around these two calls, so the proof
 * runs the real pair rather than a stand-in — the ordering between them is the
 * subtle part and the one a no-op fold would hide.
 */

const STORED: StoredField = {
  key: "intent",
  label: "I'm looking to",
  label_ar: "أرغب في",
  type: "chips",
  mapping: "intent",
  placeholder: null,
  placeholder_ar: null,
  help: null,
  help_ar: null,
  required: false,
  enabled: true,
  width: "full",
  options: [
    { label: "Buy", label_ar: "شراء عقار", value: "buy", intent: "buy" },
    { label: "Sell", label_ar: "بيع عقار", value: "sell", intent: "sell" },
  ],
  optionSource: null,
  rows: null,
  min: null,
  max: null,
  step: null,
  unit: null,
  unit_ar: null,
  showWhen: null,
  locked: false,
  position: 40,
} as unknown as StoredField;

const read = (locale: Locale) => {
  const resolved = resolveForm(
    "contact_enquiry",
    { key: "contact_enquiry", enabled: true, copy: {}, notify_emails: [] } as never,
    localiseFields([STORED], locale),
  )!;
  return localiseResolved(resolved, locale).fields.find(
    (f) => f.key === "intent",
  )!;
};

describe("form_fields.options on a public form", () => {
  it("folds the option label an editor typed", async () => {
    await expectFolds({
      read,
      pick: (field) => field.options?.[0]?.label,
      english: "Buy",
      arabic: "شراء عقار",
      what: "form_fields.options[].label",
    });
  });

  it("folds every option, not just the first", async () => {
    await expectFolds({
      read,
      pick: (field) => field.options?.[1]?.label,
      english: "Sell",
      arabic: "بيع عقار",
      what: "form_fields.options[1].label",
    });
  });

  it("never folds the stored value or the intent tag", () => {
    // Both are filing keys. `value` is what lands in the submission and what a
    // `showWhen` condition matches on; `intent` is an enum the enquiry pipeline
    // reads. Translating either would file Arabic answers under a key nothing
    // else in the system knows.
    const ar = read("ar" as Locale);
    expect(ar.options?.[0]?.value).toBe("buy");
    expect(ar.options?.[0]?.intent).toBe("buy");
  });
});

/**
 * The registry defaults have no `_ar` sibling anywhere — they are code strings.
 * Their Arabic comes from the generated store inside `resolveForm`, which is
 * the machine first draft ADR-0008 describes. A fold that only consulted the
 * stored twin would render an untouched form's chips in English on /ar.
 */
describe("an untouched form still folds its option labels", () => {
  const untouched = (locale: Locale) =>
    localiseResolved(
      resolveForm("contact_enquiry", null, null)!,
      locale,
    ).fields.find((f) => f.key === "intent")!;

  it("draws the generated Arabic for a chip nobody has edited", () => {
    const ar = untouched("ar" as Locale);
    const labels = (ar.options ?? []).map((o) => o.label);
    expect(labels.every((l) => /[؀-ۿ]/.test(l))).toBe(true);
  });

  it("leaves the English site in English", () => {
    const en = untouched("en" as Locale);
    expect((en.options ?? []).map((o) => o.label)).toEqual([
      "Buy",
      "Sell",
      "Rent",
    ]);
  });
});
