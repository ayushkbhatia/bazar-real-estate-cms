/**
 * Plain HTML + text email templates. Kept dependency-free for now;
 * if we add @react-email later they become components.
 */

import { env } from "@/lib/env";

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

function shell(bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#FAFAF6;color:#1B1A17;font-family:'Geist',ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:540px;margin:0 auto;padding:24px">
    <tr><td>
      <div style="font-family:Georgia,serif;font-style:italic;font-size:22px;letter-spacing:-0.01em;margin-bottom:24px;color:#1B1A17">Bazar <span style="font-family:'Geist',sans-serif;font-style:normal;font-size:12px;letter-spacing:0.05em;color:#99896e">· Abu Dhabi</span></div>
      ${bodyHtml}
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #E5E5DF;font-size:12px;color:#99896e;line-height:1.5">
        Bazar Real Estate Brokerage LLC · ORN 28041 · Abu Dhabi, UAE<br>
        <a href="${siteUrl()}" style="color:#99896e">bazar.ae</a>
      </div>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * The branded wrapper and its escaper, exported for the system-asset
 * resolver in lib/content-assets/system.ts. An email the client rewrote in
 * /admin/content-assets must arrive looking like the built-in one it
 * replaced — same header, footer and typography — not like a plain note.
 */
export const emailShell = shell;
export const escapeEmailHtml = escape;
export const emailSiteUrl = siteUrl;

/**
 * Editor-authored copy → the body half of a branded email. A blank line
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

export function enquiryReceivedTemplate(opts: {
  name: string;
  message: string;
  propertyReference: string | null;
  propertyTitle: string | null;
}): { subject: string; text: string; html: string } {
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

  const html = shell(`
    <p>Hello ${escape(opts.name)},</p>
    <p>Thank you for getting in touch with Bazar.</p>
    ${refLine ? `<p style="font-size:13px;color:#5a5a55;margin-top:8px">${escape(refLine)}</p>` : ""}
    <p>One of our advisors will reach out within <strong>two hours during business hours</strong>, and by next morning otherwise.</p>
    <p style="margin-top:20px;padding:12px 16px;background:#fff;border-left:3px solid #005777;font-style:italic;color:#32312d">${escape(opts.message).replace(/\n/g, "<br>")}</p>
  `);

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
export function formSubmissionTemplate(opts: {
  formName: string;
  surface: string;
  formKey: string;
  /** Ordered [label, value] pairs, already resolved for display. */
  answers: [string, string][];
  sourcePath: string | null;
  enquiryId: string | null;
}): { subject: string; text: string; html: string } {
  const subject = `New ${opts.formName} submission · ${opts.surface}`;
  const manageUrl = `${siteUrl()}/admin/forms/${opts.formKey}`;
  const enquiryUrl = opts.enquiryId
    ? `${siteUrl()}/admin/enquiries/${opts.enquiryId}`
    : null;

  const rows = opts.answers.length
    ? opts.answers
    : ([["(no answers)", "—"]] as [string, string][]);

  const text =
    `${opts.formName} — ${opts.surface}
` +
    (opts.sourcePath ? `Sent from ${opts.sourcePath}
` : "") +
    `
` +
    rows.map(([label, value]) => `${label}: ${value}`).join("\n") +
    `

` +
    (enquiryUrl ? `Open the enquiry: ${enquiryUrl}
` : "") +
    `All responses: ${manageUrl}

` +
    `— Bazar
`;

  const html = shell(`
    <p style="margin:0 0 4px"><strong>${escape(opts.formName)}</strong></p>
    <p style="margin:0;font-size:13px;color:#99896e">${escape(opts.surface)}${
      opts.sourcePath ? ` · ${escape(opts.sourcePath)}` : ""
    }</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:20px;background:#fff;border:1px solid #E5E5DF;border-radius:6px">
      ${rows
        .map(
          ([label, value]) => `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #F0F0EA;font-size:12px;color:#99896e;white-space:nowrap;vertical-align:top">${escape(label)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #F0F0EA;font-size:14px;color:#32312d">${escape(value).replace(/\n/g, "<br>")}</td>
      </tr>`,
        )
        .join("")}
    </table>
    <p style="margin-top:20px;font-size:13px">
      ${enquiryUrl ? `<a href="${enquiryUrl}" style="color:#005777">Open the enquiry</a> · ` : ""}
      <a href="${manageUrl}" style="color:#005777">All responses</a>
    </p>
  `);

  return { subject, text, html };
}

