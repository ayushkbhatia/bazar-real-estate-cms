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
import type { EmailContext } from "@/lib/content-assets/email-html";
import { outOfScopeTokens, renderTokens, unknownTokens, type EmailLocale, type TokenName } from "@/lib/content-assets/tokens";
import type { Database } from "@/db/types";
import { hasPlaceholder } from "./starters";
import { isUsableLink, linkSlots, normaliseDesign, placeholderIn, textSlots } from "./blocks/document";
import { renderDesign } from "./blocks/render";
import type { Design } from "./blocks/types";

export type CampaignStatus = Database["public"]["Enums"]["newsletter_campaign_status"];
export type CampaignRow = Database["public"]["Tables"]["newsletter_campaigns"]["Row"];
export type DeliveryStatus = "queued" | "sending" | "sent" | "failed" | "skipped";

/** Which subscribers a campaign goes to; "none" sends to its custom lists only (0176). */
export const AUDIENCES = ["all", "en", "ar", "none"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  all: "Every confirmed subscriber",
  en: "English subscribers only",
  ar: "Arabic subscribers only",
  none: "No subscribers — custom lists only",
};

/** How many custom lists one campaign may go to. */
export const MAX_CAMPAIGN_LISTS = 20;

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

/** How a newsletter is written: rich text (the Content assets editor) or blocks (lib/newsletter/blocks). */
export const CAMPAIGN_FORMATS = ["rich", "blocks"] as const;
export type CampaignFormat = (typeof CAMPAIGN_FORMATS)[number];

/** What the composer saves. Arabic is optional, and all-or-nothing at send time. */
export const campaignDraftSchema = z.object({
  format: z.enum(CAMPAIGN_FORMATS).default("rich"),
  /** The block design (format "blocks"), normalised on the way in. */
  design: z.unknown().transform((v): Design | null => (v == null ? null : normaliseDesign(v))),
  subject: z.string().max(200, "Keep the subject under 200 characters."),
  preheader: z.string().max(200, "Keep the preview line under 200 characters."),
  body: z.string().max(200_000),
  subject_ar: z.string().max(200, "Keep the subject under 200 characters."),
  preheader_ar: z.string().max(200, "Keep the preview line under 200 characters."),
  body_ar: z.string().max(200_000),
  audience: z.enum(AUDIENCES),
  /** Custom lists it also goes to (newsletter_lists ids). */
  list_ids: z.array(z.string().uuid()).max(MAX_CAMPAIGN_LISTS, `At most ${MAX_CAMPAIGN_LISTS} lists.`).default([]),
});
export type CampaignDraft = z.infer<typeof campaignDraftSchema>;

/** A body with nothing a reader would see: TipTap's empty document is `<p></p>`. */
export function isBlankBody(html: string | null | undefined): boolean {
  if (!html) return true;
  // A picture or a featured block is something a reader sees.
  const text = html
    .replace(/<img\b[^>]*>|<div\b[^>]*data-email-feature[^>]*>/gi, "x")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ");
  return text.trim() === "";
}

type EditionFields = { format?: string | null; subject_ar?: string | null; body_ar?: string | null };

/**
 * True when the Arabic edition is complete enough to send. A rich-text
 * newsletter has one when both the Arabic subject and body are written; a
 * block-built one keeps its Arabic beside the English in each block, so its
 * Arabic subject is what turns the edition on (campaignProblems then insists
 * every text has its Arabic).
 */
export function hasArabicEdition(c: EditionFields): boolean {
  if (c.format === "blocks") return Boolean(c.subject_ar?.trim());
  return Boolean(c.subject_ar?.trim()) && !isBlankBody(c.body_ar);
}

/**
 * What stops a draft from being sent, by field: an empty subject or body, a
 * field the newsletter can't fill, and a half-written Arabic edition (a
 * subject without a body, or the reverse, sends nobody anything sensible).
 */
