import { describe, it, expect } from "vitest";
import { communityKey } from "./community-key";

/**
 * The communities band leads with project cards and follows with the CMS's
 * editorial list, deduped against them. The dedupe is a name match across two
 * systems that name the same place differently, so it is the part most likely
 * to go quietly wrong: too loose and a community disappears off the page, too
 * strict and it appears twice.
 */
describe("communityKey", () => {
  it("matches the CMS name to the project name across the three real cases", () => {
    // Hudayriyat: the seeded community list against the published projects.
    expect(communityKey("Al Naseem Community")).toBe(communityKey("Al Naseem"));
    expect(communityKey("Bashayer")).toBe(communityKey("Bashayer Residences"));
    expect(communityKey("Hudayriyat Golf Estates")).toBe(
      communityKey("Hudayriyat Golf Estate"),
    );
  });

  it("does not collapse distinct communities that share a first word", () => {
    // The failure a prefix match would produce: three separate Nawayef
    // communities on the Hudayriyat guide, deduped down to one.
    const nawayef = [
      "Nawayef Village",
      "Nawayef Park Views",
      "Nawayef East",
    ].map(communityKey);
    expect(new Set(nawayef).size).toBe(3);
  });

  /**
   * The bug this function had until the Arabic epic reached /areas.
   *
   * Both inputs are already folded — `developments.name` at developments.ts:159
   * and the editorial item's name through the section choke point — so on /ar
   * they arrive in Arabic. Under the old `/[^a-z0-9]/g` every Arabic name
   * reduced to "", the project key set became `{""}`, and that single key
   * matched every editorial entry: the whole communities band vanished as
   * duplicates. Silent, and invisible in English.
   */
  it("keeps Arabic names distinct instead of collapsing them to one key", () => {
    const arabic = ["النسيم", "بشاير", "نويف", "مرسى السعديات"].map(
      communityKey,
    );
    expect(arabic.every((k) => k.length > 0)).toBe(true);
    expect(new Set(arabic).size).toBe(4);
  });

  it("still dedupes an Arabic name against itself, spacing and all", () => {
    // The dedupe has to keep working in Arabic, not merely stop misfiring.
    expect(communityKey("  النسيم ")).toBe(communityKey("النسيم"));
  });

  it("leaves every Latin key byte-identical to before", () => {
    // The English site is live; this change must be a no-op for it.
    expect(communityKey("Al Naseem Community")).toBe("alnaseem");
    expect(communityKey("Hudayriyat Golf Estates")).toBe("hudayriyatgolf");
    expect(communityKey("  al-zeina ")).toBe("alzeina");
    expect(communityKey("Nawayef Park Views")).toBe("nawayefparkviews");
  });

  it("ignores punctuation, case and spacing", () => {
    expect(communityKey("  al-zeina ")).toBe(communityKey("Al Zeina"));
    expect(communityKey("Marsa Al Saadiyat")).toBe(
      communityKey("marsa al saadiyat"),
    );
  });

  it("strips a doubled generic tail", () => {
    expect(communityKey("Fahid Beach Residences")).toBe(
      communityKey("Fahid Beach"),
    );
  });

  it("keeps a generic word that is not the tail", () => {
    // "Village" leading or mid-name is part of the identity, not a suffix.
    expect(communityKey("Al Khaleej Village")).not.toBe(
      communityKey("Al Khaleej Village Two"),
    );
    expect(communityKey("Souk Al Jubail")).toBe(communityKey("Souk Al Jubail"));
  });

  it("returns a stable empty key rather than throwing on junk", () => {
    expect(communityKey("")).toBe("");
    expect(communityKey("   ")).toBe("");
    expect(communityKey("—")).toBe("");
  });
});
