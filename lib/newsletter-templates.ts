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

export function newsletterConfirmTemplate(opts: {
  email: string;
  confirmUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = "Confirm your subscription to the Bazar Brief";

  const text =
    `Hello,\n\n` +
    `You're one click away from subscribing to the Bazar Brief — our weekly briefing on the Abu Dhabi market.\n\n` +
    `Confirm your subscription:\n${opts.confirmUrl}\n\n` +
    `If you didn't request this, ignore this email — we won't add you to the list.\n\n` +
    `— Bazar\n${siteUrl()}\n`;

  const html = shell(`
    <p>Hello,</p>
    <p>You're one click away from subscribing to <strong>the Bazar Brief</strong> — our weekly briefing on the Abu Dhabi market.</p>
    <p style="margin:24px 0">
      <a href="${escape(opts.confirmUrl)}" style="display:inline-block;background:#1B1A17;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:500;font-size:14px;letter-spacing:0.01em">Confirm subscription</a>
    </p>
    <p style="font-size:13px;color:#5a5a55">If the button doesn't work, paste this link into your browser:<br><a href="${escape(opts.confirmUrl)}" style="color:#5a5a55;word-break:break-all">${escape(opts.confirmUrl)}</a></p>
    <p style="font-size:13px;color:#5a5a55;margin-top:16px">If you didn't request this, ignore this email — we won't add you to the list.</p>
  `);

  return { subject, text, html };
}

export function newsletterWelcomeTemplate(opts: {
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = "You're in — welcome to the Bazar Brief";

  const text =
    `Welcome to the Bazar Brief.\n\n` +
    `Every Wednesday, we send one short email: one market chart, one observation from our advisors, and one off-market listing worth a look.\n\n` +
    `You can unsubscribe at any time:\n${opts.unsubscribeUrl}\n\n` +
    `— Bazar\n${siteUrl()}\n`;

  const html = shell(`
    <p style="font-size:18px;font-family:Georgia,serif;letter-spacing:-0.015em">Welcome to the Bazar Brief.</p>
    <p>Every Wednesday, we send one short email: one market chart, one observation from our advisors, and one off-market listing worth a look.</p>
    <p style="font-size:13px;color:#5a5a55;margin-top:24px">You can unsubscribe at any time:<br><a href="${escape(opts.unsubscribeUrl)}" style="color:#5a5a55">${escape(opts.unsubscribeUrl)}</a></p>
  `);

  return { subject, text, html };
}