export function campaignProblems(c: CampaignDraft): Record<string, string> {
  if (c.format === "blocks") return designProblems(c);
  const problems: Record<string, string> = {};
  if (!c.subject.trim()) problems.subject = "Write a subject.";
  if (isBlankBody(c.body)) problems.body = "Write the newsletter.";
  const arSubject = Boolean(c.subject_ar.trim());
  const arBody = !isBlankBody(c.body_ar);
  if (arSubject !== arBody) {
    problems[arSubject ? "body_ar" : "subject_ar"] =
      "Write both the Arabic subject and the Arabic newsletter, or neither — Arabic subscribers get the English while it's blank.";
  }
  for (const field of ["body", "body_ar", "preheader", "preheader_ar"] as const) {
    if (!problems[field] && hasPlaceholder(c[field])) {
      problems[field] = "Replace the text in [brackets] the starter layout left for you.";
    }
  }
  if (c.audience === "none" && c.list_ids.length === 0) {
    problems.audience = "Pick who receives it: subscribers, a custom list, or both.";
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

/**
 * What stops a block-built newsletter from being sent. Problems are keyed like
 * the rich-text ones (`subject`, `body`, `body_ar`…) so the composer shows
 * them in the same places.
 */
function designProblems(c: CampaignDraft): Record<string, string> {
  const problems: Record<string, string> = {};
  const design = c.design;
  if (!c.subject.trim()) problems.subject = "Write a subject.";
  if (!design || design.blocks.length === 0) {
    problems.body = "Add at least one block.";
    return problems;
  }
  const slots = textSlots(design);
  const arabic = Boolean(c.subject_ar.trim());
  const placeholder = slots.find((s) => placeholderIn(s.en) || (arabic && placeholderIn(s.ar)));
  if (placeholder) problems.body = `Replace the text in [brackets] the template left for you (${placeholder.blockLabel} › ${placeholder.label}).`;
  const badLink = linkSlots(design).find((l) => !isUsableLink(l.value));
  if (badLink && !problems.body) {
    problems.body = `${badLink.blockLabel} › ${badLink.label} isn't a link an email can follow. Use https://…, a page on the site (/contact), mailto: or tel:.`;
  }
  if (arabic) {
    const missing = slots.filter((s) => !s.ar);
    if (missing.length) {
      const named = missing.slice(0, 3).map((s) => `${s.blockLabel} › ${s.label}`).join("; ");
      problems.body_ar = `${missing.length} text${missing.length === 1 ? " has" : "s have"} no Arabic yet: ${named}${missing.length > 3 ? "…" : ""}. Write them, translate from English, or clear the Arabic subject to send English only.`;
    }
  }
  if (c.audience === "none" && c.list_ids.length === 0) {
    problems.audience = "Pick who receives it: subscribers, a custom list, or both.";
  }
  if (c.audience === "ar" && !arabic) {
    problems.audience = "Arabic subscribers only, but there's no Arabic edition: they would get the English.";
  }
  const everything = [c.subject, c.subject_ar, c.preheader, c.preheader_ar, ...slots.flatMap((s) => [s.en, s.ar]), ...linkSlots(design).map((l) => l.value)].join("\n");
  const bad = [...unknownTokens(everything), ...outOfScopeTokens(everything, NEWSLETTER_TOKENS)];
  if (bad.length && !problems.body) problems.body = `${bad.map((t) => `{{${t}}}`).join(", ")} can't be filled in a newsletter.`;
  return problems;
}

const FOOTER = {
  en: '<p>You’re receiving this because you subscribed to Bazar’s newsletter. <a href="{{unsubscribe_url}}">Unsubscribe</a> at any time.</p>',
  ar: '<p>تصلك هذه الرسالة لأنك اشتركت في النشرة الإخبارية من بازار. يمكنك <a href="{{unsubscribe_url}}">إلغاء الاشتراك</a> في أي وقت.</p>',
} as const;

/** The footer a custom list's contact gets: they didn't sign up on the site, so it doesn't say they did. */
const LIST_FOOTER = {
  en: '<p>You’re receiving this because you’re on Bazar Real Estate’s mailing list. <a href="{{unsubscribe_url}}">Unsubscribe</a> and you won’t hear from us again.</p>',
  ar: '<p>تصلك هذه الرسالة لأنك مدرج في القائمة البريدية لبازار العقارية. <a href="{{unsubscribe_url}}">ألغِ الاشتراك</a> ولن تصلك رسائلنا بعد الآن.</p>',
} as const;

/** Who an email is for: a subscriber (signed up on the site) or a contact on a custom list. */
export type RecipientKind = "subscriber" | "list";

function footerFor(kind: RecipientKind | undefined) {
  return kind === "list" ? LIST_FOOTER : FOOTER;
}

/**
 * The Arabic edition's links, from the English's: a path on this site goes to
 * its `/ar` page, so an Arabic reader who follows a link stays in Arabic.
 * Absolute addresses, tokens and paths already under `/ar` (or not pages at
 * all — `/api`, `/_next`) are left alone. Featured blocks need nothing: they
 * build their links per reader.
 */
export function toArabicLinks(html: string): string {
  return html.replace(/\b(href|data-href)="(\/(?!\/)[^"]*)"/g, (match, attr: string, path: string) =>
    /^\/(ar(\/|$|[?#])|api\/|_next\/)/.test(path) ? match : `${attr}="/ar${path === "/" ? "" : path}"`,
  );
}

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

/** The edition a reader who wants `want` receives: Arabic only when it is complete. */
export function editionLocale(c: EditionFields, want: EmailLocale): EmailLocale {
  return want === "ar" && hasArabicEdition(c) ? "ar" : "en";
}

/**
 * The newsletter as one recipient gets it, in `want` (Arabic when the Arabic
 * edition is complete, English otherwise).
 *
 * `features` draws the featured blocks for the edition being sent — the
 * caller looks the records up (lib/newsletter/features.ts, server-only) for
 * that language. Without it the blocks are left out, which is right for
 * nothing but a test of the text.
 */
export function renderNewsletter(
  c: Pick<CampaignDraft, "subject" | "preheader" | "body" | "subject_ar" | "preheader_ar" | "body_ar"> & {
    format?: CampaignFormat | string | null;
    design?: Design | unknown;
  },
  opts: {
    brand: EmailBrand;
    locale: EmailLocale;
    unsubscribeUrl: string;
    features?: (edition: EmailLocale) => EmailContext["features"];
    /** A custom list's contact gets the list's footer; a subscriber, the subscription's. */
    recipient?: RecipientKind;
  },
): RenderedEmail & { locale: EmailLocale } {
  const locale = editionLocale(c, opts.locale);
  const preheader = (locale === "ar" ? (c.preheader_ar ?? "") : c.preheader).trim();
  const rendered = c.format === "blocks" ? renderBlocksNewsletter(c, locale, opts) : renderSystemEmail(
    {
      subject: c.subject,
      body: c.body + footerFor(opts.recipient).en,
      subjectAr: locale === "ar" ? c.subject_ar : null,
      bodyAr: locale === "ar" ? c.body_ar + footerFor(opts.recipient).ar : null,
      format: "html",
    },
    { values: newsletterTokenValues(opts.unsubscribeUrl, locale), features: opts.features?.(locale) },
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

/** The block-built edition: the design drawn whole, the unsubscribe footer under it. */
function renderBlocksNewsletter(
  c: { subject: string; subject_ar: string | null | undefined; design?: unknown },
  locale: EmailLocale,
  opts: {
    brand: EmailBrand;
    unsubscribeUrl: string;
    features?: (edition: EmailLocale) => EmailContext["features"];
    recipient?: RecipientKind;
  },
): RenderedEmail {
  const values = newsletterTokenValues(opts.unsubscribeUrl, locale);
  const subject = renderTokens(locale === "ar" ? (c.subject_ar ?? "") : c.subject, { ...values }, locale)
    .replace(/\s+/g, " ")
    .trim();
  const footerHtml = footerFor(opts.recipient)[locale].replace("{{unsubscribe_url}}", escapeHtml(opts.unsubscribeUrl)).replace(/^<p>|<\/p>$/g, "");
  const footerText = `${footerHtml.replace(/<[^>]+>/g, "")}\n${opts.unsubscribeUrl}`;
  const drawn = renderDesign(c.design, {
    locale,
    brand: opts.brand,
    siteUrl: emailSiteUrl(),
    values,
    subject,
    features: opts.features?.(locale),
    footer: { html: footerHtml, text: footerText },
  });
  return { subject, html: drawn.html, text: drawn.text };
}
