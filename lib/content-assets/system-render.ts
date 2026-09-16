import { emailShell } from "@/lib/email-templates";
import type { EmailBrand } from "./email-brand";
import {
  bodyAsHtml,
  renderEmailBodyHtml,
  renderEmailBodyText,
  type EmailContext,
} from "./email-html";
import { renderTokens, type EmailLocale } from "./tokens";

export type RenderedEmail = { subject: string; text: string; html: string };

export type SystemEmailCopy = {
  subject: string;
  body: string;
  /**
   * The Arabic twin, when the row has one. Both halves or neither: a subject
   * in one language over a body in the other is not an email anybody should
   * receive, so `copyForLocale` treats a half-filled twin as absent.
   */
  subjectAr?: string | null;
  bodyAr?: string | null;
  /**
   * How `body` is stored. Rows written in the rich-text editor are `html`;
   * the four seeded by 0117, and anything saved before rich text, are `text`.
   * Both render through the same pipeline — plain text is converted to
   * paragraphs first.
   */
  format: "text" | "html";
};

/**
 * The half of a row that answers a lead in their own language.
 *
 * English is the floor, not a preference: a lead who wrote in Arabic and has
 * no Arabic wording waiting gets the English email rather than nothing, and
 * the editor is told which of its emails are in that state.
 */
export function copyForLocale(
  copy: SystemEmailCopy,
  locale: EmailLocale,
): { subject: string; body: string; locale: EmailLocale } {
  if (
    locale === "ar" &&
    copy.subjectAr?.trim() &&
    copy.bodyAr?.trim()
  ) {
    return { subject: copy.subjectAr, body: copy.bodyAr, locale: "ar" };
  }
  return { subject: copy.subject, body: copy.body, locale: "en" };
}

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
  /** The language to answer in. Falls back to English inside `copyForLocale`. */
  want: EmailLocale = "en",
): RenderedEmail {
  const chosen = copyForLocale(copy, want);
  const locale = chosen.locale;
  const html = bodyAsHtml(chosen.body, copy.format);
  const text = renderEmailBodyText(html, ctx, locale);
  return {
    subject: renderTokens(chosen.subject, ctx.values, locale)
      .replace(/\s+/g, " ")
      .trim(),
    text: text ? `${text}\n` : "",
    html: emailShell(renderEmailBodyHtml(html, ctx, brand, locale), brand, locale),
  };
}
