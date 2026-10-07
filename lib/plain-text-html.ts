/**
 * Plain text to paragraphs. Escaped first, so nothing typed into a CRM field
 * can become markup on a public page; then split on blank lines, with single
 * line breaks kept.
 *
 * Its own module, with no imports, because the Salesforce listing planner is
 * pure and must stay that way; the render-side companion is
 * `descriptionHtml` in `lib/rich-text.ts`.
 */
export function plainTextToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return esc
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