export function staffReplyTemplate(opts: {
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
}): { subject: string; text: string; html: string } {
  const derived = opts.propertyReference
    ? `Re: ${opts.propertyReference}`
    : "From your Bazar advisor";
  const subject =
    opts.subject && opts.subject.trim() !== "" ? opts.subject.trim() : derived;

  const sig = opts.staffDisplayName
    ? `— ${opts.staffDisplayName}, Bazar Real Estate`
    : "— Bazar Real Estate";

  const text = `Hello ${opts.name},\n\n${opts.body}\n\n${sig}\n${siteUrl()}\n`;

  const html = shell(`
    <p>Hello ${escape(opts.name)},</p>
    <p style="white-space:pre-line">${escape(opts.body)}</p>
    <p style="margin-top:24px;color:#5a5a55">${escape(sig)}</p>
  `);

  return { subject, text, html };
}

export function formatAedShort(n: number): string {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n.toLocaleString()}`;
}

/**
 * Auto-acknowledgement after the owner submits a valuation request.
 * Shows the instant range; the *refined* number lands in a separate email
 * from the advisor (valuationReportTemplate, below) within 24 hours.
 */
export function valuationReceivedTemplate(opts: {
  name: string;
  estimateLowAed: number;
  estimateMidAed: number;
  estimateHighAed: number;
  addressLine: string | null;
  buildingName: string | null;
}): { subject: string; text: string; html: string } {
  const propertyLine =
    [opts.buildingName, opts.addressLine].filter(Boolean).join(" · ") ||
    "your property";
  const subject = `Your Bazar valuation is in review`;

  const text =
    `Hello ${opts.name},\n\n` +
    `Thanks for sharing the details on ${propertyLine}.\n\n` +
    `Instant range based on the inputs you provided:\n` +
    `  ${formatAedShort(opts.estimateLowAed)} – ${formatAedShort(opts.estimateHighAed)}\n` +
    `  (midpoint ${formatAedShort(opts.estimateMidAed)})\n\n` +
    `A senior advisor will refine this and send you a final number ` +
    `within 24 hours. There's no obligation — and no listing pressure.\n\n` +
    `— Bazar\n${siteUrl()}\n`;

  const html = shell(`
    <p>Hello ${escape(opts.name)},</p>
    <p>Thanks for sharing the details on <strong>${escape(propertyLine)}</strong>.</p>
    <div style="margin:24px 0;padding:20px 22px;background:#fff;border:1px solid #E5E5DF;border-radius:8px">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#99896e">Instant range</div>
      <div style="font-family:Georgia,serif;font-style:italic;font-size:30px;letter-spacing:-0.02em;color:#1B1A17;margin-top:6px">
        ${escape(formatAedShort(opts.estimateLowAed))} – ${escape(formatAedShort(opts.estimateHighAed))}
      </div>
      <div style="font-size:12px;color:#5a5a55;margin-top:6px">midpoint ${escape(formatAedShort(opts.estimateMidAed))}</div>
    </div>
    <p>A senior advisor will refine this and send you a final number within <strong>24 hours</strong>. There&rsquo;s no obligation &mdash; and no listing pressure.</p>
  `);

  return { subject, text, html };
}

/**
 * The advisor-reviewed valuation. Sent from /admin/valuations/[id] when
 * the advisor clicks "Send report"; carries the final adjusted number
 * plus an optional advisor note.
 */
