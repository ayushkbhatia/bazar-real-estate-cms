/**
 * Text shaping for master-page content — the two places a stored plain string
 * has to become something the design expects.
 */

/**
 * Chip lists are stored as one label per line. A list field's sub-fields can
 * only hold scalars, so a nested list isn't expressible in the section model,
 * and a textarea is easier to edit for eight short names than eight rows of
 * inputs would be.
 *
 * Blank lines are dropped and labels trimmed, so trailing newlines and stray
 * indentation from a paste don't render as empty chips.
 */
export function chipLines(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/**
 * The areas hero italicises the final word of its headline. Splitting here
 * keeps the stored field a plain editable string rather than markup — an
 * editor types a sentence and the emphasis follows automatically.
 *
 * A single-word headline is returned entirely as `last`, so the emphasis still
 * lands somewhere rather than the word disappearing.
 */
export function headlineParts(title: string): { lead: string; last: string } {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lead: "", last: "" };
  if (words.length === 1) return { lead: "", last: words[0] };
  return { lead: words.slice(0, -1).join(" "), last: words[words.length - 1] };
}
