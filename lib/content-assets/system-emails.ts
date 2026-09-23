import "server-only";

import {
  adminEnquiryUrl,
  bulkReassignDigestTemplate,
  healthDigestTemplate,
  healthLinesBlock,
  emailSiteUrl,
  enquiryEscalationTemplate,
  enquiryReceivedTemplate,
  formAnswersBlock,
  formResponsesUrl,
  formatAedShort,
  formSubmissionTemplate,
  listingReferencesBlock,
  permitExpiryWarningTemplate,
  staffInvitationTemplate,
  staffPasswordResetTemplate,
  staffReplyTemplate,
  valuationCodeTemplate,
  valuationNurtureDay30Template,
  valuationNurtureDay7Template,
  valuationRangePanel,
  valuationReceivedTemplate,
  valuationReportPanel,
  valuationReportRequestedTemplate,
  valuationReportTemplate,
} from "@/lib/email-templates";
import {
  newsletterConfirmTemplate,
  newsletterWelcomeTemplate,
} from "@/lib/newsletter-templates";
import type { EmailBrand } from "./email-brand";
import type { EmailContext } from "./email-html";
import { getFormDef } from "@/lib/forms/registry";
import { FORM_REPLY_SAMPLE, FORM_REPLY_SAMPLE_AR } from "./form-replies";
import {
  readEmailBrand,
  readFormReply,
  resolvePublishedCopy,
  resolveSystemEmail,
} from "./system-resolve";
import { SYSTEM_ASSETS, type SystemAssetKey } from "./system";
import type { EmailLocale } from "./tokens";
import {
  renderSystemEmail,
  type RenderedEmail,
  type SystemEmailCopy,
} from "./system-render";

/**
 * Every email the site sends, bound.
 *
 * Each binding pairs three things for one email:
 *
 *   context  — the send path's arguments → the values its tokens take
 *   builtin  — the code template that sends when nothing is published
 *   sample   — a realistic set of arguments, for the admin preview
 *
 * The preview in /admin/content-assets renders the sample through the SAME
 * context and builtin the send path uses. That is the guarantee the gallery
 * rests on: what an admin sees is not a mock-up of the email, it is the email,
 * addressed to a made-up lead.
 *
 * Call sites changed by one line: they build the same arguments they always
 * did and await the result. Adding an email means a key in ./system.ts, a
 * row in a migration, and a binding here.
 */

type Binding<O> = {
  /** `locale` reaches the context only so its PANELS are drawn in it. */
  context: (opts: O, locale?: EmailLocale) => EmailContext;
  builtin: (opts: O, brand: EmailBrand) => RenderedEmail;
  sample: O;
};

function bind<O>(b: Binding<O>): Binding<O> {
  return b;
}

/** "Amira Haddad" → "Amira". Blank stays blank so the token falls back. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

type EnquiryOpts = {
  name: string;
  message: string;
  propertyReference: string | null;
  propertyTitle: string | null;
};

/**
 * The one token whose VALUE is prose rather than data: `{{property_line}}` is
 * built here as "For <reference> · <title>", so the word in front of the
 * reference has a language even though the reference does not. Unlocalised, an
 * Arabic acknowledgement opened with an English "For" above an Arabic
 * paragraph. The reference and the title themselves are never translated.
 */
function propertyLine(
  reference: string | null,
  title: string | null,
  locale: EmailLocale,
): string | null {
  if (!reference) return null;
  const lead = locale === "ar" ? "بخصوص" : "For";
  return `${lead} ${reference}${title ? ` · ${title}` : ""}`;
}

function enquiryContext(
  opts: EnquiryOpts,
  locale: EmailLocale = "en",
): EmailContext {
  return {
    values: {
      lead_first_name: firstName(opts.name),
      lead_name: opts.name,
      property_reference: opts.propertyReference,
      property_title: opts.propertyTitle,
      property_line: propertyLine(
        opts.propertyReference,
        opts.propertyTitle,
        locale,
      ),
      enquiry_message: opts.message,
      site_url: emailSiteUrl(),
    },
  };
}

