/**
 * System emails — every email the site sends on its own, and which of them
 * the client can rewrite.
 *
 * Seventeen emails fire without an advisor writing them: acknowledgements,
 * confirmations, one-time codes, nurture follow-ups, and the notices the team
 * itself receives. Each has a built-in version in lib/email-templates.ts (or
 * lib/newsletter-templates.ts) and a row in `content_assets` carrying the
 * matching `system_key` (migrations 0117 and 0127).
 *
 * THE RULE, in one line: a PUBLISHED system row replaces the built-in email;
 * anything else — draft, missing, unreadable — and the built-in one sends.
 *
 * That ordering is the whole safety argument. Migration 0061 kept
 * transactional mail in code because "a half-saved edit would break a flow
 * silently"; here a half-saved edit is a draft, and a draft sends nothing.
 * The code template is never dead: it is what the fallback falls back to.
 *
 * This module is the registry only — labels, triggers, token scopes — and
 * imports nothing that renders, so the admin editor can read it in the
 * browser. Rendering lives in ./system-render.ts, the database read in
 * ./system-resolve.ts, and the send-path bindings in ./system-emails.ts.
 */

import type { TokenName } from "./tokens";

export const SYSTEM_ASSET_KEYS = [
  "enquiry_auto_reply",
  "mortgage_enquiry_ack",
  "valuation_request_ack",
  "valuation_code",
  "valuation_report_requested",
  "valuation_report",
  "valuation_nurture_day7",
  "valuation_nurture_day30",
  "newsletter_confirmation",
  "newsletter_welcome",
  "staff_invitation",
  "staff_password_reset",
  "enquiry_escalation",
  "permit_expiry_warning",
  "bulk_reassign_digest",
  "health_digest",
  "form_submission_notification",
] as const;
export type SystemAssetKey = (typeof SYSTEM_ASSET_KEYS)[number];

/** Who reads it. The gallery groups by this. */
export type EmailAudience = "client" | "team";

export type SystemAssetDef = {
  key: SystemAssetKey;
  /** Matches the seeded row in migration 0117 or 0127. */
  slug: string;
  label: string;
  audience: EmailAudience;
  /** One line in the editor: what actually fires this email. */
  trigger: string;
  /** Who it is addressed to, in words. */
  recipient: string;
  /** Where the built-in version lives, for whoever maintains it. */
  builtIn: string;
  /**
   * Every token this send path fills — the complete list, not an addition to
   * the shared set. A newsletter welcome knows no property reference, and
   * offering one would only produce a fallback in a sent email.
   */
  tokens: readonly TokenName[];
  /**
   * Tokens a published version cannot leave out, because the email does not
   * work without them: a confirmation with no confirm link, a code email with
   * no code. Publishing without one is refused, and a published row somehow
   * missing one is ignored at send time in favour of the built-in email.
   */
  required: readonly TokenName[];
  /**
   * When this email has no published version of its own, send this one's
   * instead of a built-in. The mortgage acknowledgement exists to let the
   * mortgage desk say something more specific; until someone writes it, a
   * mortgage lead receives exactly the general acknowledgement they always did.
   */
  fallsBackTo?: SystemAssetKey;
};