export function valuationReportTemplate(opts: {
  name: string;
  finalEstimateAed: number;
  rangeLowAed: number | null;
  rangeHighAed: number | null;
  advisorName: string | null;
  advisorNotes: string | null;
  addressLine: string | null;
  buildingName: string | null;
}): { subject: string; text: string; html: string } {
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

  const text =
    `Hello ${opts.name},\n\n` +
    `Here is the refined valuation for ${propertyLine}.\n\n` +
    `${formatAedShort(opts.finalEstimateAed)}\n` +
    `${rangeLine}\n\n` +
    (opts.advisorNotes ? `Notes from your advisor:\n${opts.advisorNotes}\n\n` : "") +
    `If you'd like to discuss the figure or what a listing would look like, reply to this email or book a call at ${siteUrl()}/contact.\n\n` +
    `${sig}\n${siteUrl()}\n`;

  const html = shell(`
    <p>Hello ${escape(opts.name)},</p>
    <p>Here is the refined valuation for <strong>${escape(propertyLine)}</strong>.</p>
    <div style="margin:24px 0;padding:24px;background:#1B1A17;border-radius:10px;color:#fff">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#b0a48b">Refined valuation</div>
      <div style="font-family:Georgia,serif;font-style:italic;font-size:44px;line-height:1.05;letter-spacing:-0.025em;margin-top:8px">
        ${escape(formatAedShort(opts.finalEstimateAed))}
      </div>
      ${
        opts.rangeLowAed != null && opts.rangeHighAed != null
          ? `<div style="font-size:12px;color:#b0a48b;margin-top:8px">Initial instant range ${escape(formatAedShort(opts.rangeLowAed))}–${escape(formatAedShort(opts.rangeHighAed))}</div>`
          : ""
      }
    </div>
    ${
      opts.advisorNotes
        ? `<div style="margin:20px 0;padding:16px 18px;background:#fff;border-left:3px solid #005777;color:#32312d;font-style:italic;white-space:pre-line">${escape(opts.advisorNotes)}</div>`
        : ""
    }
    <p>If you&rsquo;d like to discuss the figure or what a listing would look like, just reply to this email or book a call at <a href="${siteUrl()}/contact" style="color:#005777">${siteUrl()}/contact</a>.</p>
    <p style="margin-top:24px;color:#5a5a55">${escape(sig)}</p>
  `);

  return { subject, text, html };
}

// ── Deal-room stage change emails (Phase 8 · G8) ──────────────────────

export function enquiryEscalationTemplate(opts: {
  managerName: string | null;
  leadName: string;
  propertyReference: string | null;
  enquiryId: string;
  minutesElapsed: number;
}): { subject: string; text: string; html: string } {
  const subject = `Escalation · enquiry from ${opts.leadName} unassigned ${opts.minutesElapsed} min`;
  const url = `${siteUrl()}/admin/enquiries/${opts.enquiryId}`;
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

  const html = shell(`
    <p>${escape(greeting)},</p>
    <p>An enquiry from <strong>${escape(opts.leadName)}</strong> has been waiting <strong>${opts.minutesElapsed} minutes</strong> without an assigned advisor.</p>
    ${opts.propertyReference ? `<p style="font-size:13px;color:#5a5a55">Property: <span style="font-family:monospace">${escape(opts.propertyReference)}</span></p>` : ""}
    <p style="margin-top:22px"><a href="${url}" style="display:inline-block;padding:10px 16px;background:#B33A2A;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Open enquiry</a></p>
    <p style="margin-top:18px;font-size:12px;color:#99896e">Bazar lead engine</p>
  `);

  return { subject, text, html };
}

/** Nurture email at T+7 days post-valuation. */
export function valuationNurtureDay7Template(opts: {
  name: string;
  valuationId: string;
  estimateMid: number | null;
}): { subject: string; text: string; html: string } {
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

  const html = shell(`
    <p>Hi ${escape(opts.name)},</p>
    <p>It's been a week since we sent your Bazar valuation. ${escape(estLine)}</p>
    <p>If you'd like to talk through next steps — listing strategy, targeted off-market introductions, or a re-cut at a different price point — reply to this thread.</p>
    <p style="margin-top:20px;font-size:13px"><a href="${url}" style="color:#005777">Talk to an advisor →</a></p>
  `);

  return { subject, text, html };
}