type ValuationAckOpts = {
  name: string;
  estimateLowAed: number;
  estimateMidAed: number;
  estimateHighAed: number;
  addressLine: string | null;
  buildingName: string | null;
};

type ValuationReportOpts = Parameters<typeof valuationReportTemplate>[0];
type NurtureDay7Opts = Parameters<typeof valuationNurtureDay7Template>[0];
type NurtureDay30Opts = Parameters<typeof valuationNurtureDay30Template>[0];
type InvitationOpts = Parameters<typeof staffInvitationTemplate>[0];
type ResetOpts = Parameters<typeof staffPasswordResetTemplate>[0];
type EscalationOpts = Parameters<typeof enquiryEscalationTemplate>[0];
type PermitOpts = Parameters<typeof permitExpiryWarningTemplate>[0];
type DigestOpts = Parameters<typeof bulkReassignDigestTemplate>[0];
type HealthDigestOpts = Parameters<typeof healthDigestTemplate>[0];
type FormOpts = Parameters<typeof formSubmissionTemplate>[0];

const site = () => emailSiteUrl();

const SAMPLE_ENQUIRY: EnquiryOpts = {
  name: "Amira Haddad",
  message:
    "Is the 3-bed still available for a September move? We'd like to view it this week if possible.",
  propertyReference: "BAZ-AD-04891",
  propertyTitle: "3-bed on Al Reem Island",
};

