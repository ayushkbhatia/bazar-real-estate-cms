import "server-only";

import {
  adminEnquiryUrl,
  bulkReassignDigestTemplate,
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
  viewingConfirmationTemplate,
} from "@/lib/email-templates";
import {
  newsletterConfirmTemplate,
  newsletterWelcomeTemplate,
} from "@/lib/newsletter-templates";
import type { EmailBrand } from "./email-brand";
import type { EmailContext } from "./email-html";
import { getFormDef } from "@/lib/forms/registry";
import { FORM_REPLY_SAMPLE } from "./form-replies";
import {
  readEmailBrand,
  readFormReply,
  resolvePublishedCopy,
  resolveSystemEmail,
} from "./system-resolve";
import { SYSTEM_ASSETS, type SystemAssetKey } from "./system";
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
  context: (opts: O) => EmailContext;
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

function enquiryContext(opts: EnquiryOpts): EmailContext {
  return {
    values: {
      lead_first_name: firstName(opts.name),
      lead_name: opts.name,
      property_reference: opts.propertyReference,
      property_title: opts.propertyTitle,
      property_line: opts.propertyReference
        ? `For ${opts.propertyReference}${opts.propertyTitle ? ` · ${opts.propertyTitle}` : ""}`
        : null,
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
type ViewingOpts = Parameters<typeof viewingConfirmationTemplate>[0] & {
  advisorName: string | null;
};
type NurtureDay7Opts = Parameters<typeof valuationNurtureDay7Template>[0];
type NurtureDay30Opts = Parameters<typeof valuationNurtureDay30Template>[0];
type InvitationOpts = Parameters<typeof staffInvitationTemplate>[0];
type ResetOpts = Parameters<typeof staffPasswordResetTemplate>[0];
type EscalationOpts = Parameters<typeof enquiryEscalationTemplate>[0];
type PermitOpts = Parameters<typeof permitExpiryWarningTemplate>[0];
type DigestOpts = Parameters<typeof bulkReassignDigestTemplate>[0];
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
    context: (o) => ({
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
        valuation_range_panel: valuationRangePanel({
          lowAed: o.estimateLowAed,
          midAed: o.estimateMidAed,
          highAed: o.estimateHighAed,
        }),
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
    context: (o) => ({
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
      blocks: { valuation_report_panel: valuationReportPanel(o) },
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
  viewing_confirmation: bind<ViewingOpts>({
    context: (o) => ({
      values: {
        lead_first_name: firstName(o.name),
        lead_name: o.name,
        property_reference: o.propertyReference,
        property_title: o.propertyTitle,
        viewing_time: o.localTime,
        viewing_location: o.location,
        viewing_duration: `${o.durationMinutes} minutes`,
        advisor_name: o.advisorName,
        site_url: site(),
      },
    }),
    builtin: (o, brand) => viewingConfirmationTemplate(o, brand),
    sample: {
      name: "Amira Haddad",
      localTime: "Thursday 18 September, 4:30 pm",
      durationMinutes: 45,
      location: "Marina Heights lobby, Al Reem Island",
      propertyReference: "BAZ-AD-04891",
      propertyTitle: "3-bed on Al Reem Island",
      advisorName: "Khalid Al Zaabi",
    },
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
  bulk_reassign_digest: bind<DigestOpts>({
    context: (o) => ({
      values: {
        staff_name: o.agentName,
        listings_assigned:
          o.count === 1 ? "1 listing" : `${o.count} listings`,
        queue_url: `${site()}/admin/properties?assigned=me`,
        site_url: site(),
      },
      blocks: { listing_references: listingReferencesBlock(o) },
    }),
    builtin: (o, brand) => bulkReassignDigestTemplate(o, brand),
    sample: {
      agentName: "Khalid",
      count: 3,
      sampleReferences: ["BAZ-AD-04891", "BAZ-AD-04902", "BAZ-AD-04917"],
    },
  }),
  form_submission_notification: bind<FormOpts>({
    context: (o) => ({
      values: {
        form_name: o.formName,
        form_surface: o.surface,
        source_path: o.sourcePath,
        enquiry_url: o.enquiryId ? adminEnquiryUrl(o.enquiryId) : null,
        responses_url: formResponsesUrl(o.formKey),
        site_url: site(),
      },
      blocks: { form_answers: formAnswersBlock(o.answers) },
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

function send<K extends SystemAssetKey>(
  key: K,
  opts: OptsOf<K>,
): Promise<RenderedEmail> {
  const b = BINDINGS[key] as unknown as Binding<OptsOf<K>>;
  return resolveSystemEmail(key, b.context(opts), (brand) =>
    b.builtin(opts, brand),
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
  },
): Promise<RenderedEmail> {
  const { source, formKey, ...rest } = opts;
  const key: SystemAssetKey =
    source === "mortgage" ? "mortgage_enquiry_ack" : "enquiry_auto_reply";
  const binding = BINDINGS[key] as unknown as Binding<EnquiryOpts>;
  const def = formKey ? getFormDef(formKey) : null;

  const base = binding.context(rest);
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
    const rendered = renderSystemEmail(copy, ctx, brand);
    // An override that renders to nothing is worse than the built-in one.
    if (rendered.subject && rendered.text.trim()) return rendered;
  }
  return binding.builtin(rest, brand);
}

export function valuationAcknowledgementEmail(
  opts: ValuationAckOpts,
): Promise<RenderedEmail> {
  return send("valuation_request_ack", opts);
}

export function valuationCodeEmail(opts: { code: string }): Promise<RenderedEmail> {
  return send("valuation_code", opts);
}

export function valuationReportRequestedEmail(): Promise<RenderedEmail> {
  return send("valuation_report_requested", {});
}

export function valuationReportEmail(
  opts: ValuationReportOpts,
): Promise<RenderedEmail> {
  return send("valuation_report", opts);
}

export function valuationNurtureDay7Email(
  opts: NurtureDay7Opts,
): Promise<RenderedEmail> {
  return send("valuation_nurture_day7", opts);
}

export function valuationNurtureDay30Email(
  opts: NurtureDay30Opts,
): Promise<RenderedEmail> {
  return send("valuation_nurture_day30", opts);
}

export function viewingConfirmationEmail(
  opts: ViewingOpts,
): Promise<RenderedEmail> {
  return send("viewing_confirmation", opts);
}

export function newsletterConfirmationEmail(opts: {
  email: string;
  confirmUrl: string;
}): Promise<RenderedEmail> {
  return send("newsletter_confirmation", opts);
}

export function newsletterWelcomeEmail(opts: {
  unsubscribeUrl: string;
}): Promise<RenderedEmail> {
  return send("newsletter_welcome", opts);
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
  opts: { draft?: SystemEmailCopy | null; brand?: EmailBrand } = {},
): Promise<SystemEmailPreview> {
  const b = BINDINGS[key] as unknown as Binding<unknown>;
  const [published, brand] = await Promise.all([
    resolvePublishedCopy(key),
    opts.brand ?? readEmailBrand(),
  ]);
  const ctx = b.context(b.sample);
  const builtin = b.builtin(b.sample, brand);
  const override = published ? renderSystemEmail(published.copy, ctx, brand) : null;
  return {
    live: override ?? builtin,
    liveSource: published
      ? { kind: "override", key: published.from }
      : { kind: "builtin" },
    builtin,
    draft: opts.draft ? renderSystemEmail(opts.draft, ctx, brand) : null,
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
          live: renderSystemEmail(found.copy, b.context(b.sample), brand),
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
): Promise<RenderedEmail> {
  const def = formKey ? getFormDef(formKey) : null;
  const base = enquiryContext({
    name: FORM_REPLY_SAMPLE.name,
    message: FORM_REPLY_SAMPLE.message,
    propertyReference: FORM_REPLY_SAMPLE.propertyReference,
    propertyTitle: FORM_REPLY_SAMPLE.propertyTitle,
  });
  const ctx: EmailContext = {
    ...base,
    values: {
      ...base.values,
      form_name: def?.name ?? FORM_REPLY_SAMPLE.formName,
      form_surface: def?.surface ?? FORM_REPLY_SAMPLE.formSurface,
    },
  };
  return renderSystemEmail(copy, ctx, brand ?? (await readEmailBrand()));
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