export const SYSTEM_ASSETS: Record<SystemAssetKey, SystemAssetDef> = {
  enquiry_auto_reply: {
    key: "enquiry_auto_reply",
    slug: "system-enquiry-auto-reply",
    label: "Enquiry acknowledgement",
    audience: "client",
    trigger:
      "Sent to the lead the moment any enquiry form is submitted — contact, property, brochure, consultation, list-your-property — and by the auto-reply cron for anything the form path missed.",
    recipient: "The lead who submitted the form",
    builtIn: "lib/email-templates.ts · enquiryReceivedTemplate",
    tokens: [
      "lead_first_name",
      "lead_name",
      "property_reference",
      "property_title",
      "property_line",
      "enquiry_message",
      "site_url",
    ],
    required: [],
  },
  mortgage_enquiry_ack: {
    key: "mortgage_enquiry_ack",
    slug: "system-mortgage-enquiry-ack",
    label: "Mortgage enquiry acknowledgement",
    audience: "client",
    trigger:
      "Sent to the lead when they submit the pre-approval form under the mortgage calculator. Until this is published, mortgage leads receive the general enquiry acknowledgement.",
    recipient: "The lead who asked for pre-approval",
    builtIn:
      "None of its own — falls back to the enquiry acknowledgement",
    tokens: [
      "lead_first_name",
      "lead_name",
      "enquiry_message",
      "site_url",
    ],
    required: [],
    fallsBackTo: "enquiry_auto_reply",
  },
  valuation_request_ack: {
    key: "valuation_request_ack",
    slug: "system-valuation-acknowledgement",
    label: "Valuation acknowledgement",
    audience: "client",
    trigger:
      "Sent to the owner the moment they complete /tools/valuation, with the instant range. The refined figure is a separate email an advisor sends.",
    recipient: "The owner who requested the valuation",
    builtIn: "lib/email-templates.ts · valuationReceivedTemplate",
    tokens: [
      "lead_first_name",
      "lead_name",
      "valuation_property",
      "valuation_range",
      "valuation_midpoint",
      "valuation_range_panel",
      "site_url",
    ],
    required: [],
  },
  valuation_code: {
    key: "valuation_code",
    slug: "system-valuation-code",
    label: "Valuation report code",
    audience: "client",
    trigger:
      "Sent when an owner asks for the full valuation report on /tools/valuation. It carries the one-time code that unlocks it, valid for 10 minutes.",
    recipient: "The owner unlocking the report",
    builtIn: "lib/email-templates.ts · valuationCodeTemplate",
    tokens: ["verification_code", "site_url"],
    required: ["verification_code"],
  },
  valuation_report_requested: {
    key: "valuation_report_requested",
    slug: "system-valuation-report-requested",
    label: "Valuation report on its way",
    audience: "client",
    trigger:
      "Sent once the owner enters the code: an advisor will prepare the full report within 24 hours.",
    recipient: "The owner who verified their email",
    builtIn: "lib/email-templates.ts · valuationReportRequestedTemplate",
    tokens: ["contact_url", "site_url"],
    required: [],
  },
  valuation_report: {
    key: "valuation_report",
    slug: "system-valuation-report",
    label: "Refined valuation",
    audience: "client",
    trigger:
      "Sent when an advisor clicks Send report on a valuation in /admin/valuations. Carries the final figure and the advisor's notes.",
    recipient: "The owner whose property was valued",
    builtIn: "lib/email-templates.ts · valuationReportTemplate",
    tokens: [
      "lead_first_name",
      "lead_name",
      "valuation_property",
      "valuation_final",
      "valuation_initial_range",
      "valuation_report_panel",
      "advisor_notes",
      "advisor_name",
      "contact_url",
      "site_url",
    ],
    required: [],
  },
  valuation_nurture_day7: {
    key: "valuation_nurture_day7",
    slug: "system-valuation-nurture-day7",
    label: "Valuation follow-up · day 7",
    audience: "client",
    trigger:
      "Sent by the nurture cron a week after the refined valuation went out.",
    recipient: "The owner who received a valuation",
    builtIn: "lib/email-templates.ts · valuationNurtureDay7Template",
    tokens: [
      "lead_first_name",
      "lead_name",
      "valuation_midpoint",
      "contact_url",
      "site_url",
    ],
    required: [],
  },
  valuation_nurture_day30: {
    key: "valuation_nurture_day30",
    slug: "system-valuation-nurture-day30",
    label: "Valuation follow-up · day 30",
    audience: "client",
    trigger:
      "Sent by the nurture cron a month after the refined valuation went out.",
    recipient: "The owner who received a valuation",
    builtIn: "lib/email-templates.ts · valuationNurtureDay30Template",
    tokens: [
      "lead_first_name",
      "lead_name",
      "insights_url",
      "contact_url",
      "site_url",
    ],
    required: [],
  },
  newsletter_confirmation: {
    key: "newsletter_confirmation",
    slug: "system-newsletter-confirmation",
    label: "Newsletter confirmation",
    audience: "client",
    trigger:
      "Sent when someone types their address into a newsletter signup. Nothing is added to the list until they click the link in it.",
    recipient: "The address that signed up",
    builtIn: "lib/newsletter-templates.ts · newsletterConfirmTemplate",
    tokens: ["confirm_url", "site_url"],
    required: ["confirm_url"],
  },
  newsletter_welcome: {
    key: "newsletter_welcome",
    slug: "system-newsletter-welcome",
    label: "Newsletter welcome",
    audience: "client",
    trigger:
      "Sent once a subscriber clicks the confirmation link — not when they first type their address.",
    recipient: "The newly confirmed subscriber",
    builtIn: "lib/newsletter-templates.ts · newsletterWelcomeTemplate",
    tokens: ["unsubscribe_url", "site_url"],
    required: ["unsubscribe_url"],
  },
  staff_invitation: {
    key: "staff_invitation",
    slug: "system-staff-invitation",
    label: "Team invitation",
    audience: "team",
    trigger:
      "Sent when an administrator invites someone to the admin console from /admin/users.",
    recipient: "The person being invited",
    builtIn: "lib/email-templates.ts · staffInvitationTemplate",
    tokens: [
      "staff_name",
      "sender_name",
      "staff_role",
      "password_url",
      "link_valid_days",
      "site_url",
    ],
    required: ["password_url"],
  },
  staff_password_reset: {
    key: "staff_password_reset",
    slug: "system-staff-password-reset",
    label: "Set a new password",
    audience: "team",
    trigger:
      "Sent from /forgot-password, and when an administrator sends a team member a password link. This is the only sign-in email the site sends.",
    recipient: "The team member resetting their password",
    builtIn: "lib/email-templates.ts · staffPasswordResetTemplate",
    tokens: [
      "staff_name",
      "sender_name",
      "password_url",
      "link_valid_days",
      "site_url",
    ],
    required: ["password_url"],
  },
  enquiry_escalation: {
    key: "enquiry_escalation",
    slug: "system-enquiry-escalation",
    label: "Unassigned enquiry escalation",
    audience: "team",
    trigger:
      "Sent by the escalation cron to every administrator when an enquiry has waited an hour with no advisor assigned.",
    recipient: "Each administrator",
    builtIn: "lib/email-templates.ts · enquiryEscalationTemplate",
    tokens: [
      "staff_name",
      "lead_name",
      "property_reference",
      "property_line",
      "minutes_waiting",
      "enquiry_url",
      "site_url",
    ],
    required: [],
  },
  permit_expiry_warning: {
    key: "permit_expiry_warning",
    slug: "system-permit-expiry-warning",
    label: "Listing permit expiring",
    audience: "team",
    trigger:
      "Sent by the permit-expiry cron when a published listing's permit runs out within 30 days.",
    recipient: "Each administrator",
    builtIn: "lib/email-templates.ts · permitExpiryWarningTemplate",
    tokens: [
      "property_reference",
      "permit_number",
      "permit_expires_on",
      "days_to_expiry",
      "properties_url",
      "site_url",
    ],
    required: [],
  },
  health_digest: {
    key: "health_digest",
    slug: "system-health-digest",
    label: "Daily health digest",
    audience: "team",
    trigger:
      "Sent each morning when something broke in the previous day or a scheduled job has gone late. Silent on a quiet day, so an arrival always means there is something to read.",
    recipient: "Every active admin",
    builtIn: "lib/email-templates.ts · healthDigestTemplate",
    tokens: ["health_errors", "health_jobs", "health_url", "site_url"],
    required: [],
  },
  bulk_reassign_digest: {
    key: "bulk_reassign_digest",
    slug: "system-bulk-reassign-digest",
    label: "Listings assigned to you",
    audience: "team",
    trigger:
      "Sent to an advisor when a bulk reassign in /admin/properties puts listings in their queue.",
    recipient: "The advisor receiving the listings",
    builtIn: "lib/email-templates.ts · bulkReassignDigestTemplate",
    tokens: [
      "staff_name",
      "listings_assigned",
      "listing_references",
      "queue_url",
      "site_url",
    ],
    required: [],
  },
  form_submission_notification: {
    key: "form_submission_notification",
    slug: "system-form-submission-notification",
    label: "New form submission",
    audience: "team",
    trigger:
      "Sent to the addresses on a form's notification list in /admin/forms → Settings, every time that form is submitted.",
    recipient: "Whoever is on that form's notification list",
    builtIn: "lib/email-templates.ts · formSubmissionTemplate",
    tokens: [
      "form_name",
      "form_surface",
      "source_path",
      "form_answers",
      "enquiry_url",
      "responses_url",
      "site_url",
    ],
    required: [],
  },
};