const BINDINGS = {
  enquiry_auto_reply: bind<EnquiryOpts>({
    context: enquiryContext,
    builtin: (o, brand) => enquiryReceivedTemplate(o, brand),
    sample: SAMPLE_ENQUIRY,
  }),
  mortgage_enquiry_ack: bind<EnquiryOpts>({
    context: enquiryContext,
    builtin: (o, brand) => enquiryReceivedTemplate(o, brand),
    sample: {
      name: "Amira Haddad",
      message:
        "Mortgage pre-approval request.\nProperty price: AED 2,400,000\nDeposit: AED 480,000 (20%)\nTerm: 25 years at 4.49%\nEstimated monthly: AED 10,670",
      propertyReference: null,
      propertyTitle: null,
    },
  }),
  valuation_request_ack: bind<ValuationAckOpts>({
    context: (o, locale = "en") => ({
      values: {
        lead_first_name: firstName(o.name),
        lead_name: o.name,
        valuation_property:
          [o.buildingName, o.addressLine].filter(Boolean).join(" · ") || null,
        valuation_range: `${formatAedShort(o.estimateLowAed)} – ${formatAedShort(o.estimateHighAed)}`,
        valuation_midpoint: formatAedShort(o.estimateMidAed),
        site_url: site(),
      },
      blocks: {
        valuation_range_panel: valuationRangePanel(
          {
            lowAed: o.estimateLowAed,
            midAed: o.estimateMidAed,
            highAed: o.estimateHighAed,
          },
          locale,
        ),
      },
    }),
    builtin: (o, brand) => valuationReceivedTemplate(o, brand),
    sample: {
      name: "Amira Haddad",
      estimateLowAed: 2_100_000,
      estimateMidAed: 2_350_000,
      estimateHighAed: 2_600_000,
      addressLine: "Al Reem Island",
      buildingName: "Marina Heights",
    },
  }),
  valuation_code: bind<{ code: string }>({
    context: (o) => ({
      values: { verification_code: o.code, site_url: site() },
    }),
    builtin: (o, brand) => valuationCodeTemplate(o, brand),
    sample: { code: "482913" },
  }),
  valuation_report_requested: bind<Record<string, never>>({
    context: () => ({
      values: { contact_url: `${site()}/contact`, site_url: site() },
    }),
    builtin: (_o, brand) => valuationReportRequestedTemplate(brand),
    sample: {},
  }),
  valuation_report: bind<ValuationReportOpts>({
    context: (o, locale = "en") => ({
      values: {
        lead_first_name: firstName(o.name),
        lead_name: o.name,
        valuation_property:
          [o.buildingName, o.addressLine].filter(Boolean).join(" · ") || null,
        valuation_final: formatAedShort(o.finalEstimateAed),
        valuation_initial_range:
          o.rangeLowAed != null && o.rangeHighAed != null
            ? `${formatAedShort(o.rangeLowAed)}–${formatAedShort(o.rangeHighAed)}`
            : null,
        advisor_notes: o.advisorNotes,
        advisor_name: o.advisorName,
        contact_url: `${site()}/contact`,
        site_url: site(),
      },
      blocks: { valuation_report_panel: valuationReportPanel(o, locale) },
    }),
    builtin: (o, brand) => valuationReportTemplate(o, brand),
    sample: {
      name: "Amira Haddad",
      finalEstimateAed: 2_450_000,
      rangeLowAed: 2_100_000,
      rangeHighAed: 2_600_000,
      advisorName: "Khalid Al Zaabi",
      advisorNotes:
        "Two recent sales on the same floor closed at AED 2.4M and AED 2.5M. Your sea-facing balcony supports the upper half of the range.",
      addressLine: "Al Reem Island",
      buildingName: "Marina Heights",
    },
  }),
  valuation_nurture_day7: bind<NurtureDay7Opts>({
    context: (o) => ({
      values: {
        lead_first_name: firstName(o.name),
        lead_name: o.name,
        valuation_midpoint: o.estimateMid ? formatAedShort(o.estimateMid) : null,
        contact_url: `${site()}/contact`,
        site_url: site(),
      },
    }),
    builtin: (o, brand) => valuationNurtureDay7Template(o, brand),
    sample: { name: "Amira Haddad", valuationId: "sample", estimateMid: 2_450_000 },
  }),
  valuation_nurture_day30: bind<NurtureDay30Opts>({
    context: (o) => ({
      values: {
        lead_first_name: firstName(o.name),
        lead_name: o.name,
        insights_url: `${site()}/insights`,
        contact_url: `${site()}/contact`,
        site_url: site(),
      },
    }),
    builtin: (o, brand) => valuationNurtureDay30Template(o, brand),
    sample: { name: "Amira Haddad", valuationId: "sample" },
  }),
  newsletter_confirmation: bind<{ email: string; confirmUrl: string }>({
    context: (o) => ({
      values: { confirm_url: o.confirmUrl, site_url: site() },
    }),
    builtin: (o, brand) => newsletterConfirmTemplate(o, brand),
    sample: {
      email: "amira@example.com",
      confirmUrl: `${site()}/newsletter/confirm/sample-token`,
    },
  }),
  newsletter_welcome: bind<{ unsubscribeUrl: string }>({
    context: (o) => ({
      values: { unsubscribe_url: o.unsubscribeUrl, site_url: site() },
    }),
    builtin: (o, brand) => newsletterWelcomeTemplate(o, brand),
    sample: { unsubscribeUrl: `${site()}/newsletter/unsubscribe/sample-token` },
  }),
  staff_invitation: bind<InvitationOpts>({
    context: (o) => ({
      values: {
        staff_name: o.inviteeName,
        sender_name: o.inviterName,
        staff_role: o.role,
        password_url: o.acceptUrl,
        link_valid_days: String(o.expiryDays ?? 14),
        site_url: site(),
      },
    }),
    builtin: (o, brand) => staffInvitationTemplate(o, brand),
    sample: {
      inviteeName: "Layla",
      inviterName: "Omar Farouk",
      acceptUrl: `${site()}/staff-invite?token=sample-token`,
      role: "editor",
      expiryDays: 14,
    },
  }),
  staff_password_reset: bind<ResetOpts>({
    context: (o) => ({
      values: {
        staff_name: o.staffName,
        sender_name: o.senderName,
        password_url: o.resetUrl,
        link_valid_days: String(o.expiryDays ?? 14),
        site_url: site(),
      },
    }),
    builtin: (o, brand) => staffPasswordResetTemplate(o, brand),
    sample: {
      staffName: "Layla",
      resetUrl: `${site()}/staff-invite?token=sample-token`,
      senderName: "Omar Farouk",
      expiryDays: 14,
    },
  }),
  enquiry_escalation: bind<EscalationOpts>({
    context: (o) => ({
      values: {
        staff_name: o.managerName,
        lead_name: o.leadName,
        property_reference: o.propertyReference,
        property_line: o.propertyReference
          ? `Property: ${o.propertyReference}`
          : null,
        minutes_waiting: String(o.minutesElapsed),
        enquiry_url: adminEnquiryUrl(o.enquiryId),
        site_url: site(),
      },
    }),
    builtin: (o, brand) => enquiryEscalationTemplate(o, brand),
    sample: {
      managerName: "Omar",
      leadName: "Amira Haddad",
      propertyReference: "BAZ-AD-04891",
      enquiryId: "sample",
      minutesElapsed: 64,
    },
  }),
  permit_expiry_warning: bind<PermitOpts>({
    context: (o) => ({
      values: {
        property_reference: o.propertyReference,
        permit_number: o.permitNumber,
        permit_expires_on: o.expiresAt,
        days_to_expiry: String(o.daysToExpiry),
        properties_url: `${site()}/admin/properties?status=published`,
        site_url: site(),
      },
    }),
    builtin: (o, brand) => permitExpiryWarningTemplate(o, brand),
    sample: {
      propertyReference: "BAZ-AD-04891",
      permitNumber: "71220458",
      expiresAt: "2026-10-14",
      daysToExpiry: 29,
    },
  }),
  health_digest: bind<HealthDigestOpts>({
    context: (o, locale = "en") => ({
      values: {
        health_url: `${site()}/admin/settings/health`,
        site_url: site(),
      },
      blocks: {
        health_errors: healthLinesBlock(o.errorLines, locale),
        health_jobs: healthLinesBlock(o.jobLines, locale),
      },
    }),
    builtin: (o, brand) => healthDigestTemplate(o, brand),
    sample: {
      errorCount: 2,
      jobCount: 1,
      errorLines: [
        "cron/salesforce-lead-sync ×3 — REQUIRED_FIELD_MISSING: Email__c",
        "forms/record — connection reset",
      ],
      jobLines: ["permit-expiry — last run 2d ago"],
    },
  }),
  bulk_reassign_digest: bind<DigestOpts>({
    context: (o, locale = "en") => ({
      values: {
        staff_name: o.agentName,
        listings_assigned:
          o.count === 1 ? "1 listing" : `${o.count} listings`,
        queue_url: `${site()}/admin/properties?assigned=me`,
        site_url: site(),
      },
      blocks: { listing_references: listingReferencesBlock(o, locale) },
    }),
    builtin: (o, brand) => bulkReassignDigestTemplate(o, brand),
    sample: {
      agentName: "Khalid",
      count: 3,
      sampleReferences: ["BAZ-AD-04891", "BAZ-AD-04902", "BAZ-AD-04917"],
    },
  }),
  form_submission_notification: bind<FormOpts>({
    context: (o, locale = "en") => ({
      values: {
        form_name: o.formName,
        form_surface: o.surface,
        source_path: o.sourcePath,
        enquiry_url: o.enquiryId ? adminEnquiryUrl(o.enquiryId) : null,
        responses_url: formResponsesUrl(o.formKey),
        site_url: site(),
      },
      blocks: { form_answers: formAnswersBlock(o.answers, locale) },
    }),
    builtin: (o, brand) => formSubmissionTemplate(o, brand),
    sample: {
      formName: "Mortgage pre-approval",
      surface: "Mortgage calculator",
      formKey: "mortgage_preapproval",
      answers: [
        ["Your name", "Amira Haddad"],
        ["Email", "amira@example.com"],
        ["Mobile", "+971 50 123 4567"],
        ["Property price", "AED 2,400,000"],
        ["Deposit", "20%"],
      ],
      sourcePath: "/tools/mortgage",
      enquiryId: "sample",
    },
  }),
} satisfies Record<SystemAssetKey, unknown>;

