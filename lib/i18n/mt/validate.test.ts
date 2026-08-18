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

  it("lets Arabic attach its conjunction to a Latin token", () => {
    // `وAED` is "and AED" spelled the way Arabic spells it. The first version
    // of this rule failed a correct string for correct orthography.
    expect(codes("Between AED 1M and AED 2M", "بين AED 1M وAED 2M")).not.toContain(
      "latin-intrusion",
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

  it("flags a replacement character", () => {
    // "Sell" came back as "ب\uFFFD\uFFFDع". No judgement needed — U+FFFD only
    // appears when bytes could not be decoded.
    expect(codes("Sell", "ب\uFFFD\uFFFDع")).toContain("replacement-char");
    expect(codes("Sell", "بيع")).not.toContain("replacement-char");
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

describe("malformations that survive the semantic gate", () => {
  /**
   * All four of these shipped past `validate` AND past back-translation on the
   * /home calibration run. Every content word is correct and present; only the
   * arrangement is wrong, which is precisely what a bag-of-meaning comparison
   * cannot see.
   */
  const codes = (en: string, ar: string) => validate(en, ar).map((i) => i.code);

  it("catches the field's own Arabic label leaking into its value", () => {
    expect(codes("Who we are", "العربية: من نحن")).toContain("label-leak");
  });

  it("does not fire when the English is genuinely about Arabic", () => {
    expect(codes("Available in Arabic", "متوفر بالعربية")).not.toContain("label-leak");
  });

  /**
   * The country, not a label.
   *
   * `العربية` is the middle word of الإمارات العربية المتحدة, so the original
   * bare-substring test rejected any correct translation that named the UAE in
   * full — 21 of the 902 translation units in the article corpus do. The first
   * body block of the H1-2026 sales report was one, and it kept its English
   * through two runs before the cause was found.
   */
  it("does not fire on the full name of the United Arab Emirates", () => {
    expect(
      codes(
        "one of the UAE's most resilient real estate markets",
        "أحد أكثر أسواق العقارات مرونة في الإمارات العربية المتحدة",
      ),
    ).not.toContain("label-leak");
  });

  it("still catches a parenthesised label, the shape twins.ts builds", () => {
    expect(codes("Who we are", "من نحن (العربية)")).toContain("label-leak");
  });

  it("catches a colon a two-word label did not earn", () => {
    expect(
      codes("Head office", "العنوان الرئيسي: المكتب الرئيسي"),
    ).toContain("punctuation-added");
  });

  it("leaves a colon the English asked for", () => {
    expect(codes("Note: read this", "ملاحظة: اقرأ هذا")).not.toContain(
      "punctuation-added",
    );
  });

  it("leaves a colon in real prose alone", () => {
    // The rule is scoped to short labels on purpose — a sentence may
    // legitimately gain punctuation Arabic prefers.
    expect(
      codes(
        "We handle the process on your behalf, end to end",
        "نتولى العملية نيابةً عنك: من البداية إلى النهاية",
      ),
    ).not.toContain("punctuation-added");
  });

  it("catches a sentence continuing past its own full stop", () => {
    expect(
      codes("Discover leading communities across Abu Dhabi.", "المجتمعات الرائدة في أبوظبي.اكتشف"),
    ).toContain("orphan-tail");
  });

  it("leaves a properly spaced sentence break alone", () => {
    expect(
      codes("Find your area first. The home follows.", "ابحث عن منطقتك أولًا. والمنزل يأتي بعدها."),
    ).not.toContain("orphan-tail");
  });
});

describe("the model answering twice", () => {
  it("catches a deliberation leak", () => {
    const codes = validate(
      "Browse Properties",
      'براوز? No — "تصفح العقارات"تصفح العقارات',
    ).map((i) => i.code);
    // Either tell is enough; both firing is the normal case for this shape.
    expect(codes.some((c) => c === "self-repeat" || c === "punctuation-added")).toBe(true);
  });

  it("leaves ordinary repetition alone", () => {
    // Arabic repeats short function words constantly; the rule needs a run
    // long enough that repeating it is not a style.
    const codes = validate("Homes and offices", "منازل و مكاتب").map((i) => i.code);
    expect(codes).not.toContain("self-repeat");
  });
});

describe("a sentence that ends on a preposition", () => {
  it("catches the fronted-span breakage", () => {
    expect(
      validate("Find Your Next Rental Property in ⟦0⟧", "⟦0⟧ ابحث عن عقارك الإيجاري التالي في").map(
        (i) => i.code,
      ),
    ).toContain("dangling-preposition");
  });

  it("leaves a correctly placed span alone", () => {
    expect(
      validate("New developments in ⟦0⟧", "مشاريع جديدة في ⟦0⟧").map((i) => i.code),
    ).not.toContain("dangling-preposition");
  });

  it("does not fight the rule that sentinel POSITION is never checked", () => {
    // The existing contract: identity is checked, position never is, because
    // Arabic word order moves sentinels legitimately.
    expect(validate("Villa at ⟦0⟧, ref ⟦1⟧", "⟦1⟧ فيلا بسعر ⟦0⟧")).toEqual([]);
  });
});

describe("self-repeat and newline-delimited lists", () => {
  it("leaves three chip entries that share a word alone", () => {
    // Real content from /areas. These are three distinct places, not a model
    // repeating itself, and flagging them dropped correct Arabic.
    expect(
      validate(
        "Mamsha Al Saadiyat\nHidd Al Saadiyat\nSaadiyat Lagoons",
        "ممشى السعديات\nحد السعديات\nالسعديات لاغونز",
      ).map((i) => i.code),
    ).not.toContain("self-repeat");
  });

  it("still catches a run repeated on one line", () => {
    expect(
      validate("Browse Properties", "تصفح العقارات تصفح العقارات").map((i) => i.code),
    ).toContain("self-repeat");
  });
});

/**
 * Arabic broken plurals.
 *
 * The glossary docblock promises a `stem` that "survives inflection", and for a
 * SOUND plural it does — مطور is still there in المطورين. A BROKEN plural
 * rewrites the consonant skeleton instead, so the singular stem is simply
 * absent from a perfectly correct sentence. Measured against the real corpus:
 * "Median apartment prices…" came back as "بلغت أسعار الشقق المتوسطة…", which
 * is right, and was rejected — so the block kept its English. Two of eleven
 * blocks in one article were lost that way.
 */
describe("glossary stems survive broken plurals", () => {
  const codes = (en: string, ar: string) => validate(en, ar).map((i) => i.code);

  it("accepts الشقق for apartment", () => {
    expect(codes("Median apartment prices rose", "ارتفعت أسعار الشقق")).not.toContain(
      "glossary",
    );
  });

  it("accepts الفلل for villa", () => {
    expect(codes("villa prices climbed", "ارتفعت أسعار الفلل")).not.toContain("glossary");
  });

  it("accepts الوسطاء for broker", () => {
    expect(codes("every broker must register", "يجب على الوسطاء التسجيل")).not.toContain(
      "glossary",
    );
  });

  it("still rejects a rendering with no form of the term at all", () => {
    // Nothing resembling شقة or شقق — the half of the check that must stay.
    expect(codes("apartment prices rose", "ارتفعت الأسعار كثيرًا")).toContain("glossary");
  });

  it("still rejects a forbidden rendering", () => {
    // Tenure is the load-bearing case: leasehold as إيجار calls a long-dated
    // usufruct a rental agreement.
    expect(codes("leasehold title", "عقد إيجار")).toContain("glossary");
  });
});

/**
 * Transpositions inside a single number.
 *
 * `digitRuns` sorts, and has to — Arabic word order differs, so a number's
 * position in the sentence moves legitimately and an ordered comparison would
 * fire on almost every correct translation. The cost was that a rewrite INSIDE
 * one number was invisible: the digits either side of a separator are one
 * value, and sorting made 4.7 and 7.4 the same multiset.
 *
 * All three of these were ACCEPTED with no issue at all before the fix, and
 * the first two are material misstatements on a DLD/ADREC-regulated surface
 * rather than clumsy prose. Both are live text in the article corpus.
 */
describe("numbers rewritten inside themselves", () => {
  const codes = (en: string, ar: string) => validate(en, ar).map((i) => i.code);

  it("catches a transposed regulatory clause number", () => {
    expect(
      codes(
        "Clause 4.7 requires the permit to name the principal-side brokerage.",
        "يتطلب البند 7.4 أن يحدد التصريح الوسيط الرئيسي.",
      ),
    ).toContain("numeral-drift");
  });

  it("catches an inverted payment plan", () => {
    expect(
      codes(
        "The payment plan is 30/70 with an 18-month post-handover tail.",
        "خطة السداد هي 70/30 مع فترة 18 شهرا بعد التسليم.",
      ),
    ).toContain("numeral-drift");
  });

  it("still lets Arabic move a number to a different position", () => {
    // The whole reason digitRuns sorts. This must stay quiet.
    expect(codes("Villa at ⟦0⟧, ref ⟦1⟧", "⟦1⟧ فيلا بسعر ⟦0⟧")).toEqual([]);
  });

  it("ignores the thousands separator when comparing compounds", () => {
    // `compoundNumerals` strips it, so 1,200 and 1200 are one token either way
    // and neither is a compound. Note this does NOT make the whole check quiet:
    // `digitRuns` splits on the comma — "1,200" is the two runs ["1","200"] —
    // so a dropped separator has always tripped `numeral-drift` by that route,
    // and still does. Pre-existing, conservative, and left alone here.
    expect(codes("1,200 units delivered", "تم تسليم 1200 وحدة")).toContain(
      "numeral-drift",
    );
    // The point of the new check: no compound is invented by the comma strip.
    expect(codes("1,200 units", "1,200 وحدة")).toEqual([]);
  });

  it("keeps a genuinely unchanged compound quiet", () => {
    expect(codes("Clause 4.7 applies", "ينطبق البند 4.7")).not.toContain(
      "numeral-drift",
    );
  });
});
