import { describe, it, expect } from "vitest";
import {
  TOKENS,
  isTokenName,
  missingTokens,
  outOfScopeTokens,
  renderSample,
  renderTokens,
  unknownTokens,
  usedTokens,
} from "./tokens";

describe("unknownTokens", () => {
  it("catches a typo that would otherwise reach a client", () => {
    expect(unknownTokens("Hi {{propery_ref}}")).toEqual(["propery_ref"]);
  });

  it("passes copy that only uses the vocabulary", () => {
    const body = "About {{property_title}} ({{property_reference}}) — {{advisor_name}}";
    expect(unknownTokens(body)).toEqual([]);
  });

  it("dedupes and lowercases", () => {
    expect(unknownTokens("{{Nope}} {{nope}} {{NOPE}}")).toEqual(["nope"]);
  });

  it("ignores single braces and stray text", () => {
    expect(unknownTokens("{not_a_token} and { spaced }")).toEqual([]);
  });
});

describe("renderTokens", () => {
  it("substitutes the values it is given", () => {
    expect(
      renderTokens("Hello {{lead_first_name}}, about {{property_reference}}.", {
        lead_first_name: "Amira",
        property_reference: "BAZ-AD-04891",
      }),
    ).toBe("Hello Amira, about BAZ-AD-04891.");
  });

  it("falls back rather than leaving a hole", () => {
    // An enquiry with no property attached still has to produce a sendable
    // sentence — this is the common case, not an edge case.
    expect(renderTokens("About {{property_reference}}.", {})).toBe(
      "About your enquiry.",
    );
  });

  it("treats blank and null as absent", () => {
    expect(
      renderTokens("Hi {{lead_first_name}}", { lead_first_name: "   " }),
    ).toBe("Hi there");
    expect(renderTokens("Hi {{lead_first_name}}", { lead_first_name: null })).toBe(
      "Hi there",
    );
  });

  it("strips unknown tokens instead of printing braces", () => {
    expect(renderTokens("Hi {{mystery}}!", {})).toBe("Hi !");
  });

  it("tolerates padding inside the braces", () => {
    expect(
      renderTokens("Hi {{ lead_first_name }}", { lead_first_name: "Amira" }),
    ).toBe("Hi Amira");
  });

  it("replaces every occurrence, not just the first", () => {
    // A /g regex reused across calls would carry lastIndex and skip matches.
    const out = renderTokens("{{lead_first_name}} {{lead_first_name}}", {
      lead_first_name: "Amira",
    });
    expect(out).toBe("Amira Amira");
  });

  it("is stable across repeated calls", () => {
    const body = "Hi {{lead_first_name}}";
    const ctx = { lead_first_name: "Amira" };
    expect(renderTokens(body, ctx)).toBe(renderTokens(body, ctx));
  });
});

describe("missingTokens", () => {
  it("reports only the known tokens that will fall back", () => {
    expect(
      missingTokens("{{lead_first_name}} {{property_reference}} {{bogus}}", {
        lead_first_name: "Amira",
      }),
    ).toEqual(["property_reference"]);
  });

  it("is empty when everything resolves", () => {
    expect(
      missingTokens("{{lead_name}}", { lead_name: "Amira Haddad" }),
    ).toEqual([]);
  });
});

describe("usedTokens", () => {
  it("lists known tokens once each, in first-appearance order", () => {
    expect(
      usedTokens("{{property_title}} {{lead_name}} {{property_title}}"),
    ).toEqual(["property_title", "lead_name"]);
  });
});

describe("renderSample", () => {
  it("leaves no unresolved braces, so the preview is readable", () => {
    const body = TOKENS.map((t) => `{{${t.name}}}`).join(" ");
    const out = renderSample(body);
    expect(out).not.toContain("{{");
    for (const t of TOKENS) expect(out).toContain(t.sample);
  });
});

describe("isTokenName", () => {
  it("narrows to the closed vocabulary", () => {
    expect(isTokenName("lead_first_name")).toBe(true);
    expect(isTokenName("lead_middle_name")).toBe(false);
  });
});

describe("TOKENS", () => {
  it("gives every token a non-empty fallback", () => {
    // A blank fallback would silently delete words from a sent message.
    for (const t of TOKENS) {
      expect(t.fallback.trim(), t.name).not.toBe("");
      expect(t.sample.trim(), t.name).not.toBe("");
    }
  });
});

describe("outOfScopeTokens", () => {
  it("flags a correctly-spelled token this message can't fill", () => {
    expect(
      outOfScopeTokens("Your viewing is at {{viewing_time}}", [
        "lead_first_name",
        "property_reference",
      ]),
    ).toEqual(["viewing_time"]);
  });

  it("passes tokens on the allowed list", () => {
    expect(
      outOfScopeTokens("Hi {{lead_first_name}}", ["lead_first_name"]),
    ).toEqual([]);
  });

  it("ignores typos — unknownTokens owns those", () => {
    expect(outOfScopeTokens("{{propery_ref}}", ["lead_first_name"])).toEqual([]);
  });
});
