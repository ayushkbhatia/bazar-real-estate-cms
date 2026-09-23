/**
 * Plain HTML + text email templates. Kept dependency-free for now;
 * if we add @react-email later they become components.
 *
 * Every template takes an optional `brand` last. It is the email design an
 * editor set at /admin/content-assets/design — logo, colours, footer — and it
 * defaults to the look these emails had before that page existed, so a caller
 * that passes nothing sends exactly what it always did. The send path passes
 * the stored design through lib/content-assets/system-emails.ts; nothing
 * outside that module should need to.
 */

import { env } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import {
  DEFAULT_EMAIL_BRAND,
  type EmailBrand,
} from "@/lib/content-assets/email-brand";
import type { EmailLocale } from "@/lib/content-assets/tokens";
import { isolateForLocale } from "@/lib/i18n/bidi";

type Rendered = { subject: string; text: string; html: string };

function siteUrl(): string {
  return (
    env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae"
  ).replace(/\/+$/, "");
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

/** The logo's address, rebuilt from its storage key when it has one. */
export function emailLogoUrl(brand: EmailBrand): string | null {
  if (brand.logoMediaKey) {
    const url = mediaPublicUrl(brand.logoMediaKey);
    if (url) return url;
  }
  return brand.logoUrl || null;
}

/**
 * The brand's own words in the language being sent.
 *
 * Only the words: the logo, the colours and the widths are the same email in
 * both languages, and a client who wants a different mark in Arabic has a
 * bigger question than this field answers.
 */
export function brandCopy(
  brand: EmailBrand,
  locale: EmailLocale,
): { wordmark: string; tagline: string; footerText: string; footerLinkLabel: string } {
  const ar = locale === "ar";
  return {
    wordmark: (ar && brand.wordmarkAr) || brand.wordmark,
    tagline: (ar && brand.taglineAr) || brand.tagline,
    footerText: (ar && brand.footerTextAr) || brand.footerText,
    footerLinkLabel: (ar && brand.footerLinkLabelAr) || brand.footerLinkLabel,
  };
}

/**
 * Arabic inboxes are the one place a webfont cannot be relied on: Gmail and
 * Outlook both ignore @font-face, so the stack has to name faces that are
 * already on the machine. Tahoma is the one Windows has had since XP.
 */
const AR_FONT =
  "'IBM Plex Sans Arabic','Noto Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif";
const EN_FONT =
  "'Geist',ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif";

function header(brand: EmailBrand, locale: EmailLocale = "en"): string {
  const copy = brandCopy(brand, locale);
  // "left" means the side the text starts on, which is the right in Arabic.
  const align =
    brand.headerAlign === "center" ? "center" : locale === "ar" ? "right" : "left";
  const logo = brand.headerStyle === "logo" ? emailLogoUrl(brand) : null;
  if (logo) {
    const margin =
      align === "center" ? "0 auto" : locale === "ar" ? "0 0 0 auto" : "0";
    return `<div style="margin-bottom:28px;text-align:${align}"><img src="${escape(logo)}" alt="${escape(brand.logoAlt)}" width="${brand.logoWidth}" style="display:block;margin:${margin};width:${brand.logoWidth}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none"></div>`;
  }
  // The serif italic wordmark is a Latin typographic device; an Arabic
  // wordmark is set in the body face at a larger size instead.
  const wordmarkFont =
    locale === "ar"
      ? `font-family:${AR_FONT};font-size:24px;font-weight:600`
      : "font-family:Georgia,serif;font-style:italic;font-size:22px;letter-spacing:-0.01em";
  return `<div style="${wordmarkFont};margin-bottom:24px;color:${brand.textColor};text-align:${align}">${escape(copy.wordmark)}${
    copy.tagline
      ? ` <span style="font-family:${locale === "ar" ? AR_FONT : "'Geist',sans-serif"};font-style:normal;font-size:12px;letter-spacing:0.05em;color:${brand.mutedColor}">${escape(copy.tagline)}</span>`
      : ""
  }</div>`;
}

function footer(brand: EmailBrand, locale: EmailLocale = "en"): string {
  const copy = brandCopy(brand, locale);
  const lines = copy.footerText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(escape);
  const href = brand.footerLinkUrl || siteUrl();
  const link = copy.footerLinkLabel
    ? `<a href="${escape(href)}" style="color:${brand.mutedColor}">${escape(copy.footerLinkLabel)}</a>`
    : "";
  const parts = [...lines, link].filter(Boolean).join("<br>");
  return `<div style="margin-top:32px;padding-top:24px;border-top:1px solid #E5E5DF;font-size:12px;color:${brand.mutedColor};line-height:1.5">
        ${parts}
      </div>`;
}

/**
 * The wrapper every email arrives in.
 *
 * `locale` decides three things and nothing else: the direction, the font
 * stack, and which half of the brand's copy is used. Colours, widths and the
 * logo are one design in both languages.
 *
 * `dir` is set on <html> AND on the table: Outlook.com strips the attribute
 * from the document, and a right-to-left email that renders left-to-right is
 * not a cosmetic failure — the punctuation lands on the wrong end of every
 * line.
 */
function shell(
  bodyHtml: string,
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
  locale: EmailLocale = "en",
): string {
  const rtl = locale === "ar";
  const dir = rtl ? "rtl" : "ltr";
  return `<!doctype html><html dir="${dir}" lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body dir="${dir}" style="margin:0;padding:0;background:${brand.backgroundColor};color:${brand.textColor};font-family:${rtl ? AR_FONT : EN_FONT};font-size:15px;line-height:${rtl ? "1.75" : "1.55"};direction:${dir};text-align:${rtl ? "right" : "left"}">
  <table role="presentation" dir="${dir}" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:540px;margin:0 auto;padding:24px;direction:${dir};text-align:${rtl ? "right" : "left"}">
    <tr><td>
      ${header(brand, locale)}
      ${bodyHtml}
      ${footer(brand, locale)}
    </td></tr>
  </table>
</body></html>`;
}

/**
 * A primary call to action. `fill` overrides the brand colour for the one
 * email whose button is a warning rather than an invitation.
 */
function button(
  href: string,
  label: string,
  brand: EmailBrand,
  fill?: string,
): string {
  return `<a href="${escape(href)}" style="display:inline-block;padding:10px 16px;background:${fill ?? brand.buttonColor};color:${fill ? "#fff" : brand.buttonTextColor};text-decoration:none;border-radius:6px;font-size:13px">${escape(label)}</a>`;
}

/**
 * The branded wrapper and its helpers, exported for the system-asset renderer
 * in lib/content-assets/system.ts. An email the client rewrote in
 * /admin/content-assets must arrive looking like the built-in one it
 * replaced — same header, footer and typography — not like a plain note.
 */
export const emailShell = shell;
export const escapeEmailHtml = escape;
export const emailSiteUrl = siteUrl;
export const emailButtonHtml = button;

/**
 * Editor-authored plain text → the body half of a branded email. A blank line
 * starts a new paragraph; a single newline stays a line break, so the
 * indented "Listing: … / Where: …" blocks people write survive.
 */
export function proseEmailHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .map(
      (p) => `<p style="margin:0 0 14px">${escape(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

// ── Panels ────────────────────────────────────────────────────────────
//
// The pieces of an email that are more than prose. Each returns both parts,
// and each is used twice: by the built-in template below, and as a block
// token (`{{valuation_range_panel}}` …) inside a rewritten system email — so
// an editor who changes every word around the valuation figure still sends
// the same figure panel.

export type EmailBlock = { html: string; text: string };

const dirOf = (locale: EmailLocale) => (locale === "ar" ? "rtl" : "ltr");
const startOf = (locale: EmailLocale) => (locale === "ar" ? "right" : "left");

/**
 * The few words the PANELS supply themselves.
 *
 * Everything else inside a panel is data — a figure, a reference, a question
 * the form asked — and data is not translated here. These are the labels the
 * code writes, and an Arabic email that says "Instant range" over an Arabic
 * figure reads as a half-finished translation, which is worse than either
 * language on its own.
 */
function panelWords(locale: EmailLocale) {
  if (locale === "ar") {
    return {
      instantRange: "النطاق الفوري",
      midpoint: "المتوسط",
      refined: "التقييم النهائي",
      initialRange: "النطاق الفوري الأولي",
      initialRangeSentence: (range: string) => `النطاق الفوري الأولي كان ${range}.`,
      references: "المراجع:",
      andMore: (n: number) => `…و${n} أخرى`,
      noAnswers: "(لا إجابات)",
    };
  }
  return {
    instantRange: "Instant range",
    midpoint: "midpoint",
    refined: "Refined valuation",
    initialRange: "Initial instant range",
    initialRangeSentence: (range: string) => `Initial instant range was ${range}.`,
    references: "References:",
    andMore: (n: number) => `…and ${n} more`,
    noAnswers: "(no answers)",
  };
}

export function valuationRangePanel(
  opts: {
    lowAed: number;
    midAed: number;
    highAed: number;
  },
  locale: EmailLocale = "en",
): EmailBlock {
  const range = `${formatAedShort(opts.lowAed)} – ${formatAedShort(opts.highAed)}`;
  const t = panelWords(locale);
  return {
    html: `<div dir="${dirOf(locale)}" style="margin:24px 0;padding:20px 22px;background:#fff;border:1px solid #E5E5DF;border-radius:8px;text-align:${startOf(locale)}">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#99896e">${t.instantRange}</div>
      <div style="font-family:Georgia,serif;font-style:italic;font-size:30px;letter-spacing:-0.02em;color:#1B1A17;margin-top:6px">
        ${escape(formatAedShort(opts.lowAed))} – ${escape(formatAedShort(opts.highAed))}
      </div>
      <div style="font-size:12px;color:#5a5a55;margin-top:6px">${t.midpoint} ${escape(formatAedShort(opts.midAed))}</div>
    </div>`,
    text: `  ${range}\n  (${t.midpoint} ${formatAedShort(opts.midAed)})`,
  };
}

export function valuationReportPanel(
  opts: {
    finalEstimateAed: number;
    rangeLowAed: number | null;
    rangeHighAed: number | null;
  },
  locale: EmailLocale = "en",
): EmailBlock {
  const hasRange = opts.rangeLowAed != null && opts.rangeHighAed != null;
  const t = panelWords(locale);
  return {
    html: `<div dir="${dirOf(locale)}" style="margin:24px 0;padding:24px;background:#1B1A17;border-radius:10px;color:#fff;text-align:${startOf(locale)}">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#b0a48b">${t.refined}</div>
      <div style="font-family:Georgia,serif;font-style:italic;font-size:44px;line-height:1.05;letter-spacing:-0.025em;margin-top:8px">
        ${iso(escape(formatAedShort(opts.finalEstimateAed)), locale)}
      </div>
      ${
        hasRange
          ? `<div style="font-size:12px;color:#b0a48b;margin-top:8px">${t.initialRange} ${iso(`${escape(formatAedShort(opts.rangeLowAed!))}–${escape(formatAedShort(opts.rangeHighAed!))}`, locale)}</div>`
          : ""
      }
    </div>`,
    text:
      `${formatAedShort(opts.finalEstimateAed)}` +
      (hasRange
        ? `\n${t.initialRangeSentence(
            `${formatAedShort(opts.rangeLowAed!)}–${formatAedShort(opts.rangeHighAed!)}`,
          )}`
        : ""),
  };
}

/**
 * A panel's data, isolated when the panel is Arabic.
 *
 * A panel is built as HTML here and dropped into the body whole, so it never
 * passes the token substitution that isolates everything else. Its cells are
 * exactly the values that need it: a phone number, a price, a reference, a
 * visitor's own answer — Latin runs inside an RTL table, where "+971 50 123
 * 4567" arrives as "4567 123 50 971+". English is untouched, by `locale`.
 */
function iso(value: string, locale: EmailLocale): string {
  return isolateForLocale(value, locale);
}

export function listingReferencesBlock(
  opts: {
    count: number;
    sampleReferences: string[];
  },
  locale: EmailLocale = "en",
): EmailBlock {
  const t = panelWords(locale);
  const sample = opts.sampleReferences.slice(0, 8);
  const remainder = Math.max(0, opts.count - sample.length);
  if (sample.length === 0) return { html: "", text: "" };
  return {
    html: `<ul dir="${dirOf(locale)}" style="margin:14px 0;padding-${startOf(locale)}:18px;font-size:13px;color:#32312d">
          ${sample
            .map(
              (r) =>
                `<li style="margin:2px 0"><span style="font-family:monospace">${iso(escape(r), locale)}</span></li>`,
            )
            .join("")}
          ${remainder > 0 ? `<li style="margin:2px 0;color:#99896e">${t.andMore(remainder)}</li>` : ""}
        </ul>`,
    text:
      `${t.references}\n${sample.map((r) => `  · ${iso(r, locale)}`).join("\n")}` +
      (remainder > 0 ? `\n  · ${t.andMore(remainder)}` : ""),
  };
}

export function formAnswersBlock(
  answers: [string, string][],
  locale: EmailLocale = "en",
): EmailBlock {
  const rows = answers.length
    ? answers
    : ([[panelWords(locale).noAnswers, "—"]] as [string, string][]);
  return {
    html: `<table role="presentation" dir="${dirOf(locale)}" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:20px;background:#fff;border:1px solid #E5E5DF;border-radius:6px;text-align:${startOf(locale)}">
      ${rows
        .map(
          ([label, value]) => `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #F0F0EA;font-size:12px;color:#99896e;white-space:nowrap;vertical-align:top">${iso(escape(label), locale)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #F0F0EA;font-size:14px;color:#32312d">${iso(escape(value), locale).replace(/\n/g, "<br>")}</td>
      </tr>`,
        )
        .join("")}
    </table>`,
    text: rows
      .map(([label, value]) => `${iso(label, locale)}: ${iso(value, locale)}`)
      .join("\n"),
  };
}

// ── Templates ─────────────────────────────────────────────────────────

export function enquiryReceivedTemplate(
  opts: {
    name: string;
    message: string;
    propertyReference: string | null;
    propertyTitle: string | null;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const refLine = opts.propertyReference
    ? `For ${opts.propertyReference}${opts.propertyTitle ? ` · ${opts.propertyTitle}` : ""}`
    : "";
  const subject = opts.propertyReference
    ? `We received your brief on ${opts.propertyReference}`
    : "We received your brief";

  const text =
    `Hello ${opts.name},\n\n` +
    `Thank you for getting in touch with Bazar.\n\n` +
    (refLine ? `${refLine}\n\n` : "") +
    `One of our advisors will reach out within two hours during business hours, ` +
    `and by next morning otherwise.\n\n` +
    `Your message:\n` +
    `> ${opts.message.replace(/\n/g, "\n> ")}\n\n` +
    `— Bazar\n${siteUrl()}\n`;

  const html = shell(
    `
    <p>Hello ${escape(opts.name)},</p>
    <p>Thank you for getting in touch with Bazar.</p>
    ${refLine ? `<p style="font-size:13px;color:#5a5a55;margin-top:8px">${escape(refLine)}</p>` : ""}
    <p>One of our advisors will reach out within <strong>two hours during business hours</strong>, and by next morning otherwise.</p>
    <p style="margin-top:20px;padding:12px 16px;background:#fff;border-left:3px solid ${brand.linkColor};font-style:italic;color:#32312d">${escape(opts.message).replace(/\n/g, "<br>")}</p>
  `,
    brand,
  );

  return { subject, text, html };
}

/**
 * Internal notification for a form submission.
 *
 * Goes to the addresses an editor typed into /admin/forms → Settings, on top
 * of whatever lead routing already did. It is a heads-up, not the working
 * copy: the lead itself lives in Enquiries and the full answers in Responses,
 * both linked below. Answers are included in full because the whole reason a
 * form has extra questions is that someone wants to read the answers.
 */
export function formSubmissionTemplate(
  opts: {
    formName: string;
    surface: string;
    formKey: string;
    /** Ordered [label, value] pairs, already resolved for display. */
    answers: [string, string][];
    sourcePath: string | null;
    enquiryId: string | null;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const subject = `New ${opts.formName} submission · ${opts.surface}`;
  const manageUrl = formResponsesUrl(opts.formKey);
  const enquiryUrl = opts.enquiryId ? adminEnquiryUrl(opts.enquiryId) : null;
  const answers = formAnswersBlock(opts.answers);

  const text =
    `${opts.formName} — ${opts.surface}\n` +
    (opts.sourcePath ? `Sent from ${opts.sourcePath}\n` : "") +
    `\n` +
    answers.text +
    `\n\n` +
    (enquiryUrl ? `Open the enquiry: ${enquiryUrl}\n` : "") +
    `All responses: ${manageUrl}\n\n` +
    `— Bazar\n`;

  const html = shell(
    `
    <p style="margin:0 0 4px"><strong>${escape(opts.formName)}</strong></p>
    <p style="margin:0;font-size:13px;color:${brand.mutedColor}">${escape(opts.surface)}${
      opts.sourcePath ? ` · ${escape(opts.sourcePath)}` : ""
    }</p>
    ${answers.html}
    <p style="margin-top:20px;font-size:13px">
      ${enquiryUrl ? `<a href="${enquiryUrl}" style="color:${brand.linkColor}">Open the enquiry</a> · ` : ""}
      <a href="${manageUrl}" style="color:${brand.linkColor}">All responses</a>
    </p>
  `,
    brand,
  );

  return { subject, text, html };
}

export function staffReplyTemplate(
  opts: {
    name: string;
    body: string;
    staffDisplayName: string | null;
    propertyReference: string | null;
    /**
     * Overrides the derived subject. Set when the advisor edited the subject in
     * the composer, or when it came from a content asset — a blank string falls
     * back to the derived one rather than sending an empty subject line.
     */
    subject?: string | null;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const derived = opts.propertyReference
    ? `Re: ${opts.propertyReference}`
    : "From your Bazar advisor";
  const subject =
    opts.subject && opts.subject.trim() !== "" ? opts.subject.trim() : derived;

  const sig = opts.staffDisplayName
    ? `— ${opts.staffDisplayName}, Bazar Real Estate`
    : "— Bazar Real Estate";

  const text = `Hello ${opts.name},\n\n${opts.body}\n\n${sig}\n${siteUrl()}\n`;

  const html = shell(
    `
    <p>Hello ${escape(opts.name)},</p>
    <p style="white-space:pre-line">${escape(opts.body)}</p>
    <p style="margin-top:24px;color:#5a5a55">${escape(sig)}</p>
  `,
    brand,
  );

  return { subject, text, html };
}

export function formatAedShort(n: number): string {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n.toLocaleString()}`;
}

/** Admin deep links. Shared by the templates and their token contexts. */
export function adminEnquiryUrl(enquiryId: string): string {
  return `${siteUrl()}/admin/enquiries/${enquiryId}`;
}
export function formResponsesUrl(formKey: string): string {
  return `${siteUrl()}/admin/forms/${formKey}`;
}

/**
 * Auto-acknowledgement after the owner submits a valuation request.
 * Shows the instant range; the *refined* number lands in a separate email
 * from the advisor (valuationReportTemplate, below) within 24 hours.
 */
export function valuationReceivedTemplate(
  opts: {
    name: string;
    estimateLowAed: number;
    estimateMidAed: number;
    estimateHighAed: number;
    addressLine: string | null;
    buildingName: string | null;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const propertyLine =
    [opts.buildingName, opts.addressLine].filter(Boolean).join(" · ") ||
    "your property";
  const subject = `Your Bazar valuation is in review`;
  const panel = valuationRangePanel({
    lowAed: opts.estimateLowAed,
    midAed: opts.estimateMidAed,
    highAed: opts.estimateHighAed,
  });

  const text =
    `Hello ${opts.name},\n\n` +
    `Thanks for sharing the details on ${propertyLine}.\n\n` +
    `Instant range based on the inputs you provided:\n` +
    `${panel.text}\n\n` +
    `A senior advisor will refine this and send you a final number ` +
    `within 24 hours. There's no obligation — and no listing pressure.\n\n` +
    `— Bazar\n${siteUrl()}\n`;

  const html = shell(
    `
    <p>Hello ${escape(opts.name)},</p>
    <p>Thanks for sharing the details on <strong>${escape(propertyLine)}</strong>.</p>
    ${panel.html}
    <p>A senior advisor will refine this and send you a final number within <strong>24 hours</strong>. There&rsquo;s no obligation &mdash; and no listing pressure.</p>
  `,
    brand,
  );

  return { subject, text, html };
}

/**
 * The one-time code that unlocks the full valuation report on
 * /tools/valuation. The code is the whole point of the email, so it is set
 * large and in a monospace face that does not confuse 0 with O.
 */
export function valuationCodeTemplate(
  opts: { code: string },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const subject = `Your Bazar valuation code: ${opts.code}`;
  const text = `Your one-time code is ${opts.code}. It expires in 10 minutes.\n\n— Bazar Real Estate`;
  const html = shell(
    `
    <p style="font-size:14px">Your one-time code:</p>
    <p style="font-family:'Courier New',monospace;font-size:28px;letter-spacing:6px;color:${brand.textColor};margin:12px 0">${escape(opts.code)}</p>
    <p style="font-size:13px;color:${brand.mutedColor}">Expires in 10 minutes. If you didn't request this, you can ignore it.</p>
  `,
    brand,
  );
  return { subject, text, html };
}

/** Sent once the owner has entered the code: the full report is coming. */
export function valuationReportRequestedTemplate(
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const subject = "Your Bazar valuation report is on the way";
  const text = `Thanks — a Bazar advisor will review the figures and send you the full report within 24 hours.\n\n— Bazar Real Estate`;
  const html = shell(
    `
    <p style="font-size:14px">Thanks for verifying.</p>
    <p style="font-size:14px;line-height:1.6">A Bazar advisor will review your property details, sense-check the instant estimate against the latest comparables, and send you the full advisor-prepared report within 24 hours.</p>
    <p style="font-size:13px;color:${brand.mutedColor}">Questions in the meantime? Reply to this email.</p>
  `,
    brand,
  );
  return { subject, text, html };
}

/**
 * The advisor-reviewed valuation. Sent from /admin/valuations/[id] when
 * the advisor clicks "Send report"; carries the final adjusted number
 * plus an optional advisor note.
 */
export function valuationReportTemplate(
  opts: {
    name: string;
    finalEstimateAed: number;
    rangeLowAed: number | null;
    rangeHighAed: number | null;
    advisorName: string | null;
    advisorNotes: string | null;
    addressLine: string | null;
    buildingName: string | null;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const propertyLine =
    [opts.buildingName, opts.addressLine].filter(Boolean).join(" · ") ||
    "your property";

  const subject = `Your Bazar valuation: ${formatAedShort(opts.finalEstimateAed)}`;

  const rangeLine =
    opts.rangeLowAed != null && opts.rangeHighAed != null
      ? `\nInitial instant range was ${formatAedShort(opts.rangeLowAed)}–${formatAedShort(opts.rangeHighAed)}.`
      : "";

  const sig = opts.advisorName
    ? `— ${opts.advisorName}, Senior Advisor, Bazar Real Estate`
    : "— The Bazar Real Estate advisory team";

  const panel = valuationReportPanel(opts);

  const text =
    `Hello ${opts.name},\n\n` +
    `Here is the refined valuation for ${propertyLine}.\n\n` +
    `${formatAedShort(opts.finalEstimateAed)}\n` +
    `${rangeLine}\n\n` +
    (opts.advisorNotes ? `Notes from your advisor:\n${opts.advisorNotes}\n\n` : "") +
    `If you'd like to discuss the figure or what a listing would look like, reply to this email or book a call at ${siteUrl()}/contact.\n\n` +
    `${sig}\n${siteUrl()}\n`;

  const html = shell(
    `
    <p>Hello ${escape(opts.name)},</p>
    <p>Here is the refined valuation for <strong>${escape(propertyLine)}</strong>.</p>
    ${panel.html}
    ${
      opts.advisorNotes
        ? `<div style="margin:20px 0;padding:16px 18px;background:#fff;border-left:3px solid ${brand.linkColor};color:#32312d;font-style:italic;white-space:pre-line">${escape(opts.advisorNotes)}</div>`
        : ""
    }
    <p>If you&rsquo;d like to discuss the figure or what a listing would look like, just reply to this email or book a call at <a href="${siteUrl()}/contact" style="color:${brand.linkColor}">${siteUrl()}/contact</a>.</p>
    <p style="margin-top:24px;color:#5a5a55">${escape(sig)}</p>
  `,
    brand,
  );

  return { subject, text, html };
}

// ── Deal-room stage change emails (Phase 8 · G8) ──────────────────────

export function enquiryEscalationTemplate(
  opts: {
    managerName: string | null;
    leadName: string;
    propertyReference: string | null;
    enquiryId: string;
    minutesElapsed: number;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const subject = `Escalation · enquiry from ${opts.leadName} unassigned ${opts.minutesElapsed} min`;
  const url = adminEnquiryUrl(opts.enquiryId);
  const greeting = opts.managerName ? `Hi ${opts.managerName}` : "Hi";
  const refLine = opts.propertyReference
    ? `Property: ${opts.propertyReference}.`
    : "";

  const text =
    `${greeting},\n\n` +
    `An enquiry from ${opts.leadName} has been waiting ${opts.minutesElapsed} minutes ` +
    `without an assigned advisor. ${refLine}\n\n` +
    `Open the conversation: ${url}\n\n` +
    `— Bazar lead engine\n`;

  const html = shell(
    `
    <p>${escape(greeting)},</p>
    <p>An enquiry from <strong>${escape(opts.leadName)}</strong> has been waiting <strong>${opts.minutesElapsed} minutes</strong> without an assigned advisor.</p>
    ${opts.propertyReference ? `<p style="font-size:13px;color:#5a5a55">Property: <span style="font-family:monospace">${escape(opts.propertyReference)}</span></p>` : ""}
    <p style="margin-top:22px">${button(url, "Open enquiry", brand, "#B33A2A")}</p>
    <p style="margin-top:18px;font-size:12px;color:${brand.mutedColor}">Bazar lead engine</p>
  `,
    brand,
  );

  return { subject, text, html };
}

/** Nurture email at T+7 days post-valuation. */
export function valuationNurtureDay7Template(
  opts: {
    name: string;
    valuationId: string;
    estimateMid: number | null;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const subject = "How's the valuation landing?";
  const url = `${siteUrl()}/contact`;
  const estLine = opts.estimateMid
    ? `Our advisor estimate landed at ${formatAedShort(opts.estimateMid)}.`
    : "";

  const text =
    `Hi ${opts.name},\n\n` +
    `It's been a week since we sent your Bazar valuation. ${estLine}\n\n` +
    `If you'd like to talk through next steps — listing strategy, ` +
    `targeted off-market introductions, or a re-cut at a different price ` +
    `point — reply to this thread.\n\n` +
    `— Bazar\n${url}\n`;

  const html = shell(
    `
    <p>Hi ${escape(opts.name)},</p>
    <p>It's been a week since we sent your Bazar valuation. ${escape(estLine)}</p>
    <p>If you'd like to talk through next steps — listing strategy, targeted off-market introductions, or a re-cut at a different price point — reply to this thread.</p>
    <p style="margin-top:20px;font-size:13px"><a href="${url}" style="color:${brand.linkColor}">Talk to an advisor →</a></p>
  `,
    brand,
  );

  return { subject, text, html };
}

/** Nurture email at T+30 days post-valuation. */
export function valuationNurtureDay30Template(
  opts: {
    name: string;
    valuationId: string;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const subject = "Market update on your Abu Dhabi unit";
  const url = `${siteUrl()}/insights`;

  const text =
    `Hi ${opts.name},\n\n` +
    `A month on from your valuation — we publish a monthly Abu Dhabi market ` +
    `read at /insights. If your view on selling has shifted, or you'd like ` +
    `a fresh valuation cut, reply here.\n\n` +
    `— Bazar\n${url}\n`;

  const html = shell(
    `
    <p>Hi ${escape(opts.name)},</p>
    <p>A month on from your valuation — we publish a monthly Abu Dhabi market read at <a href="${url}" style="color:${brand.linkColor}">/insights</a>.</p>
    <p>If your view on selling has shifted, or you'd like a fresh valuation cut, reply here.</p>
  `,
    brand,
  );

  return { subject, text, html };
}

/** DLD listing permit expiry warning. To: admin. */
export function permitExpiryWarningTemplate(
  opts: {
    propertyReference: string;
    permitNumber: string;
    expiresAt: string;
    daysToExpiry: number;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const subject = `Permit ${opts.permitNumber} (${opts.propertyReference}) expires in ${opts.daysToExpiry} days`;
  const url = `${siteUrl()}/admin/properties?status=published`;

  const text =
    `Hi,\n\n` +
    `Listing permit ${opts.permitNumber} for ${opts.propertyReference} ` +
    `expires on ${opts.expiresAt} (in ${opts.daysToExpiry} days). The ` +
    `listing will be archived automatically at expiry unless renewed.\n\n` +
    `Properties: ${url}\n\n` +
    `— Bazar compliance\n`;

  const html = shell(
    `
    <p>Hi,</p>
    <p>Listing permit <span style="font-family:monospace">${escape(opts.permitNumber)}</span> for <strong>${escape(opts.propertyReference)}</strong> expires on <strong>${escape(opts.expiresAt)}</strong> (in ${opts.daysToExpiry} days).</p>
    <p>The listing will be archived automatically at expiry unless renewed.</p>
    <p style="margin-top:22px">${button(url, "Open properties", brand)}</p>
  `,
    brand,
  );

  return { subject, text, html };
}

export function staffPasswordResetTemplate(
  opts: {
    staffName: string;
    resetUrl: string;
    /** Who triggered it, so an unexpected email is traceable. */
    senderName: string;
    expiryDays?: number;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const subject = "Set a new password for your Bazar admin account";
  const days = opts.expiryDays ?? 14;

  const text =
    `Hi ${opts.staffName},\n\n` +
    `${opts.senderName} has sent you a link to set a new password for the ` +
    `Bazar admin console.\n\n` +
    `Set your password: ${opts.resetUrl}\n\n` +
    `The link is valid for ${days} days and can be used once. If you didn't ` +
    `expect this, tell an administrator — your current password still works ` +
    `until you set a new one.\n\n— Bazar\n`;

  const html = shell(
    `
    <p>Hi ${escape(opts.staffName)},</p>
    <p><strong>${escape(opts.senderName)}</strong> has sent you a link to set a new password for the Bazar admin console.</p>
    <p style="margin-top:22px">${button(opts.resetUrl, "Set a new password", brand)}</p>
    <p style="margin-top:18px;font-size:12px;color:${brand.mutedColor}">Valid for ${days} days, single use. If you didn't expect this, tell an administrator — your current password keeps working until you set a new one.</p>
  `,
    brand,
  );

  return { subject, text, html };
}

/**
 * Staff invitation email containing the accept link.
 *
 * `expiryDays` is a parameter rather than a literal because the copy claimed 7
 * days while `staff_invitations.expires_at` defaults to 14 — the sender now
 * passes the real window so the two can't drift again.
 */
export function staffInvitationTemplate(
  opts: {
    inviteeName: string;
    inviterName: string;
    acceptUrl: string;
    role: string;
    expiryDays?: number;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const subject = `You're invited to Bazar as ${opts.role}`;
  const days = opts.expiryDays ?? 14;

  const text =
    `Hi ${opts.inviteeName},\n\n` +
    `${opts.inviterName} invited you to Bazar Real Estate's internal ` +
    `console as ${opts.role}.\n\n` +
    `Set your password and activate the account: ${opts.acceptUrl}\n\n` +
    `The link is valid for ${days} days.\n\n— Bazar\n`;

  const html = shell(
    `
    <p>Hi ${escape(opts.inviteeName)},</p>
    <p><strong>${escape(opts.inviterName)}</strong> invited you to Bazar Real Estate's internal console as <strong>${escape(opts.role)}</strong>.</p>
    <p style="margin-top:22px">${button(opts.acceptUrl, "Set your password", brand)}</p>
    <p style="margin-top:18px;font-size:12px;color:${brand.mutedColor}">The link is valid for ${days} days.</p>
  `,
    brand,
  );

  return { subject, text, html };
}

/**
 * Sent to an agent after a bulk reassign puts new listings in their queue.
 * One email per reassign action, summarising the count plus a sample of
 * property references for context.
 */
export function bulkReassignDigestTemplate(
  opts: {
    agentName: string;
    count: number;
    sampleReferences: string[];
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): Rendered {
  const subject =
    opts.count === 1
      ? "You were assigned a Bazar listing"
      : `You were assigned ${opts.count} Bazar listings`;
  const url = `${siteUrl()}/admin/properties?assigned=me`;
  const refs = listingReferencesBlock(opts);

  const text =
    `Hi ${opts.agentName},\n\n` +
    `${opts.count} ${opts.count === 1 ? "listing was" : "listings were"} just assigned to you in the Bazar CMS.\n\n` +
    (refs.text ? `${refs.text}\n\n` : "") +
    `Open your queue: ${url}\n\n— Bazar CMS\n`;

  const html = shell(
    `
    <p>Hi ${escape(opts.agentName)},</p>
    <p><strong>${opts.count} ${opts.count === 1 ? "listing was" : "listings were"}</strong> just assigned to you in the Bazar CMS.</p>
    ${refs.html}
    <p style="margin-top:22px">${button(url, "Open my queue", brand)}</p>
  `,
    brand,
  );

  return { subject, text, html };
}