/** Nurture email at T+30 days post-valuation. */
export function valuationNurtureDay30Template(opts: {
  name: string;
  valuationId: string;
}): { subject: string; text: string; html: string } {
  const subject = "Market update on your Abu Dhabi unit";
  const url = `${siteUrl()}/insights`;

  const text =
    `Hi ${opts.name},\n\n` +
    `A month on from your valuation — we publish a monthly Abu Dhabi market ` +
    `read at /insights. If your view on selling has shifted, or you'd like ` +
    `a fresh valuation cut, reply here.\n\n` +
    `— Bazar\n${url}\n`;

  const html = shell(`
    <p>Hi ${escape(opts.name)},</p>
    <p>A month on from your valuation — we publish a monthly Abu Dhabi market read at <a href="${url}" style="color:#005777">/insights</a>.</p>
    <p>If your view on selling has shifted, or you'd like a fresh valuation cut, reply here.</p>
  `);

  return { subject, text, html };
}

/** BRN expiry warning (< 30 days). To: agent + admin. */
export function brnExpiryWarningTemplate(opts: {
  agentName: string;
  brn: string;
  expiresAt: string;
  daysToExpiry: number;
}): { subject: string; text: string; html: string } {
  const subject = `BRN ${opts.brn} expires in ${opts.daysToExpiry} days`;
  const url = `${siteUrl()}/admin/settings/compliance`;

  const text =
    `Hi ${opts.agentName},\n\n` +
    `Your broker registration (BRN ${opts.brn}) expires on ${opts.expiresAt} ` +
    `(in ${opts.daysToExpiry} days).\n\n` +
    `RERA-listed properties cannot be published past expiry. Please ` +
    `initiate renewal via your registration portal and let admin know ` +
    `once the new certificate is uploaded.\n\n` +
    `Compliance: ${url}\n\n` +
    `— Bazar compliance\n`;

  const html = shell(`
    <p>Hi ${escape(opts.agentName)},</p>
    <p>Your broker registration <strong>BRN ${escape(opts.brn)}</strong> expires on <strong>${escape(opts.expiresAt)}</strong> (in ${opts.daysToExpiry} days).</p>
    <p>RERA-listed properties cannot be published past expiry. Please initiate renewal via your registration portal and let admin know once the new certificate is uploaded.</p>
    <p style="margin-top:22px"><a href="${url}" style="display:inline-block;padding:10px 16px;background:#1B1A17;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Open compliance panel</a></p>
  `);

  return { subject, text, html };
}

/** DLD listing permit expiry warning. To: admin. */
export function permitExpiryWarningTemplate(opts: {
  propertyReference: string;
  permitNumber: string;
  expiresAt: string;
  daysToExpiry: number;
}): { subject: string; text: string; html: string } {
  const subject = `Permit ${opts.permitNumber} (${opts.propertyReference}) expires in ${opts.daysToExpiry} days`;
  const url = `${siteUrl()}/admin/properties?status=published`;

  const text =
    `Hi,\n\n` +
    `Listing permit ${opts.permitNumber} for ${opts.propertyReference} ` +
    `expires on ${opts.expiresAt} (in ${opts.daysToExpiry} days). The ` +
    `listing will be archived automatically at expiry unless renewed.\n\n` +
    `Properties: ${url}\n\n` +
    `— Bazar compliance\n`;

  const html = shell(`
    <p>Hi,</p>
    <p>Listing permit <span style="font-family:monospace">${escape(opts.permitNumber)}</span> for <strong>${escape(opts.propertyReference)}</strong> expires on <strong>${escape(opts.expiresAt)}</strong> (in ${opts.daysToExpiry} days).</p>
    <p>The listing will be archived automatically at expiry unless renewed.</p>
    <p style="margin-top:22px"><a href="${url}" style="display:inline-block;padding:10px 16px;background:#1B1A17;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Open properties</a></p>
  `);

  return { subject, text, html };
}

export function staffPasswordResetTemplate(opts: {
  staffName: string;
  resetUrl: string;
  /** Who triggered it, so an unexpected email is traceable. */
  senderName: string;
  expiryDays?: number;
}): { subject: string; text: string; html: string } {
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

  const html = shell(`
    <p>Hi ${escape(opts.staffName)},</p>
    <p><strong>${escape(opts.senderName)}</strong> has sent you a link to set a new password for the Bazar admin console.</p>
    <p style="margin-top:22px"><a href="${opts.resetUrl}" style="display:inline-block;padding:10px 16px;background:#1B1A17;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Set a new password</a></p>
    <p style="margin-top:18px;font-size:12px;color:#99896e">Valid for ${days} days, single use. If you didn't expect this, tell an administrator — your current password keeps working until you set a new one.</p>
  `);

  return { subject, text, html };
}

