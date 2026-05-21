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

export function dsrExportConfirmTemplate(opts: {
  confirmUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = "Confirm your Bazar data export";
  const text =
    `Hello,\n\n` +
    `You (or someone using your email) requested a copy of the personal data Bazar holds about your account.\n\n` +
    `Confirm the request — the link expires in 24 hours:\n${opts.confirmUrl}\n\n` +
    `If you didn't request this, ignore this email and the request will lapse.\n\n` +
    `— Bazar\n${siteUrl()}\n`;
  const html = shell(`
    <p>Hello,</p>
    <p>You (or someone using your email) requested a copy of the personal data Bazar holds about your account.</p>
    <p style="margin:24px 0">
      <a href="${escape(opts.confirmUrl)}" style="display:inline-block;background:#1B1A17;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:500;font-size:14px;letter-spacing:0.01em">Confirm data export</a>
    </p>
    <p style="font-size:13px;color:#5a5a55">The link expires in 24 hours. If you didn't request this, ignore this email and the request will lapse.</p>
    <p style="font-size:13px;color:#5a5a55">If the button doesn't work, paste this URL into your browser:<br><a href="${escape(opts.confirmUrl)}" style="color:#5a5a55;word-break:break-all">${escape(opts.confirmUrl)}</a></p>
  `);
  return { subject, text, html };
}

export function dsrDeleteConfirmTemplate(opts: {
  confirmUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = "Confirm your Bazar account deletion";
  const text =
    `Hello,\n\n` +
    `You requested deletion of your Bazar account. This will:\n` +
    `  • Hard-delete your saved properties and saved searches.\n` +
    `  • Anonymise your enquiries, viewings, and message bodies so the audit trail stays intact.\n` +
    `  • Sign you out and prevent the address from being used to sign in again.\n\n` +
    `Confirm — the link expires in 24 hours and cannot be undone after that:\n${opts.confirmUrl}\n\n` +
    `If you didn't request this, ignore this email and the request will lapse.\n\n` +
    `— Bazar\n${siteUrl()}\n`;
  const html = shell(`
    <p>Hello,</p>
    <p>You requested deletion of your Bazar account. Once confirmed, we will:</p>
    <ul style="font-size:14px;color:#1B1A17;line-height:1.6;padding-left:18px">
      <li>Hard-delete your saved properties and saved searches.</li>
      <li>Anonymise your enquiries, viewings, and message bodies so the audit trail stays intact under UAE AML rules.</li>
      <li>Sign you out and prevent the address from being used to sign in again.</li>
    </ul>
    <p style="margin:24px 0">
      <a href="${escape(opts.confirmUrl)}" style="display:inline-block;background:#1B1A17;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:500;font-size:14px;letter-spacing:0.01em">Confirm account deletion</a>
    </p>
    <p style="font-size:13px;color:#5a5a55">The link expires in 24 hours. <strong>This cannot be undone after that.</strong> If you didn't request this, ignore the email.</p>
    <p style="font-size:13px;color:#5a5a55">If the button doesn't work, paste this URL into your browser:<br><a href="${escape(opts.confirmUrl)}" style="color:#5a5a55;word-break:break-all">${escape(opts.confirmUrl)}</a></p>
  `);
  return { subject, text, html };
}
