import { sanitizeArticleHtml } from "@/lib/article-html";
import { plainTextToHtml } from "@/lib/plain-text-html";

const TAG = /<\/?[a-z][a-z0-9]*\b[^>]*>/i;

/**
 * A listing description, ready to inject.
 *
 * Stored as HTML — the CMS editor is Tiptap, and the Salesforce sync turns the
 * CRM's plain text into paragraphs on the way in — except on older rows
 * (seeds, imports), which hold plain text. HTML goes through the same
 * allowlist the article page uses, on render as well as on save, because not
 * every writer goes through the editor's action; plain text becomes
 * paragraphs.
 *
 * Printing the stored HTML as text, which the listing page did, shows the
 * tags themselves to the visitor.
 */
export function descriptionHtml(value: string | null | undefined): string {
  if (!value || !value.trim()) return "";
  return TAG.test(value) ? sanitizeArticleHtml(value) : plainTextToHtml(value.trim());
}