type OptsOf<K extends SystemAssetKey> =
  (typeof BINDINGS)[K] extends Binding<infer O> ? O : never;

/**
 * `locale` is the language the RECIPIENT used, not the server's.
 *
 * A lead who filled in an Arabic form is answered in Arabic when Arabic
 * wording is published, and in English otherwise — the built-in templates are
 * English, and an English email is a better answer than none.
 */
function send<K extends SystemAssetKey>(
  key: K,
  opts: OptsOf<K>,
  locale: EmailLocale = "en",
): Promise<RenderedEmail> {
  const b = BINDINGS[key] as unknown as Binding<OptsOf<K>>;
  return resolveSystemEmail(
    key,
    b.context(opts, locale),
    (brand) => b.builtin(opts, brand),
    locale,
  );
}

// ── The send functions ────────────────────────────────────────────────

/**
 * The email a lead receives for filling in a form.
 *
 * Three answers, in order, and the first that exists wins:
 *
 *   1. the reply an editor assigned to THIS form, if published (0128);
 *   2. the acknowledgement for this kind of lead — the mortgage desk's for a
 *      mortgage lead, the general one otherwise — if published;
 *   3. the built-in template.
 *
 * All three reads go out together: the assignment is the common case only
 * once someone has made one, and a lead should not wait for a chain of
 * round trips to find that out.
 */
