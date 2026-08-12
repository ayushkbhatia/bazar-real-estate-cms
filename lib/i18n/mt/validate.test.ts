import { describe, expect, it } from "vitest";
import { toWesternDigits, validate } from "./validate";

const codes = (...args: Parameters<typeof validate>) =>
  validate(...args).map((i) => i.code);

describe("validation accepts good output", () => {
  it("passes a clean translation with sentinels reordered", () => {
    // Arabic word order differs, so sentinels legitimately move. Identity is
    // checked, never position.
    expect(codes("Villa at ⟦0⟧, ref ⟦1⟧", "⟦1⟧ فيلا بسعر ⟦0⟧")).toEqual([]);
  });

  it("passes when the model uses Arabic-Indic digits", () => {
    // Numeral comparison is script-blind, so switching digit systems is not
    // drift. Whether we *want* Arabic-Indic is a separate, style decision.
    expect(codes("4 bedroom", "٤ غرفة نوم")).toEqual([]);
  });
});

describe("the checks that must never be quiet", () => {
  it("catches a dropped sentinel", () => {
    // The price vanished from the sentence entirely.
    expect(codes("Villa at ⟦0⟧", "فيلا للبيع")).toContain("sentinel-missing");
  });

  it("catches an invented sentinel", () => {
    expect(codes("Villa at ⟦0⟧", "فيلا ⟦0⟧ ⟦7⟧")).toContain("sentinel-invented");
  });

  it("catches a changed number that was not masked", () => {
    // 4 bedrooms became 5. Not a price, still a lie.
    expect(codes("4 bedroom villa", "فيلا من 5 غرف نوم")).toContain(
      "numeral-drift",
    );
  });

  it("catches untranslated Latin left in the output", () => {
    expect(codes("Luxury villa", "فيلا Luxury")).toContain("latin-leak");
  });

  it("catches the model explaining itself instead of translating", () => {
    const source = "A five bedroom villa with a private pool on the island";
    const chatty =
      "بالتأكيد! إليك الترجمة العربية للنص الذي طلبته، مع الحفاظ على المعنى الأصلي والأسلوب التسويقي المستخدم في الإعلانات العقارية الفاخرة في دولة الإمارات العربية المتحدة، وآمل أن تكون مفيدة لك";
    expect(codes(source, chatty)).toContain("too-long");
  });

  it("catches an over-length field", () => {
    expect(codes("Villa", "فيلا فاخرة جدا", { maxLength: 5 })).toContain(
      "too-long",
    );
  });

  it("rejects empty output outright", () => {
    expect(codes("Villa", "   ")).toEqual(["empty"]);
  });
});

describe("glossary enforcement", () => {
  it("rejects leasehold rendered as a rental", () => {
    // The entry that is regulatory rather than stylistic: إيجار describes a
    // tenancy and misstates what the buyer is acquiring.
    const issues = validate("Leasehold apartment", "شقة إيجار");
    expect(issues.map((i) => i.code)).toContain("glossary");
    expect(issues.find((i) => i.code === "glossary")?.detail).toContain(
      "حق انتفاع",
    );
  });

  it("accepts the correct tenure term, including with the ال- prefix", () => {
    // Arabic inflects, so the check is on a stem that survives prefixing.
    expect(codes("Leasehold apartment", "شقة بحق الانتفاع")).toEqual([]);
  });

  it("only enforces entries whose English term is in the source", () => {
    // "escrow" is in the glossary but not in this source, so its absence from
    // the output is not a finding.
    expect(codes("A quiet street", "شارع هادئ")).toEqual([]);
  });

  it("does not fire on a substring of a longer word", () => {
    // "plotting" is not "plot"; a naive includes() would flag it.
    expect(codes("Plotting the route", "رسم المسار")).toEqual([]);
  });
});

describe("digit normalisation", () => {
  it("maps both Arabic-Indic ranges to Western", () => {
    expect(toWesternDigits("٤٥٦")).toBe("456");
    expect(toWesternDigits("۴۵۶")).toBe("456"); // extended (Persian) range
  });
});
