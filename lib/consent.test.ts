import { describe, expect, it } from "vitest";
import {
  acceptAll,
  bannerShouldShow,
  CONSENT_VERSION,
  consentGranted,
  DEFAULT_DENIED,
  parseConsent,
  rejectAll,
  savePreferences,
  serialiseConsent,
} from "./consent";

const fixedClock = () => new Date("2026-05-22T08:00:00.000Z");

describe("acceptAll / rejectAll", () => {
  it("accept turns analytics + marketing on and stamps decided_at", () => {
    const s = acceptAll(fixedClock);
    expect(s.analytics).toBe(true);
    expect(s.marketing).toBe(true);
    expect(s.decided_at).toBe("2026-05-22T08:00:00.000Z");
    expect(s.version).toBe(CONSENT_VERSION);
  });

  it("reject keeps analytics + marketing off but still stamps decided_at", () => {
    const s = rejectAll(fixedClock);
    expect(s.analytics).toBe(false);
    expect(s.marketing).toBe(false);
    expect(s.decided_at).toBe("2026-05-22T08:00:00.000Z");
  });

  it("essential stays true on every transition", () => {
    expect(acceptAll().essential).toBe(true);
    expect(rejectAll().essential).toBe(true);
    expect(savePreferences({}).essential).toBe(true);
  });
});

describe("savePreferences", () => {
  it("turns categories on selectively", () => {
    const s = savePreferences({ analytics: true, marketing: false }, fixedClock);
    expect(s.analytics).toBe(true);
    expect(s.marketing).toBe(false);
    expect(s.decided_at).toBe("2026-05-22T08:00:00.000Z");
  });

  it("missing keys default to off (privacy-by-default)", () => {
    const s = savePreferences({}, fixedClock);
    expect(s.analytics).toBe(false);
    expect(s.marketing).toBe(false);
  });
});

describe("bannerShouldShow", () => {
  it("shows when no state exists", () => {
    expect(bannerShouldShow(null)).toBe(true);
  });

  it("shows when decided_at is null", () => {
    expect(bannerShouldShow(DEFAULT_DENIED)).toBe(true);
  });

  it("hides once a decision has been made at the current version", () => {
    expect(bannerShouldShow(acceptAll())).toBe(false);
    expect(bannerShouldShow(rejectAll())).toBe(false);
  });

  it("shows again when stored version is stale", () => {
    expect(
      bannerShouldShow({ ...acceptAll(), version: CONSENT_VERSION - 1 }),
    ).toBe(true);
  });
});

describe("parseConsent", () => {
  it("returns null for empty input", () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent("")).toBeNull();
  });

  it("returns null for non-JSON input", () => {
    expect(parseConsent("not-json")).toBeNull();
  });

  it("returns null when required fields are missing or wrong type", () => {
    expect(parseConsent('{"essential":false}')).toBeNull();
    expect(parseConsent('{"essential":true,"analytics":"yes"}')).toBeNull();
  });

  it("round-trips through serialise/parse", () => {
    const state = acceptAll(fixedClock);
    const restored = parseConsent(serialiseConsent(state));
    expect(restored).toEqual(state);
  });
});

describe("consentGranted", () => {
  it("always grants essential, even with no state", () => {
    expect(consentGranted(null, "essential")).toBe(true);
    expect(consentGranted(DEFAULT_DENIED, "essential")).toBe(true);
  });

  it("denies analytics + marketing until decided", () => {
    expect(consentGranted(null, "analytics")).toBe(false);
    expect(consentGranted(DEFAULT_DENIED, "analytics")).toBe(false);
    expect(consentGranted(DEFAULT_DENIED, "marketing")).toBe(false);
  });

  it("grants categories after the user accepts", () => {
    const s = acceptAll();
    expect(consentGranted(s, "analytics")).toBe(true);
    expect(consentGranted(s, "marketing")).toBe(true);
  });

  it("respects per-category choice after savePreferences", () => {
    const s = savePreferences({ analytics: true });
    expect(consentGranted(s, "analytics")).toBe(true);
    expect(consentGranted(s, "marketing")).toBe(false);
  });
});
