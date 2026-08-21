/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { MASTER_PAGES } from "@/lib/master-pages/pages";
import {
  AREA_SECTIONS,
  DEVELOPMENT_SECTIONS,
} from "@/lib/master-pages/subpages";
import { BLOCK_DEFS } from "@/lib/page-builder/catalogue";
import { LIBRARY_SECTIONS } from "@/lib/master-pages/library";
import { SEARCH_HEADERS } from "@/lib/master-pages/search-headers";
import { DEVELOPER_PAGE_SECTION } from "@/lib/master-pages/developer-page";
import { isTranslatable } from "@/lib/master-pages/twins";
import type { FieldDef, ListFieldDef, SectionDef } from "@/lib/master-pages/types";
import { nonProseReason } from "./prose";

/**
 * G-16 — no translatable field holds data instead of prose.
 *
 * The content build generates Arabic for every field `isTranslatable` says
 * yes to. This asserts that set contains only things a translator should
 * actually see, measured against the *shipped default values* rather than
 * against what the key names suggest.
 *
 * The allowlist below is the honest remainder: values that trip the heuristic
 * and are still correctly translatable. It may only shrink — a new entry means
 * either a field that needs `i18n: false`, or a genuine exception that has to
 * be written down with its reason.
 *
 * This walks the registries locally. When the bag walker (`lib/i18n/mt/bag.ts`)
 * lands it owns the traversal and this test should call it instead — the
 * duplication is temporary and deliberate, so the opt-out audit could land
 * before the generator.
 */

type Slot = { path: string; value: string };

function collect(where: string, fields: FieldDef[], defaults: Record<string, unknown>): Slot[] {
  const out: Slot[] = [];
  for (const field of fields) {
    if (field.kind === "list") {
      const items = (defaults[field.key] as Record<string, unknown>[]) ?? [];
      for (const sub of (field as ListFieldDef).fields) {
        if (!isTranslatable(sub)) continue;
        items.forEach((item, i) => {
          const v = item?.[sub.key];
          if (typeof v === "string" && v.trim()) {
            out.push({ path: `${where}.${field.key}[${i}].${sub.key}`, value: v });
          }
        });
      }
      continue;
    }
    if (!isTranslatable(field)) continue;
    const v = defaults[field.key];
    if (typeof v === "string" && v.trim()) {
      out.push({ path: `${where}.${field.key}`, value: v });
    }
  }
  return out;
}

function everySlot(): Slot[] {
  const out: Slot[] = [];
  for (const page of MASTER_PAGES) {
    for (const s of page.sections) {
      out.push(...collect(`master/${page.key}·${s.key}`, s.fields, s.defaults));
    }
  }
  for (const s of AREA_SECTIONS as SectionDef[]) {
    out.push(...collect(`area·${s.key}`, s.fields, s.defaults));
  }
  for (const s of DEVELOPMENT_SECTIONS as SectionDef[]) {
    out.push(...collect(`development·${s.key}`, s.fields, s.defaults));
  }
  for (const b of BLOCK_DEFS) {
    out.push(...collect(`block/${b.key}`, b.fields, b.defaults));
  }
  for (const entry of LIBRARY_SECTIONS) {
    const s = entry.section;
    out.push(...collect(`library/${entry.key}·${s.key}`, s.fields, s.defaults));
  }
  for (const entry of SEARCH_HEADERS) {
    const s = entry.section;
    out.push(
      ...collect(`search-header/${entry.key}·${s.key}`, s.fields, s.defaults),
    );
  }
  {
    const s = DEVELOPER_PAGE_SECTION;
    out.push(...collect(`developer-page·${s.key}`, s.fields, s.defaults));
  }
  return out;
}

/**
 * Values that read as data and are translatable anyway, with the reason.
 *
 * **Shrink only.**
 */
