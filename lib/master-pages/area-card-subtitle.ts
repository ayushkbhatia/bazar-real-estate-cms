/**
 * The line under each /areas card: an editor's wording, the live count.
 *
 * The client wanted to change the words of "10 Properties for Sale", not the
 * number, which has to follow the listings (client, Oct 2026). A subtitle
 * written as plain text froze the figure at whatever was typed. So the
 * subtitle carries `{count}` where the number goes, the page fills it with the
 * area's live listing count, and a save without it is refused. Blank keeps the
 * catalogue's line, which also handles Arabic plurals.
 */
import type { ValidationIssue } from "./index";
import { arKey } from "./twins";
import type { StoredSection } from "./types";

export const AREA_CARD_COUNT_TOKEN = "{count}";

/** The tokens the areas page fills: only the count. */
export const AREAS_PAGE_TOKENS = [AREA_CARD_COUNT_TOKEN] as const;

/**
 * The card's line from an editor's subtitle. Null when there is nothing to
 * draw from it (blank, or a count to fill and none known), so the caller
 * falls back to the catalogue line.
 */
export function areaCardSubtitle(
  subtitle: string | null | undefined,
  count: number | undefined,
): string | null {
  const text = subtitle?.trim();
  if (!text) return null;
  if (!text.includes(AREA_CARD_COUNT_TOKEN)) return text;
  if (count === undefined) return null;
  return text.split(AREA_CARD_COUNT_TOKEN).join(count.toLocaleString("en-US"));
}

/** Every card subtitle, English or Arabic, written without `{count}`. */
export function areaCardSubtitleIssues(sections: StoredSection[]): ValidationIssue[] {
  const cards = sections.find((s) => s.key === "area_cards")?.values.cards;
  if (!Array.isArray(cards)) return [];
  const issues: ValidationIssue[] = [];
  cards.forEach((card, i) => {
    if (!card || typeof card !== "object") return;
    const values = card as Record<string, unknown>;
    for (const [key, suffix] of [
      ["subtitle", ""],
      [arKey("subtitle"), " (Arabic)"],
    ] as const) {
      const v = values[key];
      if (typeof v !== "string" || !v.trim() || v.includes(AREA_CARD_COUNT_TOKEN)) continue;
      const name = typeof values.name === "string" && values.name ? values.name : `Card ${i + 1}`;
      issues.push({
        section: "Abu Dhabi Locations",
        field: `${name} · Subtitle${suffix}`,
        message: `Put ${AREA_CARD_COUNT_TOKEN} where the number goes — “${AREA_CARD_COUNT_TOKEN} homes for sale” — so the card keeps the live count. Leave it blank for the standard line.`,
      });
    }
  });
  return issues;
}
