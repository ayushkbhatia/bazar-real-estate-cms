/**
 * System emails — the transactional mail the client can rewrite.
 *
 * Four emails fire without a human in the loop: the enquiry acknowledgement,
 * the valuation acknowledgement, the viewing confirmation and the newsletter
 * welcome. Each has a built-in version in lib/email-templates.ts and a row in
 * `content_assets` carrying the matching `system_key` (migration 0117).
 *
 * THE RULE, in one line: a PUBLISHED system row replaces the built-in email;
 * anything else — draft, missing, unreadable — and the built-in one sends.
 *
 * That ordering is the whole safety argument. Migration 0061 kept
 * transactional mail in code because "a half-saved edit would break a flow
 * silently"; here a half-saved edit is a draft, and a draft sends nothing.
 * The code template is never dead: it is what the fallback falls back to.
 *
 * This module is pure — registry plus rendering — so it can be tested without
 * a database. The read lives in lib/content-assets/system-resolve.ts.
 */

import {
  emailShell,
  proseEmailHtml,
} from "@/lib/email-templates";
import {
  renderTokens,
  type TokenContext,
  type TokenName,
} from "./tokens";

export const SYSTEM_ASSET_KEYS = [
  "enquiry_auto_reply",
  "valuation_request_ack",
  "viewing_confirmation",
  "newsletter_welcome",
] as const;
export type SystemAssetKey = (typeof SYSTEM_ASSET_KEYS)[number];

export type SystemAssetDef = {
  key: SystemAssetKey;
  /** Matches the seeded row in migration 0117. */
  slug: string;
  label: string;
  /** One line in the editor: what actually fires this email. */
  trigger: string;
  /**
   * Every token this send path fills — the complete list, not an addition to
   * the shared set. A newsletter welcome knows no property reference, and
   * offering one would only produce a fallback in a sent email.
   */
  tokens: readonly TokenName[];
};

export const SYSTEM_ASSETS: Record<SystemAssetKey, SystemAssetDef> = {
  enquiry_auto_reply: {
    key: "enquiry_auto_reply",
    slug: "system-enquiry-auto-reply",
    label: "Enquiry acknowledgement",
    trigger:
      "Sent to the lead the moment any enquiry form is submitted, and by the auto-reply cron for anything the form path missed.",
    tokens: [
      "lead_first_name",
      "lead_name",
      "property_reference",
      "property_title",
      "enquiry_message",
      "site_url",
    ],
  },
  valuation_request_ack: {
    key: "valuation_request_ack",
    slug: "system-valuation-acknowledgement",
    label: "Valuation acknowledgement",
    trigger:
      "Sent to the owner the moment they complete /tools/valuation. The refined figure is a separate email an advisor sends by hand.",
    tokens: [
      "lead_first_name",
      "lead_name",
      "valuation_property",
      "valuation_range",
      "valuation_midpoint",
      "site_url",
    ],
  },
  viewing_confirmation: {
    key: "viewing_confirmation",
    slug: "system-viewing-confirmation",
    label: "Viewing confirmation",
    trigger:
      "Sent to the lead when an advisor books a viewing from an enquiry. The booking is tentative until the building confirms access.",
    tokens: [
      "lead_first_name",
      "lead_name",
      "property_reference",
      "property_title",
      "viewing_time",
      "viewing_location",
      "viewing_duration",
      "advisor_name",
      "site_url",
    ],
  },
  newsletter_welcome: {
    key: "newsletter_welcome",
    slug: "system-newsletter-welcome",
    label: "Newsletter welcome",
    trigger:
      "Sent once a subscriber clicks the confirmation link — not when they first type their address.",
    tokens: ["unsubscribe_url", "site_url"],
  },
};

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

export type RenderedEmail = { subject: string; text: string; html: string };

/**
 * Editor copy → a sendable email.
 *
 * The body is the WHOLE message: greeting, prose, sign-off. Only the Bazar
 * header and footer are added. This differs from the hand-written assets in
 * 0062, which are the middle of a message that staffReplyTemplate wraps — a
 * system email has no advisor to sign it, so it carries its own closing.
 */
export function renderSystemEmail(
  copy: { subject: string; body: string },
  ctx: TokenContext,
): RenderedEmail {
  const text = renderTokens(copy.body, ctx).trim();
  return {
    subject: renderTokens(copy.subject, ctx).trim(),
    text: `${text}\n`,
    html: emailShell(proseEmailHtml(text)),
  };
}