/**
 * Emails the site sends that are not rewritable, and why. Listed in the
 * gallery so the inventory is complete: an admin asking "what does the site
 * send?" should not have to know which of the answers live elsewhere.
 */
export const PREVIEW_ONLY_EMAILS = [
  {
    key: "advisor_reply",
    label: "Advisor reply",
    audience: "client" as EmailAudience,
    trigger:
      "Sent when an advisor replies to a lead from the enquiry composer. The advisor writes the body each time — reusable wording for it lives in the Outreach tab.",
    recipient: "The lead being replied to",
    builtIn: "lib/email-templates.ts · staffReplyTemplate",
    why: "The body is written per message, so only the greeting, signature and design around it are shared.",
  },
] as const;

export type PreviewOnlyEmailKey = (typeof PREVIEW_ONLY_EMAILS)[number]["key"];

/**
 * Emails people reasonably expect a site like this to send, which it does
 * not — stated, so their absence reads as a decision rather than a gap.
 */
export const EMAILS_NOT_SENT = [
  {
    label: "Customer sign-up, sign-in and magic-link emails",
    why: "There are no customer accounts (ADR-0005). Visitors enquire without signing in, and nothing in the site asks Supabase Auth to send an email. The team's only sign-in email is Set a new password, above.",
  },
] as const;