export async function enquiryAcknowledgementEmail(
  opts: EnquiryOpts & {
    /** `enquiries.source` — picks which acknowledgement is the fallback. */
    source?: string | null;
    /** The lib/forms registry key, when the lead came through a form. */
    formKey?: string | null;
    /** `enquiries.locale` — the language the lead wrote in. */
    locale?: EmailLocale | string | null;
  },
): Promise<RenderedEmail> {
  const { source, formKey, locale: rawLocale, ...rest } = opts;
  const locale: EmailLocale = rawLocale === "ar" ? "ar" : "en";
  const key: SystemAssetKey =
    source === "mortgage" ? "mortgage_enquiry_ack" : "enquiry_auto_reply";
  const binding = BINDINGS[key] as unknown as Binding<EnquiryOpts>;
  const def = formKey ? getFormDef(formKey) : null;

  const base = binding.context(rest, locale);
  const ctx: EmailContext = {
    ...base,
    values: {
      ...base.values,
      // A reply may serve several forms and still name the one filled in.
      form_name: def?.name ?? null,
      form_surface: def?.surface ?? null,
    },
  };

  const [reply, published, brand] = await Promise.all([
    formKey ? readFormReply(formKey) : null,
    resolvePublishedCopy(key),
    readEmailBrand(),
  ]);

  for (const copy of [reply, published?.copy]) {
    if (!copy) continue;
    const rendered = renderSystemEmail(copy, ctx, brand, locale);
    // An override that renders to nothing is worse than the built-in one.
    if (rendered.subject && rendered.text.trim()) return rendered;
  }
  return binding.builtin(rest, brand);
}

export function valuationAcknowledgementEmail(
  opts: ValuationAckOpts,
  locale: EmailLocale = "en",
): Promise<RenderedEmail> {
  return send("valuation_request_ack", opts, locale);
}

export function valuationCodeEmail(
  opts: { code: string },
  locale: EmailLocale = "en",
): Promise<RenderedEmail> {
  return send("valuation_code", opts, locale);
}

export function valuationReportRequestedEmail(
  locale: EmailLocale = "en",
): Promise<RenderedEmail> {
  return send("valuation_report_requested", {}, locale);
}

export function valuationReportEmail(
  opts: ValuationReportOpts,
  locale: EmailLocale = "en",
): Promise<RenderedEmail> {
  return send("valuation_report", opts, locale);
}

