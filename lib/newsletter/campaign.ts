/**
 * A newsletter, from the composer's fields to the email one subscriber gets.
 *
 * Shared by the admin preview, "Send me a test" and the sender, so what an
 * editor previews is what goes out. The body is the sanitised HTML the
 * Content assets editor writes (`lib/content-assets/email-html.ts`), rendered
 * through the same pipeline and branded shell as every other site email
 * (`renderSystemEmail`), with two things only a newsletter has: a hidden
 * preview line, and an unsubscribe footer that is always there whatever the
 * body says. See docs/NEWSLETTER.md.
 */

import { z } from "zod";
import { emailSiteUrl } from "@/lib/email-templates";
import type { EmailBrand } from "@/lib/content-assets/email-brand";
import { renderSystemEmail, type RenderedEmail } from "@/lib/content-assets/system-render";
import { outOfScopeTokens, unknownTokens, type EmailLocale, type TokenName } from "@/lib/content-assets/tokens";
import type { Database } from "@/db/types";

export type CampaignStatus = Database["public"]["Enums"]["newsletter_campaign_status"];
export type CampaignRow = Database["public"]["Tables"]["newsletter_campaigns"]["Row"];
export type DeliveryStatus = "queued" | "sending" | "sent" | "failed" | "skipped";

export const AUDIENCES = ["all", "en", "ar"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  all: "Every confirmed subscriber",
  en: "English subscribers only",
  ar: "Arabic subscribers only",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  cancelled: "Cancelled",
};

/** Roles that may write and test a newsletter. */
export const NEWSLETTER_WRITE_ROLES = ["admin", "editor", "marketing"] as const;
/** Roles that may send one to the list, schedule it, or act on a subscriber. */
export const NEWSLETTER_SEND_ROLES = ["admin", "marketing"] as const;

/** The fields a newsletter body and subject may use. */
export const NEWSLETTER_TOKENS: readonly TokenName[] = [
  "site_url",
  "insights_url",
  "contact_url",
  "unsubscribe_url",
];

/** What the composer saves. Arabic is optional, and all-or-nothing at send time. */
export const campaignDraftSchema = z.object({
  subject: z.string().max(200, "Keep the subject under 200 characters."),
  preheader: z.string().max(200, "Keep the preview line under 200 characters."),
  body: z.string().max(200_000),
  subject_ar: z.string().max(200, "Keep the subject under 200 characters."),
  preheader_ar: z.string().max(200, "Keep the preview line under 200 characters."),
  body_ar: z.string().max(200_000),
  audience: z.enum(AUDIENCES),
});
export type CampaignDraft = z.infer<typeof campaignDraftSchema>;

/** A body with nothing a reader would see: TipTap's empty document is `<p></p>`. */
export function isBlankBody(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html.replace(/<img\b[^>]*>/gi, "x").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
  return text.trim() === "";
}

/** True when the Arabic edition is complete enough to send. */
export function hasArabicEdition(c: { subject_ar?: string | null; body_ar?: string | null }): boolean {
  return Boolean(c.subject_ar?.trim()) && !isBlankBody(c.body_ar);
}

/**
 * What stops a draft from being sent, by field: an empty subject or body, a
 * field the newsletter can't fill, and a half-written Arabic edition (a
 * subject without a body, or the reverse, sends nobody anything sensible).
 */