export function isSystemAssetKey(value: string): value is SystemAssetKey {
  return (SYSTEM_ASSET_KEYS as readonly string[]).includes(value);
}

/** Shared lead tokens — what an ordinary, hand-written asset may use. */
const SHARED_TOKEN_NAMES: readonly TokenName[] = [
  "lead_first_name",
  "lead_name",
  "property_reference",
  "property_title",
  "advisor_name",
  "advisor_phone",
  "site_url",
];

/**
 * Which tokens this asset is allowed to use. Drives both the editor's insert
 * strip and the save-time check, so what you can insert and what you can save
 * are the same list by construction.
 */
export function allowedTokensFor(
  systemKey: string | null | undefined,
): readonly TokenName[] {
  if (systemKey && isSystemAssetKey(systemKey))
    return SYSTEM_ASSETS[systemKey].tokens;
  return SHARED_TOKEN_NAMES;
}

/** Required tokens the copy does not contain. */
export function missingRequiredTokens(
  key: SystemAssetKey,
  copy: { subject: string; body: string },
): TokenName[] {
  const text = `${copy.subject}\n${copy.body}`;
  return SYSTEM_ASSETS[key].required.filter(
    (t) => !new RegExp(`\\{\\{\\s*${t}\\s*\\}\\}`, "i").test(text),
  );
}