export function valuationNurtureDay7Email(
  opts: NurtureDay7Opts,
  locale: EmailLocale = "en",
): Promise<RenderedEmail> {
  return send("valuation_nurture_day7", opts, locale);
}

export function valuationNurtureDay30Email(
  opts: NurtureDay30Opts,
  locale: EmailLocale = "en",
): Promise<RenderedEmail> {
  return send("valuation_nurture_day30", opts, locale);
}

export function newsletterConfirmationEmail(
  opts: { email: string; confirmUrl: string },
  locale: EmailLocale = "en",
): Promise<RenderedEmail> {
  return send("newsletter_confirmation", opts, locale);
}

export function newsletterWelcomeEmail(
  opts: { unsubscribeUrl: string },
  locale: EmailLocale = "en",
): Promise<RenderedEmail> {
  return send("newsletter_welcome", opts, locale);
}

export function staffInvitationEmail(
  opts: InvitationOpts,
): Promise<RenderedEmail> {
  return send("staff_invitation", opts);
}

export function staffPasswordResetEmail(
  opts: ResetOpts,
): Promise<RenderedEmail> {
  return send("staff_password_reset", opts);
}

export function enquiryEscalationEmail(
  opts: EscalationOpts,
): Promise<RenderedEmail> {
  return send("enquiry_escalation", opts);
}

export function permitExpiryWarningEmail(
  opts: PermitOpts,
): Promise<RenderedEmail> {
  return send("permit_expiry_warning", opts);
}

export function healthDigestEmail(
  opts: HealthDigestOpts,
  locale: EmailLocale = "en",
): Promise<RenderedEmail> {
  return send("health_digest", opts, locale);
}

export function bulkReassignDigestEmail(
  opts: DigestOpts,
): Promise<RenderedEmail> {
  return send("bulk_reassign_digest", opts);
}

export function formSubmissionEmail(opts: FormOpts): Promise<RenderedEmail> {
  return send("form_submission_notification", opts);
}

/**
 * The advisor's reply. Not rewritable — the advisor writes the body — but it
 * wears the email design like everything else.
 */
export async function advisorReplyEmail(
  opts: Parameters<typeof staffReplyTemplate>[0],
): Promise<RenderedEmail> {
  return staffReplyTemplate(opts, await readEmailBrand());
}

// ── Admin previews ────────────────────────────────────────────────────

export type SystemEmailPreview = {
  /** What sends today, addressed to the sample lead. */
  live: RenderedEmail;
  /**
   * Where `live` comes from: this email's own published row, the row of the
   * email it falls back to, or the built-in template.
   */
  liveSource: { kind: "override"; key: SystemAssetKey } | { kind: "builtin" };
  /** The built-in template, whatever is published. */
  builtin: RenderedEmail;
  /** The copy passed in, rendered; null when none was. */
  draft: RenderedEmail | null;
};

/**
 * Render one email the way it would send to the sample lead. `brand`
 * substitutes an unsaved design, for the design page; `draft` renders unsaved
 * copy, for the editor.
 */
export async function previewSystemEmail(
  key: SystemAssetKey,
  opts: {
    draft?: SystemEmailCopy | null;
    brand?: EmailBrand;
    /** The language being edited or looked at. */
    locale?: EmailLocale;
  } = {},
): Promise<SystemEmailPreview> {
  const locale = opts.locale ?? "en";
  const b = BINDINGS[key] as unknown as Binding<unknown>;
  const [published, brand] = await Promise.all([
    resolvePublishedCopy(key),
    opts.brand ?? readEmailBrand(),
  ]);
  const ctx = b.context(b.sample, locale);
  // The built-in templates are English. An Arabic preview of an email nobody
  // has written Arabic for shows that English, which is what would send.
  const builtin = b.builtin(b.sample, brand);
  const override = published
    ? renderSystemEmail(published.copy, ctx, brand, locale)
    : null;
  return {
    live: override ?? builtin,
    liveSource: published
      ? { kind: "override", key: published.from }
      : { kind: "builtin" },
    builtin,
    draft: opts.draft ? renderSystemEmail(opts.draft, ctx, brand, locale) : null,
  };
}