/**
 * Staff invitation email containing the accept link.
 *
 * `expiryDays` is a parameter rather than a literal because the copy claimed 7
 * days while `staff_invitations.expires_at` defaults to 14 — the sender now
 * passes the real window so the two can't drift again.
 */
export function staffInvitationTemplate(opts: {
  inviteeName: string;
  inviterName: string;
  acceptUrl: string;
  role: string;
  expiryDays?: number;
}): { subject: string; text: string; html: string } {
  const subject = `You're invited to Bazar as ${opts.role}`;
  const days = opts.expiryDays ?? 14;

  const text =
    `Hi ${opts.inviteeName},\n\n` +
    `${opts.inviterName} invited you to Bazar Real Estate's internal ` +
    `console as ${opts.role}.\n\n` +
    `Set your password and activate the account: ${opts.acceptUrl}\n\n` +
    `The link is valid for ${days} days.\n\n— Bazar\n`;

  const html = shell(`
    <p>Hi ${escape(opts.inviteeName)},</p>
    <p><strong>${escape(opts.inviterName)}</strong> invited you to Bazar Real Estate's internal console as <strong>${escape(opts.role)}</strong>.</p>
    <p style="margin-top:22px"><a href="${opts.acceptUrl}" style="display:inline-block;padding:10px 16px;background:#1B1A17;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Set your password</a></p>
    <p style="margin-top:18px;font-size:12px;color:#99896e">The link is valid for ${days} days.</p>
  `);

  return { subject, text, html };
}

/**
 * Sent when an advisor books a viewing from an enquiry.
 *
 * The wording moved here from app/.../enquiries/[id]/_actions-viewing.ts as
 * part of consolidating outbound copy: the action keeps the booking and the
 * calendar invite, this keeps what the lead reads. "Tentative" is load-bearing
 * — the building has not confirmed access at the point this sends.
 */
export function viewingConfirmationTemplate(opts: {
  name: string;
  localTime: string;
  durationMinutes: number;
  location: string | null;
  propertyReference: string | null;
  propertyTitle: string | null;
}): { subject: string; text: string; html: string } {
  const subject = opts.propertyReference
    ? `Tentative viewing · ${opts.propertyReference}`
    : "Tentative viewing booked";

  const listingLine =
    opts.propertyReference && opts.propertyTitle
      ? `${opts.propertyReference} · ${opts.propertyTitle}`
      : opts.propertyReference;

  const text =
    `Hello ${opts.name},\n\n` +
    `We've tentatively scheduled your viewing for ${opts.localTime} (Asia/Dubai).\n\n` +
    (listingLine ? `Listing: ${listingLine}\n` : "") +
    (opts.location ? `Where: ${opts.location}\n` : "") +
    `Duration: ${opts.durationMinutes} minutes\n\n` +
    `If this time doesn't work, simply reply and we'll find another.\n\n` +
    `— Bazar Real Estate\n`;

  const html = shell(`
    <p>Hello ${escape(opts.name)},</p>
    <p>We&rsquo;ve tentatively scheduled your viewing for <strong>${escape(opts.localTime)}</strong> (Asia/Dubai).</p>
    <ul style="padding-left:18px;line-height:1.7">
      ${listingLine ? `<li>Listing: ${escape(listingLine)}</li>` : ""}
      ${opts.location ? `<li>Where: ${escape(opts.location)}</li>` : ""}
      <li>Duration: ${opts.durationMinutes} minutes</li>
    </ul>
    <p>The calendar invite is attached — accept it to add to your calendar.</p>
    <p style="color:#5a5a55">If this time doesn&rsquo;t work, simply reply and we&rsquo;ll find another.</p>
  `);

  return { subject, text, html };
}

