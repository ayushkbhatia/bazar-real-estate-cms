/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { fromSlots, markIssues, toSlots } from "@/lib/i18n/mt/html";

/**
 * The Arabic half of internal links rests on one property of the translation
 * walker (lib/i18n/mt/html.ts), and this pins it: a link block and a text
 * link's record attributes go through a translation untouched.
 *
 * A block has no words, so it must produce no slot — nothing is sent to the
 * model, and the element is copied through verbatim, id and all. A text link
 * is an inline tag, so it is masked as ⟦mN⟧ like bold is and restored byte
 * for byte, wherever the Arabic sentence moves it. Break either and a
 * translated body silently drops its cards, or re-points its links.
 */

const ID = "0d4c6b8e-5a1f-4e2b-9c3d-7f8e9a0b1c2d";
const BLOCK = `<div data-internal-link="area" data-id="${ID}" data-variant="card" data-label="Yas Island"></div>`;
const LINK_OPEN = `<a href="/areas/yas-island" data-link-kind="area" data-link-id="${ID}">`;

const EN = `<p>Villas on ${LINK_OPEN}Yas Island</a> held.</p>${BLOCK}<p>Next.</p>`;

describe("the translation walker and internal links", () => {
  it("sends no words from a link block to the model", () => {
    const doc = toSlots(EN);
    expect(doc.slots.map((s) => s.text)).toEqual([
      "Villas on ⟦m0⟧Yas Island⟦m1⟧ held.",
      "Next.",
    ]);
    // The record id is in a mark, never in text the model could rewrite.
    expect(doc.slots[0].marks[0]).toBe(LINK_OPEN);
  });

  it("puts the block and the link's record back exactly", () => {
    const doc = toSlots(EN);
    const arabic = ["صمدت الفلل في ⟦m0⟧جزيرة ياس⟦m1⟧.", "التالي."];
    for (const [i, t] of arabic.entries()) {
      expect(markIssues(doc.slots[i], t)).toEqual([]);
    }
    const out = fromSlots(doc, arabic);
    expect(out).toBe(
      `<p>صمدت الفلل في ${LINK_OPEN}جزيرة ياس</a>.</p>${BLOCK}<p>التالي.</p>`,
    );
  });

  it("is the identity when nothing is translated", () => {
    const doc = toSlots(EN);
    expect(fromSlots(doc, doc.slots.map(() => null))).toBe(EN);
  });
});
