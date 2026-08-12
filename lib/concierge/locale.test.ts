import { describe, expect, it } from "vitest";
import {
  MAX_INPUT_TOKENS_PER_SESSION,
  MAX_OUTPUT_TOKENS_PER_TURN,
  SYSTEM_PROMPT,
  maxOutputTokens,
  maxSessionInputTokens,
  systemPromptFor,
} from "./anthropic";

/**
 * Arabic tokenises far less efficiently than English — roughly 2.5x for the
 * same content. At the English ceilings an Arabic reply saying exactly what a
 * comfortable English one says hits `max_tokens` and stops mid-sentence, which
 * reads to the visitor as the concierge breaking rather than being brief.
 */
describe("concierge locale ceilings", () => {
  it("leaves English exactly as it was", () => {
    expect(maxOutputTokens("en")).toBe(MAX_OUTPUT_TOKENS_PER_TURN);
    expect(maxSessionInputTokens("en")).toBe(MAX_INPUT_TOKENS_PER_SESSION);
    expect(systemPromptFor("en")).toBe(SYSTEM_PROMPT);
  });

  it("gives Arabic room to finish a sentence", () => {
    expect(maxOutputTokens("ar")).toBeGreaterThan(MAX_OUTPUT_TOKENS_PER_TURN);
    expect(maxSessionInputTokens("ar")).toBeGreaterThan(
      MAX_INPUT_TOKENS_PER_SESSION,
    );
  });

  it("defaults to English, so existing callers are unaffected", () => {
    expect(systemPromptFor()).toBe(SYSTEM_PROMPT);
  });
});

describe("concierge Arabic prompt", () => {
  const ar = systemPromptFor("ar");

  it("keeps the whole English prompt and appends to it", () => {
    expect(ar.startsWith(SYSTEM_PROMPT)).toBe(true);
    expect(ar.length).toBeGreaterThan(SYSTEM_PROMPT.length);
  });

  it("pins the tenure vocabulary that misstates the sale if wrong", () => {
    // leasehold as إيجار describes a rental, not a 99-year interest. This is a
    // regulatory distinction, not a stylistic one.
    expect(ar).toContain("حق انتفاع");
    expect(ar).toContain("تملك حر");
    expect(ar).toContain("إيجار");
  });

  it("keeps Bazar's people advisors, not agents", () => {
    expect(ar).toContain("مستشار");
  });

  it("pins Western numerals, matching the rest of the site", () => {
    expect(ar).toMatch(/Western digits/i);
    expect(ar).not.toMatch(/[٠-٩]/);
  });

  it("tells the model not to translate names coming back from tools", () => {
    expect(ar).toMatch(/NAMES/);
    expect(ar).toMatch(/verbatim/i);
  });
});
