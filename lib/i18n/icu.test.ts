/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ARABIC_PLURAL_CATEGORIES,
  formatPlural,
  hasEmbeddedPlural,
  icuArguments,
  parseMessage,
  requiredArabicSelectors,
} from "./icu";
import { catalogueIssues, refuse } from "./catalogue-mt";
import { mask, unmask } from "./mt/mask";

const BEDROOMS =
  "{count, plural, =0 {Studio} one {# bedroom} other {# bedrooms}}";

describe("icuArguments", () => {
  it("ignores plural branch bodies", () => {
    // The trap the brace-depth walk exists for: a naive /\{(\w+)[,}]/ reports
    // an argument called "Studio", and then every translated message looks
    // like a placeholder mismatch because the Arabic branch text is not \w.
    expect(icuArguments(BEDROOMS)).toEqual(["count"]);
  });

  it("finds plain placeholders and de-duplicates", () => {
    expect(icuArguments("{name} in {area}, {name} again")).toEqual([
      "area",
      "name",
    ]);
  });
});

describe("parseMessage", () => {
  it("splits a whole-message plural into its branches", () => {
    const p = parseMessage(BEDROOMS);
    expect(p.kind).toBe("plural");
    if (p.kind !== "plural") return;
    expect(p.arg).toBe("count");
    expect(p.branches).toEqual([
      { selector: "=0", text: "Studio" },
      { selector: "one", text: "# bedroom" },
      { selector: "other", text: "# bedrooms" },
    ]);
  });

  it("round-trips through formatPlural", () => {
    const p = parseMessage(BEDROOMS);
    if (p.kind !== "plural") throw new Error("expected plural");
    expect(parseMessage(formatPlural(p.arg, p.branches))).toEqual(p);
  });

  it("treats an ordinary message as simple", () => {
    expect(parseMessage("Book a viewing")).toEqual({
      kind: "simple",
      text: "Book a viewing",
    });
  });

  it("survives a branch containing braces", () => {
    const m = "{n, plural, one {see {area}} other {see {area} and more}}";
    const p = parseMessage(m);
    if (p.kind !== "plural") throw new Error("expected plural");
    expect(p.branches.map((b) => b.text)).toEqual([
      "see {area}",
      "see {area} and more",
    ]);
  });
});

describe("requiredArabicSelectors", () => {
  it("keeps exact matches alongside the six categories", () => {
    // `=0 {Studio}` is a decision about the number zero, not a grammatical
    // category — it has to survive translation as its own branch.
    const p = parseMessage(BEDROOMS);
    if (p.kind !== "plural") throw new Error("expected plural");
    expect(requiredArabicSelectors(p.branches)).toEqual([
      "=0",
      ...ARABIC_PLURAL_CATEGORIES,
    ]);
  });
});

describe("refuse", () => {
  it("rejects a plural buried inside a sentence", () => {
    // It would parse as simple prose and go to the prose model whole, which
    // mangles the ICU structure quietly.
    expect(
      refuse("You have {n, plural, one {# match} other {# matches}} here")
        ?.code,
    ).toBe("embedded-plural");
  });

  it("accepts a plural that wraps the whole message", () => {
    expect(refuse(BEDROOMS)).toBeNull();
    expect(hasEmbeddedPlural(BEDROOMS)).toBe(false);
  });

  it("accepts ordinary prose", () => {
    expect(refuse("Book a viewing")).toBeNull();
  });
});

describe("ICU placeholders are masked before the model sees them", () => {
  it("hides {count} behind a sentinel", () => {
    // Unmasked, the model may translate the placeholder, reorder it, or drop
    // the braces — and the message then formats to the literal text `{count}`
    // on the page.
    const { masked, tokens } = mask("Showing {count} of {total} properties");
    expect(masked).not.toContain("{count}");
    expect(masked).not.toContain("{total}");
    expect(unmask(masked, tokens)).toBe(
      "Showing {count} of {total} properties",
    );
  });

  it("leaves prose braces-free text alone", () => {
    const { masked } = mask("Book a viewing");
    expect(masked).toBe("Book a viewing");
  });
});

describe("catalogueIssues", () => {
  it("flags Arabic that is the English verbatim", () => {
    expect(
      catalogueIssues("Book a viewing", "Book a viewing").map((i) => i.code),
    ).toContain("identical");
  });

  it("flags a dropped placeholder", () => {
    expect(
      catalogueIssues("Showing {count} results", "عرض النتائج").map(
        (i) => i.code,
      ),
    ).toContain("placeholder-drift");
  });

  it("flags an invented #, which a real run produced", () => {
    // "Currency & units" came back as "# العملة والوحدات" on the first
    // production run. The check was one-sided and let it through; outside a
    // plural that formats as a literal hash on the page.
    expect(
      catalogueIssues("Currency & units", "# العملة والوحدات").map(
        (i) => i.code,
      ),
    ).toContain("hash-invented");
  });

  it("flags a dropped # in a plural branch", () => {
    expect(
      catalogueIssues("# bedrooms", "غرف نوم").map((i) => i.code),
    ).toContain("hash-dropped");
  });

  it("flags a deprecated bidi mark", () => {
    expect(
      catalogueIssues("Book a viewing", "‮احجز معاينة").map((i) => i.code),
    ).toContain("legacy-bidi");
  });

  it("passes a good translation", () => {
    expect(catalogueIssues("Book a viewing", "احجز معاينة")).toEqual([]);
  });
});

describe("the shipped catalogue satisfies its own rules", () => {
  it("has no embedded plurals and no legacy marks", () => {
    for (const locale of ["en", "ar"]) {
      const dir = join(import.meta.dirname, "..", "..", "messages", locale);
      for (const ns of ["common", "nav", "footer", "consent", "listing"]) {
        const bag = JSON.parse(
          readFileSync(join(dir, `${ns}.json`), "utf8"),
        ) as Record<string, string>;
        for (const [key, value] of Object.entries(bag)) {
          expect(refuse(value), `${locale}/${ns}.${key}`).toBeNull();
        }
      }
    }
  });
});

describe("plural branch masking", () => {
  it("does not let two branches both claim sentinel 0", async () => {
    // Each branch is masked separately and `mask()` restarts at ⟦0⟧ every
    // time, so without renumbering both branches emit ⟦0⟧ and the second one
    // unmasks to the FIRST branch's token. Silently wrong whenever the two
    // branches protect different values — a price in one, a reference in the
    // other.
    const { translatePluralMessage } = await import("./catalogue-mt");
    let seen = "";
    const client = {
      messages: {
        create: async (input: { messages: { content: string }[] }) => {
          seen = input.messages[0]!.content;
          return { content: [{ type: "text", text: "{}" }] };
        },
      },
    };
    await translatePluralMessage({
      client,
      message:
        "{n, plural, one {one at AED 500,000} other {# from AED 900,000}}",
      model: "test",
    });
    const sentinels = [...seen.matchAll(/⟦(\d+)⟧/g)].map((m) => m[1]);
    expect(new Set(sentinels).size).toBe(sentinels.length);
  });
});
