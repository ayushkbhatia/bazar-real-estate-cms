import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * OG cards stay English, and this is the guard that keeps them that way.
 *
 * Satori (the renderer behind `next/og`) shapes Arabic but does not reorder
 * it. That was measured here, not assumed — rendering
 * `"فيلا فاخرة في جزيرة السعديات"` through `ImageResponse` with IBM Plex Sans
 * Arabic supplied as a TTF produced correctly joined cursive letterforms with
 * the words laid out left-to-right, so the sentence reads backwards. Setting
 * `direction: "rtl"` on the text node changed nothing — the two renders were
 * pixel-identical. (`flexDirection: "row-reverse"` *does* work, so the card
 * chrome could be mirrored; it is the text that cannot.)
 *
 * A bidi pre-pass gets close enough to be dangerous. Reversing run order, and
 * word order inside RTL runs, while leaving each word's characters in logical
 * order for the shaper, renders a *single line* correctly — Latin islands like
 * `AED 2,500,000` and `BR-1042` survive intact and in the right places.
 *
 * It then falls apart on the first wrap, which is fatal here because OG cards
 * exist to hold titles. A realistic property title in a 620px column wrapped
 * to three lines and put the tail of the sentence on line one and its first
 * word alone on line three: read top-to-bottom the card is backwards. Fixing
 * that means breaking the lines ourselves, which means measuring text with the
 * font metrics from outside Satori and hoping our line breaks match the ones
 * it would have chosen. Wrong guesses ship as garbled social cards.
 *
 * So the same call as PDFs (see lib/pdf/language-note.ts): an English card is
 * an unfinished feature, a backwards Arabic one is a broken feature, and the
 * English card is what these routes already render under /ar today.
 *
 * Confirmed with the client 2026-08-13: OG cards stay English permanently, with
 * no mirroring. This is therefore a settled decision rather than deferred work
 * — nothing is scheduled to replace it. The measurements below are kept so that
 * anyone reopening the question starts from evidence instead of re-deriving it.
 *
 * The trap this guards is specific. P4 made Arabic content trivial to reach —
 * `applyLocale` hands any surface its Arabic in one call — so the natural next
 * move for someone improving these routes is to pass Arabic into the card.
 * Nothing would fail: it type-checks, it builds, it renders, and the defect is
 * only visible to someone who reads Arabic and thinks to look at a share
 * preview. Hence a test rather than a comment.
 *
 * Deleting an entry here is the deliberate act of shipping Arabic OG, and the
 * thing to have solved first is line breaking.
 */
const REPO_ROOT = path.join(__dirname, "..", "..");

const OG_ROUTES = [
  "app/opengraph-image.tsx",
  "app/[locale]/(public)/p/[slug]/opengraph-image.tsx",
  "app/[locale]/(public)/areas/[slug]/opengraph-image.tsx",
  "app/[locale]/(public)/insights/[slug]/opengraph-image.tsx",
];

/**
 * Ways Arabic content reaches a component in this codebase. `applyLocale` is
 * the master-page/page-builder fold; `_ar` catches a twin column read straight
 * off a row (`title_ar`), which is how a property card would get it.
 */
const ARABIC_CONTENT = [
  { pattern: /\bapplyLocale\b/, what: "applyLocale()" },
  { pattern: /_ar\b/, what: "an _ar twin field" },
  { pattern: /\barabicTwins\b/, what: "arabicTwins()" },
];

describe("OG images render English only", () => {
  it.each(OG_ROUTES)("%s does not consume Arabic content", (route) => {
    const src = readFileSync(path.join(REPO_ROOT, route), "utf8");
    for (const { pattern, what } of ARABIC_CONTENT) {
      expect(
        pattern.test(src),
        `${route} reads ${what}. Satori cannot reorder Arabic across a line ` +
          `break, so this renders a backwards card. See the note at the top ` +
          `of lib/og/arabic-og.test.ts.`,
      ).toBe(false);
    }
  });

  it("covers every OG route in the tree", async () => {
    // A new opengraph-image.tsx added later is exactly the case that would
    // slip through a hand-listed set, so the list is checked against reality.
    const { globSync } = await import("tinyglobby");
    const found = globSync("app/**/opengraph-image.tsx", {
      cwd: REPO_ROOT,
    }).sort();
    expect(found).toEqual([...OG_ROUTES].sort());
  });
});