/**
 * Every system email as it sends today, from rows already read. The gallery
 * shows all seventeen at once; resolving each through the database would be
 * thirty-odd queries for one page, so it reads the rows and the design once
 * and renders here.
 */
export function renderGallery(
  published: Partial<Record<SystemAssetKey, SystemEmailCopy>>,
  brand: EmailBrand,
  /** Which language of each email to draw. Arabic falls back per email. */
  locale: EmailLocale = "en",
): Record<
  SystemAssetKey,
  { live: RenderedEmail; liveSource: SystemEmailPreview["liveSource"] }
> {
  const out = {} as Record<
    SystemAssetKey,
    { live: RenderedEmail; liveSource: SystemEmailPreview["liveSource"] }
  >;
  for (const key of Object.keys(BINDINGS) as SystemAssetKey[]) {
    const b = BINDINGS[key] as unknown as Binding<unknown>;
    let from: SystemAssetKey | undefined = key;
    const seen = new Set<SystemAssetKey>();
    let found: { copy: SystemEmailCopy; from: SystemAssetKey } | null = null;
    while (from && !seen.has(from)) {
      seen.add(from);
      const copy = published[from];
      if (copy) {
        found = { copy, from };
        break;
      }
      from = SYSTEM_ASSETS[from].fallsBackTo;
    }
    out[key] = found
      ? {
          live: renderSystemEmail(
            found.copy,
            b.context(b.sample, locale),
            brand,
            locale,
          ),
          liveSource: { kind: "override", key: found.from },
        }
      : { live: b.builtin(b.sample, brand), liveSource: { kind: "builtin" } };
  }
  return out;
}

/**
 * A form reply, rendered against a sample lead from the form it answers.
 *
 * Same context builder the send path uses, so what the editor sees is the
 * email — with that form's name and page in it, when a form is named.
 */
export async function previewFormReply(
  copy: SystemEmailCopy,
  formKey: string | null,
  brand?: EmailBrand,
  locale: EmailLocale = "en",
): Promise<RenderedEmail> {
  const def = formKey ? getFormDef(formKey) : null;
  const sample = locale === "ar" ? FORM_REPLY_SAMPLE_AR : FORM_REPLY_SAMPLE;
  const base = enquiryContext(
    {
      name: sample.name,
      message: sample.message,
      propertyReference: sample.propertyReference,
      propertyTitle: sample.propertyTitle,
    },
    locale,
  );
  const ctx: EmailContext = {
    ...base,
    values: {
      ...base.values,
      form_name: def?.name ?? sample.formName,
      form_surface: def?.surface ?? sample.formSurface,
    },
  };
  return renderSystemEmail(
    copy,
    ctx,
    brand ?? (await readEmailBrand()),
    locale,
  );
}

/** The advisor reply, with sample wording, for the gallery. */
export function previewAdvisorReply(brand: EmailBrand): RenderedEmail {
  return staffReplyTemplate(
    {
      name: "Amira",
      body: "Thanks for your patience. The owner has confirmed the 3-bed is available from 1 September, and I've held Thursday at 4:30 pm for a viewing.\n\nIf that suits, reply and I'll send the calendar invite.",
      staffDisplayName: "Khalid Al Zaabi",
      propertyReference: "BAZ-AD-04891",
    },
    brand,
  );
}

/** A label for where a preview's live version comes from. */
export function liveSourceLabel(
  key: SystemAssetKey,
  source: SystemEmailPreview["liveSource"],
): string {
  if (source.kind === "builtin") return "Bazar's built-in wording";
  if (source.key === key) return "Your published wording";
  return `Published wording of “${SYSTEM_ASSETS[source.key].label}”`;
}
