/**
 * Plain HTML + text email templates. Kept dependency-free for now;
 * if we add @react-email later they become components.
 */

import { env } from "@/lib/env";

function siteUrl(): string {
  return (
    env.NEXT_PUBLIC_SITE_URL ?? "https://bazar-real-estate-cms.vercel.app"
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

function formatAedShort(n: number): string {
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

type StageEmailOpts = {
  recipientName: string;
  /** "buyer" or "agent" — drives the framing. */
  audience: "buyer" | "agent";
  propertyReference: string;
  propertyTitle: string | null;
  /** Which stage we just moved into. */
  stage:
    | "mou"
    | "deposit"
    | "noc_pending"
    | "dld_pending"
    | "transferred";
  dealId: string;
};

function stageCopy(
  stage: StageEmailOpts["stage"],
  audience: StageEmailOpts["audience"],
): { headline: string; body: string; cta?: string } {
  switch (stage) {
    case "mou":
      return audience === "buyer"
        ? {
            headline: "We've opened your deal",
            body:
              "We've drawn up the MoU on this property and are starting the transaction file. " +
              "Please upload your passport and Emirates ID to your document vault — we need them " +
              "before we can move to the deposit stage.",
            cta: "/account/documents",
          }
        : {
            headline: "Deal opened — MoU stage",
            body:
              "The deal file is live. Buyer KYC has been requested; the deposit stage unlocks " +
              "once their passport or Emirates ID is verified.",
            cta: undefined,
          };
    case "deposit":
      return audience === "buyer"
        ? {
            headline: "Deposit stage",
            body:
              "Thanks — the MoU is signed. Next: we'll collect the 10% deposit and request the NOC " +
              "from the developer. Please make sure your Emirates ID and passport are uploaded if " +
              "you haven't already.",
            cta: "/account/documents",
          }
        : {
            headline: "Deal advanced — Deposit stage",
            body:
              "MoU stamped. Deposit collection + NOC request are the next blockers; advance to " +
              "noc_pending once KYC is verified.",
            cta: undefined,
          };
    case "noc_pending":
      return audience === "buyer"
        ? {
            headline: "We've requested the NOC",
            body:
              "We've formally asked the developer for the No-Objection Certificate. It usually " +
              "takes 3–5 working days. Once it lands we'll set the DLD transfer appointment.",
            cta: undefined,
          }
        : {
            headline: "Deal advanced — NOC pending",
            body:
              "NOC requested from the developer. Once verified on the deal file, the DLD stage " +
              "will unlock.",
            cta: undefined,
          };
    case "dld_pending":
      return audience === "buyer"
        ? {
            headline: "DLD transfer is scheduled",
            body:
              "The NOC is in. We've booked your DLD transfer appointment — please make sure your " +
              "original Emirates ID and passport are with you on the day, along with the manager's " +
              "cheque for the balance.",
            cta: undefined,
          }
        : {
            headline: "Deal advanced — DLD pending",
            body:
              "NOC verified, transfer queued at DLD. Confirm the appointment time with the buyer " +
              "and the seller-side advisor.",
            cta: undefined,
          };
    case "transferred":
      return audience === "buyer"
        ? {
            headline: "Title transferred — welcome home",
            body:
              "The property is officially yours. Congratulations. We'll send the final closing " +
              "pack with the title deed and a copy of the signed sale contract shortly.",
            cta: undefined,
          }
        : {
            headline: "Deal closed — Transferred",
            body:
              "Title transferred at DLD. Commission can be recorded on the deal file. " +
              "Move the property to off_market when ready.",
            cta: undefined,
          };
  }
}

export function dealStageChangeTemplate(
  opts: StageEmailOpts,
): { subject: string; text: string; html: string } {
  const copy = stageCopy(opts.stage, opts.audience);
  const refLine = `${opts.propertyReference}${opts.propertyTitle ? ` · ${opts.propertyTitle}` : ""}`;
  const subject =
    opts.audience === "agent"
      ? `[Deal ${opts.propertyReference}] ${copy.headline}`
      : `${copy.headline} · ${opts.propertyReference}`;

  const ctaUrl = copy.cta ? `${siteUrl()}${copy.cta}` : null;
  const dealUrl =
    opts.audience === "agent"
      ? `${siteUrl()}/admin/deals/${opts.dealId}`
      : null;

  const text =
    `Hello ${opts.recipientName},\n\n` +
    `${refLine}\n\n` +
    `${copy.body}\n\n` +
    (ctaUrl ? `Manage your documents: ${ctaUrl}\n\n` : "") +
    (dealUrl ? `Open the deal file: ${dealUrl}\n\n` : "") +
    `— Bazar Real Estate\n${siteUrl()}\n`;

  const html = shell(`
    <p>Hello ${escape(opts.recipientName)},</p>
    <p style="font-size:13px;color:#5a5a55">${escape(refLine)}</p>
    <h2 style="font-family:Georgia,serif;font-style:italic;font-size:26px;letter-spacing:-0.015em;margin:18px 0 4px;color:#1B1A17">${escape(copy.headline)}</h2>
    <p style="margin-top:14px">${escape(copy.body)}</p>
    ${
      ctaUrl
        ? `<p style="margin-top:22px"><a href="${ctaUrl}" style="display:inline-block;padding:10px 16px;background:#1B1A17;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Open document vault</a></p>`
        : ""
    }
    ${
      dealUrl
        ? `<p style="margin-top:18px;font-size:13px"><a href="${dealUrl}" style="color:#005777">Open the deal file →</a></p>`
        : ""
    }
  `);

  return { subject, text, html };
}

// ─────────────────────────────────────────────────────────────────────
// Sprint 10 — workflow + compliance email templates
// ─────────────────────────────────────────────────────────────────────

/** To: manager. Sent when an enquiry sits unassigned > 60 minutes. */
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
  const url = `${siteUrl()}/account/profile`;
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
    <p style="margin-top:20px;font-size:13px"><a href="${url}" style="color:#005777">Open your Bazar account →</a></p>
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

/** KYC approval email to the account holder. */
export function kycApprovedTemplate(opts: {
  name: string;
}): { subject: string; text: string; html: string } {
  const subject = "Your Bazar account is now KYC-verified";
  const url = `${siteUrl()}/account/profile`;

  const text =
    `Hi ${opts.name},\n\n` +
    `Your KYC documents have been reviewed and approved. You can now ` +
    `place offers and engage Bazar advisory services without further ` +
    `verification.\n\n` +
    `Account: ${url}\n\n— Bazar\n`;

  const html = shell(`
    <p>Hi ${escape(opts.name)},</p>
    <p>Your KYC documents have been reviewed and <strong>approved</strong>. You can now place offers and engage Bazar advisory services without further verification.</p>
    <p style="margin-top:22px"><a href="${url}" style="display:inline-block;padding:10px 16px;background:#005777;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Open your account</a></p>
  `);

  return { subject, text, html };
}

/** KYC rejection email with reason. */
export function kycRejectedTemplate(opts: {
  name: string;
  reason: string;
}): { subject: string; text: string; html: string } {
  const subject = "Bazar KYC review — additional information needed";
  const url = `${siteUrl()}/account/documents`;

  const text =
    `Hi ${opts.name},\n\n` +
    `Your KYC review couldn't be completed. Reason: ${opts.reason}.\n\n` +
    `Please upload an updated document at ${url} and we'll re-review ` +
    `within one business day.\n\n— Bazar\n`;

  const html = shell(`
    <p>Hi ${escape(opts.name)},</p>
    <p>Your KYC review couldn't be completed.</p>
    <p style="margin-top:14px;padding:12px 16px;background:#fff;border-left:3px solid #B33A2A;color:#32312d"><strong>Reason:</strong> ${escape(opts.reason)}</p>
    <p>Please upload an updated document and we'll re-review within one business day.</p>
    <p style="margin-top:22px"><a href="${url}" style="display:inline-block;padding:10px 16px;background:#1B1A17;color:#fff;text-decoration:none;border-radius:6px;font-size:13px">Open document vault</a></p>
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

/** Email arm of the existing in-app viewing reminder (24h before). */
export function viewingReminderTemplate(opts: {
  name: string;
  propertyReference: string;
  propertyTitle: string;
  whenLocalIso: string;
  agentName: string | null;
}): { subject: string; text: string; html: string } {
  const subject = `Viewing tomorrow · ${opts.propertyReference}`;
  const url = `${siteUrl()}/account/viewings`;

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
