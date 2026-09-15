import {
  emailShell as shell,
  emailSiteUrl as siteUrl,
  escapeEmailHtml as escape,
} from "@/lib/email-templates";
import {
  DEFAULT_EMAIL_BRAND,
  type EmailBrand,
} from "@/lib/content-assets/email-brand";

export function newsletterConfirmTemplate(
  opts: {
    email: string;
    confirmUrl: string;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): { subject: string; text: string; html: string } {
  const subject = "Confirm your subscription to the Bazar Brief";

  const text =
    `Hello,\n\n` +
    `You're one click away from subscribing to the Bazar Brief — our weekly briefing on the Abu Dhabi market.\n\n` +
    `Confirm your subscription:\n${opts.confirmUrl}\n\n` +
    `If you didn't request this, ignore this email — we won't add you to the list.\n\n` +
    `— Bazar\n${siteUrl()}\n`;

  const html = shell(
    `
    <p>Hello,</p>
    <p>You're one click away from subscribing to <strong>the Bazar Brief</strong> — our weekly briefing on the Abu Dhabi market.</p>
    <p style="margin:24px 0">
      <a href="${escape(opts.confirmUrl)}" style="display:inline-block;background:${brand.buttonColor};color:${brand.buttonTextColor};padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:500;font-size:14px;letter-spacing:0.01em">Confirm subscription</a>
    </p>
    <p style="font-size:13px;color:#5a5a55">If the button doesn't work, paste this link into your browser:<br><a href="${escape(opts.confirmUrl)}" style="color:#5a5a55;word-break:break-all">${escape(opts.confirmUrl)}</a></p>
    <p style="font-size:13px;color:#5a5a55;margin-top:16px">If you didn't request this, ignore this email — we won't add you to the list.</p>
  `,
    brand,
  );

  return { subject, text, html };
}

export function newsletterWelcomeTemplate(
  opts: {
    unsubscribeUrl: string;
  },
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): { subject: string; text: string; html: string } {
  const subject = "You're in — welcome to the Bazar Brief";

  const text =
    `Welcome to the Bazar Brief.\n\n` +
    `Every Wednesday, we send one short email: one market chart, one observation from our advisors, and one off-market listing worth a look.\n\n` +
    `You can unsubscribe at any time:\n${opts.unsubscribeUrl}\n\n` +
    `— Bazar\n${siteUrl()}\n`;

  const html = shell(
    `
    <p style="font-size:18px;font-family:Georgia,serif;letter-spacing:-0.015em">Welcome to the Bazar Brief.</p>
    <p>Every Wednesday, we send one short email: one market chart, one observation from our advisors, and one off-market listing worth a look.</p>
    <p style="font-size:13px;color:#5a5a55;margin-top:24px">You can unsubscribe at any time:<br><a href="${escape(opts.unsubscribeUrl)}" style="color:#5a5a55">${escape(opts.unsubscribeUrl)}</a></p>
  `,
    brand,
  );

  return { subject, text, html };
}
