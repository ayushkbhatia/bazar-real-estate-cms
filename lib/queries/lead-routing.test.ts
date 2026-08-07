import { describe, expect, it } from "vitest";
import {
  pickAdvisor,
  resolveAreaSlugs,
  toInitials,
  type AdvisorCandidate,
  type LeadAreaOption,
} from "./lead-routing";

const AREAS: LeadAreaOption[] = [
  {
    slug: "saadiyat-island",
    name: "Saadiyat Island",
    parentSlug: null,
    context: "Abu Dhabi",
  },
  {
    slug: "saadiyat-lagoons",
    name: "Saadiyat Lagoons",
    parentSlug: "saadiyat-island",
    context: "Saadiyat Island",
  },
  {
    slug: "al-reem-island",
    name: "Al Reem Island",
    parentSlug: null,
    context: "Abu Dhabi",
  },
];

function advisor(
  over: Partial<AdvisorCandidate> & Pick<AdvisorCandidate, "slug">,
): AdvisorCandidate {
  return {
    displayName: over.slug,
    title: "Senior Advisor",
    brn: "BRN-1",
    userId: "11111111-1111-1111-1111-111111111111",
    specialties: [],
    areas: [],
    phone: null,
    ...over,
  };
}

describe("resolveAreaSlugs", () => {
  it("prefers an explicit pick from the suggestion list", () => {
    expect(
      resolveAreaSlugs("some tower, somewhere", AREAS, "al-reem-island"),
    ).toEqual(["al-reem-island"]);
  });

  it("returns the community then its parent, so routing can widen", () => {
    expect(resolveAreaSlugs("Saadiyat Lagoons", AREAS)).toEqual([
      "saadiyat-lagoons",
      "saadiyat-island",
    ]);
  });

  it("matches the most specific name in free text", () => {
    // "Saadiyat Lagoons" contains "Saadiyat" — the longer name must win, or
    // every Lagoons lead routes as if it were plain Saadiyat Island.
    expect(resolveAreaSlugs("Villa in saadiyat lagoons", AREAS)[0]).toBe(
      "saadiyat-lagoons",
    );
  });

  it("returns nothing for an address it can't place", () => {
    expect(resolveAreaSlugs("Somewhere in Dubai Marina", AREAS)).toEqual([]);
  });
});

describe("pickAdvisor", () => {
  const mariam = advisor({
    slug: "mariam",
    areas: ["saadiyat-island", "yas-island"],
  });
  const lina = advisor({
    slug: "lina",
    specialties: ["Rent", "Relocation"],
    areas: ["saadiyat-island"],
  });
  const junior = advisor({
    slug: "junior",
    title: "Associate Advisor",
    areas: ["saadiyat-lagoons"],
  });

  it("returns nobody when the area couldn't be resolved", () => {
    expect(
      pickAdvisor([mariam, lina], { areaSlugs: [], intent: "sell" }),
    ).toBeNull();
  });

  it("returns nobody when no advisor covers the area", () => {
    expect(
      pickAdvisor([mariam], {
        areaSlugs: ["al-ghadeer"],
        intent: "sell",
      }),
    ).toBeNull();
  });

  it("keeps a sale off the lettings desk", () => {
    expect(
      pickAdvisor([lina, mariam], {
        areaSlugs: ["saadiyat-island"],
        intent: "sell",
      })?.slug,
    ).toBe("mariam");
  });

  it("sends a letting to the lettings desk", () => {
    expect(
      pickAdvisor([mariam, lina], {
        areaSlugs: ["saadiyat-island"],
        intent: "rent_out",
      })?.slug,
    ).toBe("lina");
  });

  it("prefers coverage of the exact community over its parent area", () => {
    expect(
      pickAdvisor([mariam, junior], {
        areaSlugs: ["saadiyat-lagoons", "saadiyat-island"],
        intent: "sell",
      })?.slug,
    ).toBe("junior");
  });

  it("is deterministic — the same property always routes the same way", () => {
    const opts = { areaSlugs: ["saadiyat-island"], intent: "sell" as const };
    const first = pickAdvisor([mariam, lina], opts)?.slug;
    const second = pickAdvisor([lina, mariam], opts)?.slug;
    expect(first).toBe(second);
  });
});

describe("toInitials", () => {
  it("takes first and last", () => {
    expect(toInitials("Mariam Al-Hashimi")).toBe("MA");
    expect(toInitials("Cher")).toBe("C");
    expect(toInitials("   ")).toBe("BZ");
  });
});
