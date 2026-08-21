/**
 * Sections that would render nothing.
 *
 * `_render.tsx` drops a list-driven block whose list is empty — a heading over
 * an empty grid reads as a broken page, so the whole section goes. That rule is
 * right, and on its own it is also silent: the editor showed the section, the
 * save succeeded, the publish gate passed, and the section simply was not on
 * the page. Reported as a landing page that lost five of its seven sections.
 *
 * So the same fact is stated once, here, and read twice: the editor marks the
 * row before anyone saves, and the gate refuses to publish. Pure, so both get
 * the same answer.
 *
 * A block declares its requirement as `BlockDef.rowsRequired`. Blocks whose
 * emptiness depends on *data* rather than on the document — the developments
 * rail with no picks falls back to the three most recent, the testimonials
 * block reads the section library — are deliberately not covered: an empty
 * result there is a catalogue state, not something the editor left blank, and
 * blocking publish on it would take a campaign page down for an unrelated
 * record going off-market.
 */

import { isListField, list, type SectionValues } from "@/lib/master-pages";
import type { BlockDef, ResolvedBlock } from "./types";

export type ContentGap = {
  /** `BlockInstance.id`, so the editor can mark the row it belongs to. */
  id: string;
  /** The block's catalogue label — "How it works". */
  label: string;
  /** Editor-facing sentence, complete on its own. */
  message: string;
};

/** Rows in `field` that carry text in `itemKey`, the way each adapter counts. */
function usableRows(values: SectionValues, key: string, itemKey: string): number {
  return list<Record<string, unknown>>(values, key).filter((item) => {
    const v = item?.[itemKey];
    return typeof v === "string" && v.trim() !== "";
  }).length;
}

/**
 * Why this block would draw nothing, or null if it will draw.
 *
 * Phrased for an editor looking at one row: what is missing, and the two ways
 * out of it.
 */
export function blockContentGap(
  def: BlockDef,
  values: SectionValues,
): string | null {
  const need = def.rowsRequired;
  if (!need) return null;

  if (need.onlyWhen) {
    const actual = values[need.onlyWhen.key];
    if (actual !== need.onlyWhen.value) return null;
  }

  if (usableRows(values, need.key, need.itemKey) > 0) return null;

  const field = def.fields.find((f) => f.key === need.key);
  const itemLabel = field && isListField(field) ? field.itemLabel : "item";
  return `This section has no ${itemLabel}s yet, so it wouldn't appear on the page. Add at least one, or remove the section.`;
}

/** Every enabled block that would render nothing, in document order. */
export function contentGaps(blocks: ResolvedBlock[]): ContentGap[] {
  const gaps: ContentGap[] = [];
  for (const block of blocks) {
    if (!block.enabled || !block.def) continue;
    const message = blockContentGap(block.def, block.values);
    if (message) {
      gaps.push({ id: block.id, label: block.def.label, message });
    }
  }
  return gaps;
}
