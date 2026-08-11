import { describe, expect, it } from "vitest";
import { blankField, formSaveSchema, type FormFieldSaveInput } from "./form";
import { defaultForm } from "@/lib/forms/resolve";

/**
 * The guardrails around a branching form.
 *
 * A condition that can never be met doesn't fail loudly — it hides a question
 * on a live page and nowhere else. So the save is where it has to be caught,
 * and these are the four ways an editor could build one.
 */

function payload(fields: FormFieldSaveInput[]) {
  const form = defaultForm("contact_enquiry")!;
  return {
    key: "contact_enquiry",
    enabled: true,
    notify_emails: [],
    copy: form.copy,
    fields,
  };
}

function chips(key: string, values: string[]): FormFieldSaveInput {
  return {
    ...blankField("chips", 0),
    key,
    label: key,
    options: values.map((v) => ({ label: v, value: v, intent: null })),
  };
}

function text(key: string, showWhen: FormFieldSaveInput["showWhen"] = null) {
  return { ...blankField("text", 1), key, label: key, showWhen };
}

const messages = (result: ReturnType<typeof formSaveSchema.safeParse>) =>
  result.success ? [] : result.error.issues.map((i) => i.message);

describe("conditional fields", () => {
  it("accepts a condition on an earlier question with fixed answers", () => {
    const result = formSaveSchema.safeParse(
      payload([
        chips("purpose", ["residential", "commercial"]),
        text("bedrooms", { field: "purpose", values: ["residential"] }),
      ]),
    );
    expect(messages(result)).toEqual([]);
  });

  it("refuses a condition pointing at a later question", () => {
    // Visibility resolves in one pass, so this field would be deciding whether
    // to show itself from an answer the visitor hasn't been asked for.
    const result = formSaveSchema.safeParse(
      payload([
        text("bedrooms", { field: "purpose", values: ["residential"] }),
        chips("purpose", ["residential", "commercial"]),
      ]),
    );
    expect(messages(result)).toContain(
      '"bedrooms" has to come after the question it depends on',
    );
  });

  it("refuses a condition on a field that isn't on the form", () => {
    const result = formSaveSchema.safeParse(
      payload([text("bedrooms", { field: "purpose", values: ["residential"] })]),
    );
    expect(messages(result)).toContain(
      '"bedrooms" depends on a field that isn\'t on this form any more',
    );
  });

  it("refuses a condition on a free-text answer", () => {
    const result = formSaveSchema.safeParse(
      payload([
        text("purpose"),
        text("bedrooms", { field: "purpose", values: ["residential"] }),
      ]),
    );
    expect(messages(result)).toContain(
      '"purpose" has no fixed answers, so nothing can depend on it',
    );
  });

  it("refuses a condition with nothing to match", () => {
    const result = formSaveSchema.safeParse(
      payload([
        chips("purpose", ["residential"]),
        text("bedrooms", { field: "purpose", values: [] }),
      ]),
    );
    expect(messages(result)).toContain(
      "Pick at least one answer that reveals this field",
    );
  });
});

describe("range fields", () => {
  it("gives a brand-new slider a scale, so the first save works", () => {
    const fresh = blankField("range", 0);
    expect(formSaveSchema.safeParse(payload([fresh])).success).toBe(true);
  });

  it("refuses a slider with no ends", () => {
    const result = formSaveSchema.safeParse(
      payload([{ ...blankField("range", 0), min: null, max: null }]),
    );
    expect(messages(result)).toContain(
      '"New question" needs a minimum and a maximum to slide between',
    );
  });

  it("refuses a step of zero", () => {
    const result = formSaveSchema.safeParse(
      payload([{ ...blankField("range", 0), step: 0 }]),
    );
    expect(messages(result)).toContain("A slider's step has to be above zero");
  });
});
