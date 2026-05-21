import { describe, it, expect } from "vitest";
import {
  alertWindowStart,
  alertEmailTemplate,
} from "./saved-search-alerts";

describe("alertWindowStart", () => {
  const NOW = new Date("2026-05-21T12:00:00Z");

  it("returns the stored last_alert_at when set", () => {
    const since = alertWindowStart("2026-05-20T00:00:00Z", "daily", NOW);
    expect(since.toISOString()).toBe("2026-05-20T00:00:00.000Z");
  });

  it("falls back 24h for daily when never alerted", () => {
    const since = alertWindowStart(null, "daily", NOW);
    expect(NOW.getTime() - since.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("falls back 7d for weekly when never alerted", () => {
    const since = alertWindowStart(null, "weekly", NOW);
    expect(NOW.getTime() - since.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("alertEmailTemplate", () => {
  const MATCHES = [
    {
      id: "1",
      reference: "BAZ-AD-04891",
      slug: "mamsha-3-bed-beachfront-apartment",
      title: "Mamsha · 3-bed beachfront",
      price_aed: 4_200_000,
      beds: 3,
      baths: 4,
      built_up_ft2: 2840,
      area_name: "Saadiyat Island",
    },
    {
      id: "2",
      reference: "BAZ-AD-04902",
      slug: "yas-bay-2-bed-waterfront",
      title: "Yas Bay · 2-bed waterfront",
      price_aed: 1_850_000,
      beds: 2,
      baths: 2,
      built_up_ft2: 1340,
      area_name: "Yas Island",
    },
  ];

  it("subject reflects the match count", () => {
    expect(
      alertEmailTemplate({
        searchName: "Saadiyat 3-bed",
        matches: MATCHES,
        manageUrl: "https://x/account/saved",
      }).subject,
    ).toBe('2 new matches for "Saadiyat 3-bed"');
    expect(
      alertEmailTemplate({
        searchName: "Saadiyat 3-bed",
        matches: [MATCHES[0]],
        manageUrl: "https://x/account/saved",
      }).subject,
    ).toBe('1 new match for "Saadiyat 3-bed"');
  });

  it("HTML escapes the search name and area", () => {
    const { html } = alertEmailTemplate({
      searchName: '<script>"</script>',
      matches: [
        { ...MATCHES[0], area_name: '<b>"island"</b>' },
      ],
      manageUrl: "https://x/account/saved",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&quot;");
  });

  it("text version lists each match with its canonical URL", () => {
    const { text } = alertEmailTemplate({
      searchName: "Q",
      matches: MATCHES,
      manageUrl: "https://x/account/saved",
    });
    expect(text).toContain("/p/mamsha-3-bed-beachfront-apartment-baz-ad-04891");
    expect(text).toContain("/p/yas-bay-2-bed-waterfront-baz-ad-04902");
    expect(text).toContain("BAZ-AD-04891");
    expect(text).toContain("BAZ-AD-04902");
  });
});
