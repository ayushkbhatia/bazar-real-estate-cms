import { describe, expect, it } from "vitest";
import { areaCardSubtitle, areaCardSubtitleIssues } from "./area-card-subtitle";

describe("areas card subtitle", () => {
  it("fills {count} with the live count, so the number follows the listings", () => {
    expect(areaCardSubtitle("{count} homes for sale", 10)).toBe("10 homes for sale");
    expect(areaCardSubtitle("{count} homes for sale", 15)).toBe("15 homes for sale");
    expect(areaCardSubtitle("{count} عقار للبيع", 1240)).toBe("1,240 عقار للبيع");
  });

  it("falls back to the catalogue line when blank, or when there is no count to fill", () => {
    expect(areaCardSubtitle("", 10)).toBeNull();
    expect(areaCardSubtitle(null, 10)).toBeNull();
    expect(areaCardSubtitle("{count} homes", undefined)).toBeNull();
  });

  it("refuses a subtitle that would freeze the number", () => {
    const sections = [
      {
        key: "area_cards",
        enabled: true,
        values: {
          cards: [
            { name: "Al Raha", subtitle: "10 homes for sale", subtitle_ar: "{count} عقار" },
            { name: "Saadiyat", subtitle: "{count} villas", subtitle_ar: "فلل" },
            { name: "Yas", subtitle: "" },
          ],
        },
      },
    ];
    const issues = areaCardSubtitleIssues(sections as never);
    expect(issues.map((i) => i.field)).toEqual(["Al Raha · Subtitle", "Saadiyat · Subtitle (Arabic)"]);
  });
});
