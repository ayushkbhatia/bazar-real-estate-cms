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
 * A block declares its requirement as `BlockDef.rowsRequired` (a list it
 * cannot render without) or `BlockDef.pickRequired` (the one record it is a
 * view of — a project section with no project picked). Blocks whose
 * emptiness depends on *data* rather than on the document — the developments
 * rail with no picks falls back to the three most recent, the testimonials
 * block reads the section library — are deliberately not covered: an empty
 * result there is a catalogue state, not something the editor left blank, and
 * blocking publish on it would take a campaign page down for an unrelated
 * record going off-market.
 */

import { isListField, list, type SectionValues } from "@/lib/master-pages";
import type { LandingProject } from "@/lib/queries/landing-projects";
import {
  PROJECT_FEATURE_LABELS,
  type BlockDef,
  type ProjectFeature,
  type ResolvedBlock,
} from "./types";

export type ContentGap = {
  /** `BlockInstance.id`, so the editor can mark the row it belongs to. */
  id: string;
  /** The block's catalogue label — "How it works". */
  label: string;
  /** Editor-facing sentence, complete on its own. */
  message: string;
};

/**
 * Rows in `field` that carry something in `itemKey`, the way each adapter
 * counts: text that isn't blank, or — for a photo — a picture actually chosen.
 * A photo row still on its placeholder draws nothing in a gallery.
 */
function usableRows(values: SectionValues, key: string, itemKey: string): number {
  return list<Record<string, unknown>>(values, key).filter((item) => {
    const v = item?.[itemKey];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const id = (v as { media_id?: unknown }).media_id;
      return typeof id === "string" && id.trim() !== "";
    }
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
  const pick = def.pickRequired;
  if (pick) {
    const v = values[pick.key];
    if (typeof v !== "string" || v.trim() === "") {
      return `No ${pick.noun} is picked, so this section wouldn't appear on the page. Choose one, or remove the section.`;
    }
  }

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

/**
 * What a project can show, by the same tests the project-section adapters
 * apply before drawing (`adapters.ts` — each returns null without its thing).
 * `adapters.test.ts` holds the two to each other.
 */
export function projectFeaturesOf(p: LandingProject): ProjectFeature[] {
  const out: ProjectFeature[] = [];
  if (p.paymentPlan) out.push("payment_plan");
  if (p.masterplan) out.push("master_plan");
  if (p.unitTypes.length > 0) out.push("unit_types");
  if (p.coords) out.push("location");
  return out;
}

/**
 * What a picked project is missing for this section, or null.
 *
 * ADVISORY, and deliberately kept apart from `blockContentGap`: a project
 * with no payment plan today may have one tomorrow, so this can mark the
 * editor row but must never refuse a publish — the same rule pick resolution
 * follows (a listing going off-market does not take a campaign down).
 *
 * `features` is what the editor page read from the catalogue; a project it
 * has no entry for — unpublished since, or a stale tab — says nothing here,
 * because the pick itself is already reported as unavailable.
 */
export function blockCatalogueGap(
  def: BlockDef,
  values: SectionValues,
  features: Readonly<Record<string, readonly ProjectFeature[]>>,
): string | null {
  const need = def.pickRequired?.requires;
  if (!need || !def.pickRequired) return null;
  const slug = values[def.pickRequired.key];
  if (typeof slug !== "string" || slug === "") return null;
  const has = features[slug];
  if (!has || has.includes(need)) return null;
  return `This project has no ${PROJECT_FEATURE_LABELS[need]} yet, so the section stays hidden until one is added in Developments. The page can still be published.`;
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