const ALLOWED: Readonly<Record<string, string>> = {
  /*
   * `stats[].value` — the ten numeric ones, and the reason they stay ON.
   *
   * `statList()` is a shared builder used by twelve sections, and the same
   * field definition holds a number on one page and a phrase on another:
   *
   *     /off-plan  "78%"  "8"  "40/60"
   *     /rent      "Residential"  "8"  "Vacant" · "Homes + offices"
   *     /commercial "Lease"  "Fit-out"  "Abu Dhabi" · "Whole-cost"
   *
   * So `i18n: false` on the builder — which the content plan originally
   * called for — would strand eight visible strings in English on the
   * highest-traffic landing pages. The numeric values are protected at
   * generation time by masking, which is the mechanism that can tell "78%"
   * apart from "Whole-cost". This is the one place where the per-FIELD
   * opt-out is the wrong instrument and per-VALUE masking is the right one.
   */
  'master/home·who_we_are.stats[0].value': "numeric; statList holds prose elsewhere",
  'master/rent·hero.stats[1].value': "numeric; statList holds prose elsewhere",
  'master/off-plan·hero.stats[0].value': "numeric; statList holds prose elsewhere",
  'master/off-plan·hero.stats[1].value': "numeric; statList holds prose elsewhere",
  'master/off-plan·hero.stats[2].value': "numeric; statList holds prose elsewhere",
  'master/off-plan·why.stats[0].value': "numeric; statList holds prose elsewhere",
  'master/off-plan·why.stats[1].value': "numeric; statList holds prose elsewhere",
  'master/off-plan·why.stats[2].value': "numeric; statList holds prose elsewhere",
  'master/services·why.stats[1].value': "numeric; statList holds prose elsewhere",
  // "2h" is the one stat value that genuinely needs translating — the unit is
  // a word ("ساعتان"), not a symbol. It trips the heuristic on length alone.
  'master/off-plan·why.stats[3].value': "\"2h\" — the unit is a word, not a symbol",

  // "FAQ" reads as a code to the heuristic and is ordinary prose with a
  // settled Arabic form (الأسئلة الشائعة). Contrast "ADREC & DLD", which the
  // heuristic correctly leaves alone and which must stay Latin.
  'master/off-plan·faq.faq_eyebrow': "an acronym that does have an Arabic form",

  // Same case as FAQ: two capitals read as a code, and "HQ" is an ordinary
  // word with a settled Arabic form (المقر الرئيسي). It was a literal in
  // hq-map.tsx until it became a field, and it rendered "HQ" on /ar/contact
  // for exactly that reason.
  'master/contact·hq_map.eyebrow': "an abbreviation that does have an Arabic form",
};

const ALLOWED_CEILING = 12;

describe("G-16 · translatable fields hold prose", () => {
  it("finds no data-shaped value outside the allowlist", () => {
    const found = everySlot()
      .map((s) => ({ ...s, reason: nonProseReason(s.value) }))
      .filter((s) => s.reason)
      .filter((s) => !(s.path in ALLOWED));

    expect(
      found.map((s) => `${s.path} = ${JSON.stringify(s.value)}  (${s.reason})`),
      `These fields get an Arabic twin and hold data, not language.\n\n` +
        `Either mark the field \`i18n: false\` in its registry definition, or ` +
        `— if it is genuinely translatable and merely looks like data — add ` +
        `it to ALLOWED in lib/i18n/non-prose.test.ts with the reason, and ` +
        `raise ALLOWED_CEILING.`,
    ).toEqual([]);
  });

  it("only ever lets the allowlist shrink", () => {
    expect(Object.keys(ALLOWED).length).toBeLessThanOrEqual(ALLOWED_CEILING);
  });

  it("walks a believable number of slots", () => {
    // Guards against a registry import resolving to an empty array, which
    // would make the assertion above vacuously true — the failure mode that
    // let G-14 pass for a whole wave while scanning zero files.
    expect(everySlot().length).toBeGreaterThan(400);
  });
});
