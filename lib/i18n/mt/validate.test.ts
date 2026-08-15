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

  it("flags markdown the English does not have", () => {
    // Real output: "Hybrid" -> "**هجين**", which next-intl renders with the
    // asterisks in it. The model volunteers emphasis on short bare inputs.
    expect(codes("Hybrid", "**هجين**")).toContain("markdown");
    expect(codes("Land", "## أرض")).toContain("markdown");
  });

  it("leaves markdown alone when the English has its own", () => {
    expect(codes("**Sold**", "**تم البيع**")).not.toContain("markdown");
  });

  it("flags the model's own working left in the answer", () => {
    // Real output for "Hybrid": a note to itself, two newlines, then the
    // translation — and next-intl renders the whole thing.
    expect(
      codes("Hybrid", "الملاحظة: يجب أن يكون الناتج بالعربية فقط.\n\nهجين"),
    ).toContain("multiline");
    expect(codes("Hybrid", "هجين")).not.toContain("multiline");
  });

  it("keeps a newline the English asked for", () => {
    expect(codes("Line one\nLine two", "سطر أول\nسطر ثانٍ")).not.toContain(
      "multiline",
    );
  });

  it("flags Arabic that came back as another script", () => {
    // "الانتقال إلى" arrived as Thai codepoints — UTF-8 Arabic decoded as
    // cp1256 and re-encoded. To an English reviewer it looks like Arabic.
    expect(codes("Skip to report", "ุงู„ุงู†ุชู‚ุงู„")).toContain("mojibake");
    expect(codes("Skip", "الانتقال")).not.toContain("mojibake");
    // Latin runs are expected — AED, ft², a reference.
    expect(codes("Price in AED", "السعر بالـ AED")).not.toContain("mojibake");
  });

  it("flags a short label that came back as something else entirely", () => {
    // The real one: "Who it's for" returned "Explore the world of AI and
    // machine learning with our experts". Fluent, correctly scripted, and
    // unrelated to the input — invisible to every other check here.
    expect(
      codes(
        "Who it's for",
        "استكشف عالم الذكاء الاصطناعي والتعلم الآلي مع خبرائنا",
      ),
    ).toContain("too-long");
  });

  it("lets a short term expand as much as Arabic needs", () => {
    // An abbreviation legitimately quadruples and more.
    expect(codes("TRC", "شهادة الإقامة الضريبية")).not.toContain("too-long");
    expect(codes("Dependants", "المعالون")).not.toContain("too-long");
    expect(codes("Compliance · KYC", "اعرف عميلك · الامتثال")).not.toContain(
      "too-long",
    );
  });

  it("never measures the growth of a plural", () => {
    // Two English branches become six or seven Arabic ones, so a correct
    // translation triples in length. `listing.bedrooms` really is 63 chars of
    // English and 139 of Arabic.
    expect(
      codes(
        "{count, plural, =0 {Studio} one {# bedroom} other {# bedrooms}}",
        "{count, plural, =0 {استوديو} zero {بدون غرف نوم} one {غرفة نوم واحدة} two {غرفتا نوم} few {# غرف نوم} many {# غرفة نوم} other {# غرفة نوم}}",
      ),
    ).not.toContain("too-long");
  });

  it("flags a Latin letter fused into an Arabic word", () => {
    // Observed: "United Arab Emirates" -> "امتb الإمارات العربية المتحدة".
    // `latin-leak` needs a run of four and never sees it; `mojibake` allows
    // Latin because AED and ft² are legitimate.
    expect(codes("United Arab Emirates", "امتb الإمارات")).toContain(
      "latin-intrusion",
    );
    // A token with space around it is exactly what Arabic output should keep.
    expect(codes("Price in AED", "السعر بالـ AED")).not.toContain(
      "latin-intrusion",
    );
    expect(codes("Emirates", "الإمارات")).not.toContain("latin-intrusion");
  });

  it("flags the model returning its data structure", () => {
    expect(codes("Unfurnished", '["غير مفروش"]')).toContain("json-literal");
    expect(codes("Unfurnished", "غير مفروش")).not.toContain("json-literal");
  });

  it("flags a transposed definite article", () => {
    // messages/ar/development.json shipped `املاحة المبنية` for "Built-up" in
    // wave 2b. Right length, right digits, no Latin, no sentinel drift — and
    // wrong in a way only a reader of Arabic could see.
    expect(codes("Built-up", "املاحة المبنية")).toContain("transposition");
    expect(codes("Term", "املدة")).toContain("transposition");
  });

  it("flags a presentation-form ligature and a stray directional mark", () => {
    // "الإطفاء" came back spelled with U+FEF9, the lam-alef ligature glyph —
    // it renders identically and matches nothing. "متغير" arrived with a
    // U+200E glued to the front.
    expect(codes("Amortization", "ا\uFEF9طفاء")).toContain("presentation-forms");
    expect(codes("Variable", "\u200Eمتغير")).toContain("presentation-forms");
    expect(codes("Amortization", "الإطفاء")).not.toContain("presentation-forms");
  });

  it("does not flag correct Arabic, or a word that only looks like it", () => {
    expect(codes("Term", "المدة")).not.toContain("transposition");
    expect(codes("Area", "المساحة المبنية")).not.toContain("transposition");
    // إملاء carries hamza-under-alef (U+0625), which the pattern excludes.
    expect(codes("Dictation", "إملاء")).not.toContain("transposition");
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
