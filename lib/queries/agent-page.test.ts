/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  agentPageCopySlug,
  agentTokens,
  firstName,
  getAgentPageCopy,
} from "./agent-page";
import { agentPageSlug } from "./subpages";
import { agentPageDef } from "@/lib/master-pages/subpages";
import { resolveSections } from "@/lib/master-pages";
import { stripIsolates } from "@/lib/i18n/bidi";

/**
 * One advisor's wording, resolved through the three layers: their own
 * document, the shared one, the shipped defaults.
 *
 * Runs with no Supabase configured, which is the fallback branch — the shared
 * document read is skipped and the defaults stand in for it. That is exactly
 * what an unsaved document produces, so the assertions hold for both. The
 * advisor's own document is handed in already resolved, which is how the
 * page passes it.
 */
const TOKENS = agentTokens("Mariam Al Hashemi");
const def = agentPageDef({ name: "Mariam Al Hashemi", slug: "mariam" });

describe("advisor page storage", () => {
  it("files the shared document and each advisor's apart", () => {
    expect(agentPageCopySlug()).toBe("subpage/agent-copy/shared");
    expect(agentPageSlug("7b0c…")).toBe("subpage/agent/7b0c…");
    expect(agentPageSlug("shared")).not.toBe(agentPageCopySlug());
  });
});

describe("tokens", () => {
  it("takes the first word as the first name", () => {
    expect(firstName("  Mariam   Al Hashemi ")).toBe("Mariam");
    expect(TOKENS).toEqual({
      name: "Mariam Al Hashemi",
      first_name: "Mariam",
    });
  });
});

describe("one advisor's wording", () => {
  it("renders the shared wording with the name filled in", async () => {
    const copy = await getAgentPageCopy(TOKENS, "en");
    expect(copy("reviews", "heading")).toBe("Working with Mariam.");
    expect(copy("hero", "quote")).toBe(
      "Mariam works the full advisory cycle end to end.",
    );
    expect(copy("hero", "back_label")).toBe("Our team");
  });

  it("lets the advisor's own document win, field by field", async () => {
    const own = resolveSections(
      def,
      [
        {
          key: "cta",
          enabled: true,
          values: { heading: "Book a call with {first_name}." },
        },
      ],
      "en",
    );
    const copy = await getAgentPageCopy(TOKENS, "en", own);
    expect(copy("cta", "heading")).toBe("Book a call with Mariam.");
    // An override on one field leaves its neighbours on the shared wording.
    expect(copy("cta", "eyebrow")).toBe("Get in touch");
    expect(copy("cta", "cta_label")).toBe("Send a brief");
  });

  it("falls back to the shared wording when an override is blank", async () => {
    const own = resolveSections(
      def,
      [{ key: "reviews", enabled: true, values: { heading: "   " } }],
      "en",
    );
    const copy = await getAgentPageCopy(TOKENS, "en", own);
    expect(copy("reviews", "heading")).toBe("Working with Mariam.");
  });

  it("reads Arabic on /ar, with the name isolated", async () => {
    const copy = await getAgentPageCopy(TOKENS, "ar");
    const heading = copy("cta", "heading");
    // Isolated, because a Latin name inside an Arabic sentence reorders
    // around its punctuation otherwise.
    expect(heading).not.toBe(stripIsolates(heading));
    expect(stripIsolates(heading)).toBe("اعمل مع Mariam.");
    expect(copy("hero", "call_label")).toBe("اتصل");
  });

  it("uses an advisor's Arabic override on /ar", async () => {
    const own = resolveSections(
      def,
      [
        {
          key: "hero",
          enabled: true,
          values: { quote: "An English quote.", quote_ar: "اقتباس عربي." },
        },
      ],
      "ar",
    );
    const copy = await getAgentPageCopy(TOKENS, "ar", own);
    expect(copy("hero", "quote")).toBe("اقتباس عربي.");
  });

  it("answers for every field the page asks about", async () => {
    const copy = await getAgentPageCopy(TOKENS, "en");
    for (const [section, field] of [
      ["hero", "back_label"],
      ["hero", "title_fallback"],
      ["hero", "quote"],
      ["hero", "call_label"],
      ["hero", "whatsapp_label"],
      ["hero", "whatsapp_message"],
      ["hero", "email_label"],
      ["expertise", "specialties_eyebrow"],
      ["expertise", "languages_eyebrow"],
      ["reviews", "eyebrow"],
      ["reviews", "heading"],
      ["listings", "eyebrow"],
      ["listings", "heading"],
      ["listings", "empty"],
      ["cta", "eyebrow"],
      ["cta", "heading"],
      ["cta", "cta_label"],
    ] as const) {
      expect(copy(section, field), `${section}.${field}`).toBeTruthy();
    }
  });
});
