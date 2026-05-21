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
      <div style="font-family:Georgia,serif;font-style:italic;font-size:22px;letter-spacing:-0.01em;margin-bottom:24px;color:#1B1A17">Bazar <span style="font-family:'Geist',sans-serif;font-style:normal;font-size:12px;letter-spacing:0.05em;color:#7d8e7e">· Abu Dhabi</span></div>
      ${bodyHtml}
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #E5E5DF;font-size:12px;color:#7d8e7e;line-height:1.5">
        Bazar Real Estate Brokerage LLC · ORN 28041 · Abu Dhabi, UAE<br>
        <a href="${siteUrl()}" style="color:#7d8e7e">bazar.ae</a>
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
    <p style="margin-top:20px;padding:12px 16px;background:#fff;border-left:3px solid #4B5A4C;font-style:italic;color:#32312d">${escape(opts.message).replace(/\n/g, "<br>")}</p>
  `);

  return { subject, text, html };
}

export function staffReplyTemplate(opts: {
  name: string;
  body: string;
  staffDisplayName: string | null;
  propertyReference: string | null;
}): { subject: string; text: string; html: string } {
  const subject = opts.propertyReference
    ? `Re: ${opts.propertyReference}`
    : "From your Bazar advisor";

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
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7d8e7e">Instant range</div>
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
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#a8b2a4">Refined valuation</div>
      <div style="font-family:Georgia,serif;font-style:italic;font-size:44px;line-height:1.05;letter-spacing:-0.025em;margin-top:8px">
        ${escape(formatAedShort(opts.finalEstimateAed))}
      </div>
      ${
        opts.rangeLowAed != null && opts.rangeHighAed != null
          ? `<div style="font-size:12px;color:#a8b2a4;margin-top:8px">Initial instant range ${escape(formatAedShort(opts.rangeLowAed))}–${escape(formatAedShort(opts.rangeHighAed))}</div>`
          : ""
      }
    </div>
    ${
      opts.advisorNotes
        ? `<div style="margin:20px 0;padding:16px 18px;background:#fff;border-left:3px solid #4B5A4C;color:#32312d;font-style:italic;white-space:pre-line">${escape(opts.advisorNotes)}</div>`
        : ""
    }
    <p>If you&rsquo;d like to discuss the figure or what a listing would look like, just reply to this email or book a call at <a href="${siteUrl()}/contact" style="color:#4B5A4C">${siteUrl()}/contact</a>.</p>
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
        ? `<p style="margin-top:18px;font-size:13px"><a href="${dealUrl}" style="color:#4B5A4C">Open the deal file →</a></p>`
        : ""
    }
  `);

  return { subject, text, html };
}