/** Email arm of the existing in-app viewing reminder (24h before). */
export function viewingReminderTemplate(opts: {
  name: string;
  propertyReference: string;
  propertyTitle: string;
  whenLocalIso: string;
  agentName: string | null;
}): { subject: string; text: string; html: string } {
  const subject = `Viewing tomorrow · ${opts.propertyReference}`;
  const url = `${siteUrl()}/contact`;

  const text =
    `Hi ${opts.name},\n\n` +
    `Reminder — your viewing for ${opts.propertyReference} ` +
    `(${opts.propertyTitle}) is at ${opts.whenLocalIso}.\n` +
    (opts.agentName ? `Advisor: ${opts.agentName}.\n` : "") +
    `\nReschedule or cancel: ${url}\n\n— Bazar\n`;

  const html = shell(`
    <p>Hi ${escape(opts.name)},</p>
    <p>Reminder — your viewing for <strong>${escape(opts.propertyReference)}</strong> (${escape(opts.propertyTitle)}) is at <strong>${escape(opts.whenLocalIso)}</strong>.</p>
    ${opts.agentName ? `<p style="font-size:13px;color:#5a5a55">Advisor: ${escape(opts.agentName)}</p>` : ""}
    <p style="margin-top:22px"><a href="${url}" style="display:inline-block;padding:10px 16px;background:#1B1A17;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Reschedule or cancel</a></p>
  `);

  return { subject, text, html };
}

/** Newsletter double-opt-in confirmation email. */
/**
 * Sent to an agent after a bulk reassign puts new listings in their queue.
 * One email per reassign action, summarising the count plus a sample of
 * property references for context.
 */
export function bulkReassignDigestTemplate(opts: {
  agentName: string;
  count: number;
  sampleReferences: string[];
}): { subject: string; text: string; html: string } {
  const subject =
    opts.count === 1
      ? "You were assigned a Bazar listing"
      : `You were assigned ${opts.count} Bazar listings`;
  const url = `${siteUrl()}/admin/properties?assigned=me`;

  const sample = opts.sampleReferences.slice(0, 8);
  const remainder = Math.max(0, opts.count - sample.length);

  const text =
    `Hi ${opts.agentName},\n\n` +
    `${opts.count} ${opts.count === 1 ? "listing was" : "listings were"} just assigned to you in the Bazar CMS.\n\n` +
    (sample.length > 0
      ? `References:\n${sample.map((r) => `  · ${r}`).join("\n")}\n` +
        (remainder > 0 ? `  · …and ${remainder} more\n` : "") +
        "\n"
      : "") +
    `Open your queue: ${url}\n\n— Bazar CMS\n`;

  const refsBlock =
    sample.length > 0
      ? `<ul style="margin:14px 0;padding-left:18px;font-size:13px;color:#32312d">
          ${sample
            .map(
              (r) =>
                `<li style="margin:2px 0"><span style="font-family:monospace">${escape(r)}</span></li>`,
            )
            .join("")}
          ${remainder > 0 ? `<li style="margin:2px 0;color:#99896e">…and ${remainder} more</li>` : ""}
        </ul>`
      : "";

  const html = shell(`
    <p>Hi ${escape(opts.agentName)},</p>
    <p><strong>${opts.count} ${opts.count === 1 ? "listing was" : "listings were"}</strong> just assigned to you in the Bazar CMS.</p>
    ${refsBlock}
    <p style="margin-top:22px"><a href="${url}" style="display:inline-block;padding:10px 16px;background:#005777;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Open my queue</a></p>
  `);

  return { subject, text, html };
}

export function newsletterConfirmTemplate(opts: {
  email: string;
  confirmUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = "Confirm your Bazar newsletter subscription";

  const text =
    `Hi,\n\n` +
    `Please confirm your subscription to the Bazar quarterly Abu Dhabi ` +
    `market read.\n\n` +
    `Confirm: ${opts.confirmUrl}\n\n` +
    `If you didn't request this, ignore the email — no action is taken ` +
    `until you click confirm.\n\n— Bazar\n`;

  const html = shell(`
    <p>Hi,</p>
    <p>Please confirm your subscription to the Bazar quarterly Abu Dhabi market read.</p>
    <p style="margin-top:22px"><a href="${opts.confirmUrl}" style="display:inline-block;padding:10px 16px;background:#005777;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Confirm subscription</a></p>
    <p style="margin-top:18px;font-size:12px;color:#99896e">If you didn't request this, ignore the email — no action is taken until you click confirm.</p>
  `);

  return { subject, text, html };
}