export function campaignProblems(c: CampaignDraft): Record<string, string> {
  const problems: Record<string, string> = {};
  if (!c.subject.trim()) problems.subject = "Write a subject.";
  if (isBlankBody(c.body)) problems.body = "Write the newsletter.";
  const arSubject = Boolean(c.subject_ar.trim());
  const arBody = !isBlankBody(c.body_ar);
  if (arSubject !== arBody) {
    problems[arSubject ? "body_ar" : "subject_ar"] =
      "Write both the Arabic subject and the Arabic newsletter, or neither — Arabic subscribers get the English while it's blank.";
  }
  if (c.audience === "ar" && !arSubject && !arBody) {
    problems.audience = "Arabic subscribers only, but there's no Arabic edition: they would get the English.";
  }
  for (const [field, value] of [
    ["subject", c.subject],
    ["body", c.body],
    ["subject_ar", c.subject_ar],
    ["body_ar", c.body_ar],
    ["preheader", c.preheader],
    ["preheader_ar", c.preheader_ar],
  ] as const) {
    const unknown = unknownTokens(value);
    const outside = outOfScopeTokens(value, NEWSLETTER_TOKENS);
    const bad = [...unknown, ...outside];
    if (bad.length && !problems[field]) {
      problems[field] = `${bad.map((t) => `{{${t}}}`).join(", ")} can't be filled in a newsletter.`;
    }
  }
  return problems;
}

const FOOTER = {
  en: '<p>You’re receiving this because you subscribed to Bazar’s newsletter. <a href="{{unsubscribe_url}}">Unsubscribe</a> at any time.</p>',
  ar: '<p>تصلك هذه الرسالة لأنك اشتركت في النشرة الإخبارية من بازار. يمكنك <a href="{{unsubscribe_url}}">إلغاء الاشتراك</a> في أي وقت.</p>',
} as const;

/** The site links a newsletter's fields fill in, plus this recipient's unsubscribe link. */
export function newsletterTokenValues(unsubscribeUrl: string, locale: EmailLocale) {
  const site = emailSiteUrl();
  const prefix = locale === "ar" ? "/ar" : "";
  return {
    site_url: `${site}${prefix}`,
    insights_url: `${site}${prefix}/insights`,
    contact_url: `${site}${prefix}/contact`,
    unsubscribe_url: unsubscribeUrl,
  };
}

/** The one-click endpoint `List-Unsubscribe-Post` points mail clients at, and the page a person lands on. */
export function unsubscribeLinks(token: string, locale: EmailLocale): { page: string; oneClick: string } {
  const site = emailSiteUrl();
  return {
    page: `${site}${locale === "ar" ? "/ar" : ""}/newsletter/unsubscribe/${token}`,
    oneClick: `${site}/api/newsletter/unsubscribe?token=${token}`,
  };
}

/** The headers mailbox providers expect on bulk mail (RFC 2369, RFC 8058). */
export function unsubscribeHeaders(token: string, locale: EmailLocale): Record<string, string> {
  const links = unsubscribeLinks(token, locale);
  return {
    "List-Unsubscribe": `<${links.oneClick}>, <${links.page}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The newsletter as one recipient gets it, in `want` (Arabic when the Arabic
 * edition is complete, English otherwise).
 */
export function renderNewsletter(
  c: Pick<CampaignDraft, "subject" | "preheader" | "body" | "subject_ar" | "preheader_ar" | "body_ar">,
  opts: { brand: EmailBrand; locale: EmailLocale; unsubscribeUrl: string },
): RenderedEmail & { locale: EmailLocale } {
  const locale: EmailLocale = opts.locale === "ar" && hasArabicEdition(c) ? "ar" : "en";
  const preheader = (locale === "ar" ? (c.preheader_ar ?? "") : c.preheader).trim();
  const rendered = renderSystemEmail(
    {
      subject: c.subject,
      body: c.body + FOOTER.en,
      subjectAr: locale === "ar" ? c.subject_ar : null,
      bodyAr: locale === "ar" ? c.body_ar + FOOTER.ar : null,
      format: "html",
    },
    { values: newsletterTokenValues(opts.unsubscribeUrl, locale) },
    opts.brand,
    locale,
  );
  // The preview line inbox lists show beside the subject: hidden in the body,
  // first thing after <body>, padded so the client doesn't fill the rest of
  // the snippet with the header's text.
  const html = preheader
    ? rendered.html.replace(
        /<body([^>]*)>/i,
        `<body$1><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>`,
      )
    : rendered.html;
  return { ...rendered, html, locale };
}
