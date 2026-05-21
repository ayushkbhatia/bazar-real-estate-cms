import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

/* The helper reads NEXT_PUBLIC_WHATSAPP_* at module-eval time via the
 * `env` export. Stub the env BEFORE importing so the convenience
 * functions pick up the test values. */
beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER", "+971 50 111 1111");
  vi.stubEnv("NEXT_PUBLIC_WHATSAPP_MORTGAGE_NUMBER", "+971 50 222 2222");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

async function importHelper() {
  vi.resetModules();
  return import("./whatsapp");
}

describe("buildWhatsAppLink", () => {
  it("returns null for empty or missing input", async () => {
    const { buildWhatsAppLink } = await importHelper();
    expect(buildWhatsAppLink("")).toBeNull();
    expect(buildWhatsAppLink(null)).toBeNull();
    expect(buildWhatsAppLink(undefined)).toBeNull();
  });

  it("returns null when the number is shorter than 7 digits", async () => {
    const { buildWhatsAppLink } = await importHelper();
    expect(buildWhatsAppLink("123")).toBeNull();
    // The spec also rejects longer-than-E.164 (>15 digits).
    expect(buildWhatsAppLink("1".repeat(16))).toBeNull();
  });

  it("strips spaces, dashes, parentheses, and the leading +", async () => {
    const { buildWhatsAppLink } = await importHelper();
    expect(buildWhatsAppLink("+971 50 123 4567")).toBe(
      "https://wa.me/971501234567",
    );
    expect(buildWhatsAppLink("(971) 50-123-4567")).toBe(
      "https://wa.me/971501234567",
    );
    expect(buildWhatsAppLink(" 971.50.123.4567 ")).toBe(
      "https://wa.me/971501234567",
    );
  });

  it("returns the base URL when no message is given", async () => {
    const { buildWhatsAppLink } = await importHelper();
    expect(buildWhatsAppLink("+971501234567")).toBe(
      "https://wa.me/971501234567",
    );
    expect(buildWhatsAppLink("+971501234567", "")).toBe(
      "https://wa.me/971501234567",
    );
    expect(buildWhatsAppLink("+971501234567", "   ")).toBe(
      "https://wa.me/971501234567",
    );
    expect(buildWhatsAppLink("+971501234567", null)).toBe(
      "https://wa.me/971501234567",
    );
  });

  it("URL-encodes a plain message", async () => {
    const { buildWhatsAppLink } = await importHelper();
    const url = buildWhatsAppLink(
      "+971501234567",
      "Hi Bazar, I'd like to talk.",
    );
    expect(url).toBe(
      "https://wa.me/971501234567?text=Hi%20Bazar%2C%20I'd%20like%20to%20talk.",
    );
  });

  it("encodes line breaks as %0A so multi-line prefills survive", async () => {
    const { buildWhatsAppLink } = await importHelper();
    const url = buildWhatsAppLink(
      "+971501234567",
      "Line one\nLine two\nLine three",
    );
    expect(url).toBe(
      "https://wa.me/971501234567?text=Line%20one%0ALine%20two%0ALine%20three",
    );
  });

  it("encodes emoji + non-ASCII text as their UTF-8 percent sequences", async () => {
    const { buildWhatsAppLink } = await importHelper();
    const url = buildWhatsAppLink("+971501234567", "Mariam 👋 السلام");
    // 👋 is U+1F44B → %F0%9F%91%8B in UTF-8.
    expect(url).toContain("%F0%9F%91%8B");
    // Arabic letters likewise encode to multi-byte sequences (not the
    // raw glyphs — wa.me requires URL-safe text in the querystring).
    expect(url).not.toContain("ا");
    expect(url).not.toContain("👋");
  });

  it("escapes reserved URL characters (&, =, +, #) in the message body", async () => {
    const { buildWhatsAppLink } = await importHelper();
    const url = buildWhatsAppLink(
      "+971501234567",
      "Price=4.2M & terms+conditions #fast",
    );
    expect(url).toContain("Price%3D4.2M%20%26%20terms%2Bconditions%20%23fast");
  });
});

describe("getAdvisorWhatsAppNumber + getMortgageWhatsAppNumber", () => {
  it("returns the env value when set", async () => {
    const { getAdvisorWhatsAppNumber, getMortgageWhatsAppNumber } =
      await importHelper();
    expect(getAdvisorWhatsAppNumber()).toBe("+971 50 111 1111");
    expect(getMortgageWhatsAppNumber()).toBe("+971 50 222 2222");
  });
});

describe("buildAdvisorWhatsAppLink + buildMortgageWhatsAppLink", () => {
  it("compose the advisor number with a message", async () => {
    const { buildAdvisorWhatsAppLink } = await importHelper();
    expect(buildAdvisorWhatsAppLink("Hi")).toBe(
      "https://wa.me/971501111111?text=Hi",
    );
  });

  it("compose the mortgage number with a message", async () => {
    const { buildMortgageWhatsAppLink } = await importHelper();
    expect(buildMortgageWhatsAppLink("Pre-approval for AED 4.2M")).toBe(
      "https://wa.me/971502222222?text=Pre-approval%20for%20AED%204.2M",
    );
  });

  it("return the base URL when no message is passed", async () => {
    const { buildAdvisorWhatsAppLink, buildMortgageWhatsAppLink } =
      await importHelper();
    expect(buildAdvisorWhatsAppLink()).toBe("https://wa.me/971501111111");
    expect(buildMortgageWhatsAppLink()).toBe("https://wa.me/971502222222");
  });
});

describe("placeholder fallback when env is unset", () => {
  it("uses +971501234567 when neither env var is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER", "");
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_MORTGAGE_NUMBER", "");
    const { buildAdvisorWhatsAppLink, buildMortgageWhatsAppLink } =
      await importHelper();
    expect(buildAdvisorWhatsAppLink()).toBe("https://wa.me/971501234567");
    expect(buildMortgageWhatsAppLink()).toBe("https://wa.me/971501234567");
    // Restore for any tests that run after this in the same file.
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER", "+971 50 111 1111");
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_MORTGAGE_NUMBER", "+971 50 222 2222");
  });
});
