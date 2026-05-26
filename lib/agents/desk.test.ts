import { describe, expect, it } from "vitest";
import { advisorOfMonth, deskForTitle, groupByDesk } from "./desk";

describe("agents/desk", () => {
  it("derives leadership from common title patterns", () => {
    expect(deskForTitle("Managing Director")).toBe("leadership");
    expect(deskForTitle("Founding Partner")).toBe("leadership");
    expect(deskForTitle("Principal · Saadiyat")).toBe("leadership");
  });

  it("derives off-plan from off-plan / investment titles", () => {
    expect(deskForTitle("Senior Advisor · Off-plan & Investment")).toBe(
      "off-plan",
    );
    expect(deskForTitle("Investment desk")).toBe("off-plan");
    expect(deskForTitle("OffPlan team")).toBe("off-plan");
  });

  it("derives lettings from tenant / rental titles", () => {
    expect(deskForTitle("Senior Advisor · Tenant & rental")).toBe("lettings");
    expect(deskForTitle("Letting agent")).toBe("lettings");
    expect(deskForTitle("Landlord relations")).toBe("lettings");
  });

  it("falls back to buy-side for everything else", () => {
    expect(deskForTitle("Senior Advisor · Saadiyat & Yas")).toBe("buy-side");
    expect(deskForTitle("Senior Advisor · Heritage estates")).toBe(
      "buy-side",
    );
    expect(deskForTitle(null)).toBe("buy-side");
    expect(deskForTitle(undefined)).toBe("buy-side");
    expect(deskForTitle("")).toBe("buy-side");
  });

  it("groupByDesk returns buckets in display order, skipping empties", () => {
    const groups = groupByDesk([
      { title: "Managing Director" },
      { title: "Senior Advisor · Saadiyat & Yas" },
      { title: "Senior Advisor · Off-plan & Investment" },
      { title: "Senior Advisor · Tenant & rental" },
      { title: "Senior Advisor · Reem & Maryah" },
    ]);
    expect(groups.map(([d]) => d)).toEqual([
      "leadership",
      "buy-side",
      "off-plan",
      "lettings",
    ]);
    expect(groups.find(([d]) => d === "buy-side")![1]).toHaveLength(2);
  });

  it("groupByDesk omits desks with zero advisors", () => {
    const groups = groupByDesk([
      { title: "Managing Director" },
      { title: "Senior Advisor · Saadiyat" },
    ]);
    expect(groups.map(([d]) => d)).toEqual(["leadership", "buy-side"]);
  });

  it("advisorOfMonth skips leadership and rotates by month", () => {
    const roster = [
      { title: "Managing Director", name: "L" },
      { title: "Senior Advisor · Saadiyat", name: "A" },
      { title: "Senior Advisor · Reem", name: "B" },
      { title: "Senior Advisor · Off-plan", name: "C" },
    ];
    const jan = new Date(Date.UTC(2026, 0, 15));
    const feb = new Date(Date.UTC(2026, 1, 15));
    const mar = new Date(Date.UTC(2026, 2, 15));
    const apr = new Date(Date.UTC(2026, 3, 15));
    const a1 = advisorOfMonth(roster, jan);
    const a2 = advisorOfMonth(roster, feb);
    const a3 = advisorOfMonth(roster, mar);
    const a4 = advisorOfMonth(roster, apr);
    // Leadership ("L") never appears
    expect([a1, a2, a3, a4].map((x) => x?.name)).not.toContain("L");
    // Monthly rotation through the 3 senior advisors
    expect(new Set([a1?.name, a2?.name, a3?.name])).toEqual(
      new Set(["A", "B", "C"]),
    );
    // Cycle wraps in the fourth month
    expect(a4?.name).toBe(a1?.name);
  });

  it("advisorOfMonth handles empty + leadership-only rosters", () => {
    expect(advisorOfMonth([])).toBeNull();
    expect(advisorOfMonth([{ title: "Managing Director" }])).toBeNull();
  });
});
