import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  list,
  parseStoredSections,
  resolveSections,
  str,
  validateSections,
} from "./index";
import { AREA_SECTIONS, areaPageDef } from "./subpages";

/**
 * The area guides' copy ships as a data migration, not as code — the template
 * declares the bands, the section document carries the words, and the CMS edits
 * the document. That split is what makes every heading, statistic and FAQ
 * editable, but it also means the content is never type-checked: a heading two
 * characters over its limit, or a section key that no longer exists, would only
 * surface as a save failure in front of an editor.
 *
 * So the migrations are read back here and put through the same validator the
 * server action uses. If this passes, opening any of these guides in the CMS
 * and hitting save is guaranteed to work.
 */

const MIGRATIONS = [
  "0091_area_guide_content.sql",
  "0092_area_guide_content_researched.sql",
];

/** The thirteen bands, in the order the content deck lays them out. */
const GUIDE_ORDER = [
  "hero",
  "hero-image",
  "stats",
  "map",
  "landmarks",
  "communities",
  "listings",
  "rentals",
  "nearby",
  "why",
  "lead-form",
  "faq",
  "final-cta",
];

type Seeded = { file: string; slug: string; title: string; blocks: unknown };

function readSeeded(file: string): Seeded[] {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations", file),
    "utf8",
  );
  const re =
    /values \(\s*'subpage\/area\/([a-z0-9-]+)',\s*'([^']*(?:''[^']*)*)',\s*'published',\s*\$doc\$([\s\S]*?)\$doc\$::jsonb/g;
  const out: Seeded[] = [];
  for (const m of sql.matchAll(re)) {
    out.push({
      file,
      slug: m[1],
      title: m[2].replace(/''/g, "'"),
      blocks: JSON.parse(m[3]),
    });
  }
  return out;
}

const seeded = MIGRATIONS.flatMap(readSeeded);
const bySlug = new Map(seeded.map((s) => [s.slug, s]));

describe("the seeded area guides", () => {
  it("covers every area the catalogue has a guide page for", () => {
    // `abu-dhabi` is the emirate row — a hierarchy root, not a guide — so it is
    // the one deliberate omission.
    expect([...bySlug.keys()].sort()).toEqual([
      "adgm",
      "al-ghadeer",
      "al-maryah",
      "al-raha",
      "al-raha-beach",
      "al-raha-gardens",
      "al-reem-island",
      "corniche",
      "fahid-island",
      "hidd-al-saadiyat",
      "hudayriyat-island",
      "jubail-island",
      "khalifa-city",
      "kizad",
      "mamsha-al-saadiyat",
      "masdar-city",
      "mussafah",
      "nurai-island",
      "saadiyat-island",
      "saadiyat-lagoons",
      "saadiyat-reserve",
      "yas-acres",
      "yas-island",
      "zayed-city",
    ]);
  });

  it("writes each guide exactly once, across both migrations", () => {
    expect(bySlug.size).toBe(seeded.length);
  });

  it.each(seeded.map((s) => [s.slug, s] as const))(
    "%s passes the same validator the CMS save uses",
    (slug, doc) => {
      const stored = parseStoredSections(doc.blocks);
      expect(stored, slug).not.toBeNull();
      const result = validateSections(
        areaPageDef({ name: doc.title, slug }),
        stored!,
      );
      // The failure message matters more than the assertion here — it names the
      // section and field that is over length or unknown.
      if (!result.ok) {
        throw new Error(
          `${slug}: ${result.issues
            .map((i) => `${i.section} · ${i.field}: ${i.message}`)
            .join("; ")}`,
        );
      }
      expect(result.ok).toBe(true);
    },
  );

  it.each(seeded.map((s) => [s.slug, s] as const))(
    "%s renders the thirteen bands, with the older ones off",
    (slug, doc) => {
      const resolved = resolveSections(
        areaPageDef({ name: doc.title, slug }),
        parseStoredSections(doc.blocks),
      );
      expect(
        resolved.filter((s) => s.enabled).map((s) => s.key),
        slug,
      ).toEqual(GUIDE_ORDER);
      // Every key stored has to be one the template knows, or the band is
      // written to a section that will never render.
      const known = new Set(AREA_SECTIONS.map((s) => s.key));
      for (const s of parseStoredSections(doc.blocks)!) {
        expect(known.has(s.key), `${slug} · ${s.key}`).toBe(true);
      }
    },
  );

  it.each(seeded.map((s) => [s.slug, s] as const))(
    "%s carries the copy the page leads with",
    (slug, doc) => {
      const resolved = resolveSections(
        areaPageDef({ name: doc.title, slug }),
        parseStoredSections(doc.blocks),
      );
      const values = (key: string) =>
        resolved.find((s) => s.key === key)?.values ?? {};

      // The four bands with no live-data fallback: blank here means a blank
      // section on the page.
      expect(str(values("hero"), "intro"), slug).toBeTruthy();
      expect(str(values("hero"), "position"), slug).toBeTruthy();
      expect(list(values("why"), "items").length, slug).toBeGreaterThanOrEqual(3);
      expect(list(values("faq"), "items").length, slug).toBeGreaterThanOrEqual(3);
      expect(list(values("nearby"), "items").length, slug).toBeGreaterThanOrEqual(2);
      expect(list(values("communities"), "items").length, slug).toBeGreaterThanOrEqual(3);
      expect(list(values("landmarks"), "items").length, slug).toBeGreaterThanOrEqual(3);
      expect(str(values("final-cta"), "heading"), slug).toBeTruthy();
    },
  );

  it("gives the deck's areas their market statistics", () => {
    // The eleven areas from the content deck carry index figures. The
    // researched thirteen deliberately may not — see the header of 0090.
    const deck = readSeeded(MIGRATIONS[0]);
    expect(deck).toHaveLength(11);
    for (const doc of deck) {
      const resolved = resolveSections(
        areaPageDef({ name: doc.title, slug: doc.slug }),
        parseStoredSections(doc.blocks),
      );
      const stats = list<{ value?: string }>(
        resolved.find((s) => s.key === "stats")?.values ?? {},
        "stats",
      );
      expect(stats.length, doc.slug).toBeGreaterThanOrEqual(4);
      for (const s of stats) expect(s.value, doc.slug).toBeTruthy();
    }
  });

  it("never invents a market index for a researched area", () => {
    // The guard that keeps 0090 honest: a figure quoted in AED per square foot
    // is index data, and none of the researched areas has a sourced one.
    for (const doc of readSeeded(MIGRATIONS[1])) {
      const resolved = resolveSections(
        areaPageDef({ name: doc.title, slug: doc.slug }),
        parseStoredSections(doc.blocks),
      );
      const stats = list<{ value?: string }>(
        resolved.find((s) => s.key === "stats")?.values ?? {},
        "stats",
      );
      for (const s of stats) {
        expect(s.value ?? "", `${doc.slug} · ${s.value}`).not.toMatch(
          /AED\s*[\d,]+\s*\/\s*sq/i,
        );
      }
    }
  });
});
