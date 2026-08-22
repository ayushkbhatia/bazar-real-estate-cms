import "server-only";

import {
  emailSiteUrl,
  enquiryReceivedTemplate,
  formatAedShort,
  valuationReceivedTemplate,
  viewingConfirmationTemplate,
} from "@/lib/email-templates";
import { newsletterWelcomeTemplate } from "@/lib/newsletter-templates";
import { resolveSystemEmail } from "./system-resolve";
import type { RenderedEmail } from "./system";

/**
 * The four transactional emails, bound.
 *
 * Each one pairs a token context with the built-in template that sends when
 * no published override exists. Call sites changed by one line: they build
 * the same arguments they always did and await the result.
 *
 * Keeping the four bindings together is the point — it is the list of every
 * email the client can rewrite, and adding a fifth means adding it here, to
 * the registry in ./system.ts, and to the closed key check in migration 0117.
 */

/** "Amira Haddad" → "Amira". Blank stays blank so the token falls back. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function enquiryAcknowledgementEmail(opts: {
  name: string;
  message: string;
  propertyReference: string | null;
  propertyTitle: string | null;
}): Promise<RenderedEmail> {
  return resolveSystemEmail(
    "enquiry_auto_reply",
    {
      lead_first_name: firstName(opts.name),
      lead_name: opts.name,
      property_reference: opts.propertyReference,
      property_title: opts.propertyTitle,
      enquiry_message: opts.message,
      site_url: emailSiteUrl(),
    },
    () => enquiryReceivedTemplate(opts),
  );
}

export function valuationAcknowledgementEmail(opts: {
  name: string;
  estimateLowAed: number;
  estimateMidAed: number;
  estimateHighAed: number;
  addressLine: string | null;
  buildingName: string | null;
}): Promise<RenderedEmail> {
  const property =
    [opts.buildingName, opts.addressLine].filter(Boolean).join(" · ") || null;
  return resolveSystemEmail(
    "valuation_request_ack",
    {
      lead_first_name: firstName(opts.name),
      lead_name: opts.name,
      valuation_property: property,
      valuation_range: `${formatAedShort(opts.estimateLowAed)} – ${formatAedShort(opts.estimateHighAed)}`,
      valuation_midpoint: formatAedShort(opts.estimateMidAed),
      site_url: emailSiteUrl(),
    },
    () => valuationReceivedTemplate(opts),
  );
}

export function viewingConfirmationEmail(opts: {
  name: string;
  localTime: string;
  durationMinutes: number;
  location: string | null;
  propertyReference: string | null;
  propertyTitle: string | null;
  advisorName: string | null;
}): Promise<RenderedEmail> {
  return resolveSystemEmail(
    "viewing_confirmation",
    {
      lead_first_name: firstName(opts.name),
      lead_name: opts.name,
      property_reference: opts.propertyReference,
      property_title: opts.propertyTitle,
      viewing_time: opts.localTime,
      viewing_location: opts.location,
      viewing_duration: `${opts.durationMinutes} minutes`,
      advisor_name: opts.advisorName,
      site_url: emailSiteUrl(),
    },
    () => viewingConfirmationTemplate(opts),
  );
}

export function newsletterWelcomeEmail(opts: {
  unsubscribeUrl: string;
}): Promise<RenderedEmail> {
  return resolveSystemEmail(
    "newsletter_welcome",
    {
      unsubscribe_url: opts.unsubscribeUrl,
      site_url: emailSiteUrl(),
    },
    () => newsletterWelcomeTemplate(opts),
  );
}
