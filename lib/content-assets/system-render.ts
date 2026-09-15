import { emailShell } from "@/lib/email-templates";
import type { EmailBrand } from "./email-brand";
import {
  bodyAsHtml,
  renderEmailBodyHtml,
  renderEmailBodyText,
  type EmailContext,
} from "./email-html";
import { renderTokens } from "./tokens";

export type RenderedEmail = { subject: string; text: string; html: string };

export type SystemEmailCopy = {
  subject: string;
  body: string;
  /**
   * How `body` is stored. Rows written in the rich-text editor are `html`;
   * the four seeded by 0117, and anything saved before rich text, are `text`.
   * Both render through the same pipeline — plain text is converted to
   * paragraphs first.
   */
  format: "text" | "html";
};

/**
 * Editor copy → a sendable email.
 *
 * The body is the WHOLE message: greeting, prose, sign-off. Only the brand
 * header and footer are added. This differs from the hand-written outreach
 * assets in 0062, which are the middle of a message that staffReplyTemplate
 * wraps — a system email has no advisor to sign it, so it carries its own
 * closing.
 *
 * The subject is plain text: a subject line cannot hold a panel, so a block
 * token there renders as nothing (the editor does not offer one).
 */
export function renderSystemEmail(
  copy: SystemEmailCopy,
  ctx: EmailContext,
  brand: EmailBrand,
): RenderedEmail {
  const html = bodyAsHtml(copy.body, copy.format);
  const text = renderEmailBodyText(html, ctx);
  return {
    subject: renderTokens(copy.subject, ctx.values)
      .replace(/\s+/g, " ")
      .trim(),
    text: text ? `${text}\n` : "",
    html: emailShell(renderEmailBodyHtml(html, ctx, brand), brand),
  };
}
