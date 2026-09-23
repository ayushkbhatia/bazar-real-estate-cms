import type { SystemAssetKey } from "./system";

/**
 * The starting wording of every system email, as rich text with tokens.
 *
 * Each is Bazar's built-in email translated into what the editor can express:
 * the same sentences, the same panels (as block tokens), the same buttons. Two
 * things cannot carry over exactly, and the gallery shows both versions side
 * by side so nobody has to take that on trust:
 *
 *   · a built-in template can branch — "on BAZ-AD-04891" only when there is a
 *     reference. Tokens cannot, so the wording here is the version that reads
 *     correctly either way, and optional lines use tokens that vanish when
 *     empty (`{{property_line}}`, `{{advisor_notes}}`).
 *   · a built-in template can style one sentence by hand. Here, styling is
 *     whatever the editor's headings, quotes and buttons look like.
 *
 * Used twice: migration 0127 seeds these into the draft rows (a test holds the
 * two in step), and the editor's "Start from Bazar's wording" restores them.
 */
export type SystemEmailDefault = { subject: string; body: string };

export const SYSTEM_EMAIL_DEFAULTS: Record<SystemAssetKey, SystemEmailDefault> = {
  enquiry_auto_reply: {
    subject: "We received your brief",
    body: [
      "<p>Hello {{lead_first_name}},</p>",
      "<p>Thank you for getting in touch with Bazar.</p>",
      "<p>{{property_line}}</p>",
      "<p>One of our advisors will reach out within <strong>two hours during business hours</strong>, and by next morning otherwise.</p>",
      "<p>Your message:</p>",
      "<blockquote><p>{{enquiry_message}}</p></blockquote>",
      "<p>— Bazar</p>",
    ].join(""),
  },
  mortgage_enquiry_ack: {
    subject: "Your mortgage scenario is with our desk",
    body: [
      "<p>Hello {{lead_first_name}},</p>",
      "<p>Thank you — your pre-approval request is with the Bazar mortgage desk.</p>",
      "<p>An advisor will come back to you with what our partner banks will actually lend on this scenario, and what they will need from you to confirm it.</p>",
      "<p>The scenario you sent:</p>",
      "<blockquote><p>{{enquiry_message}}</p></blockquote>",
      "<p>— The Bazar mortgage desk</p>",
    ].join(""),
  },
  valuation_request_ack: {
    subject: "Your Bazar valuation is in review",
    body: [
      "<p>Hello {{lead_first_name}},</p>",
      "<p>Thanks for sharing the details on <strong>{{valuation_property}}</strong>.</p>",
      "<p>{{valuation_range_panel}}</p>",
      "<p>A senior advisor will refine this and send you a final number within <strong>24 hours</strong>. There’s no obligation — and no listing pressure.</p>",
      "<p>— Bazar</p>",
    ].join(""),
  },
  valuation_code: {
    subject: "Your Bazar valuation code: {{verification_code}}",
    body: [
      "<p>Your one-time code:</p>",
      "<h2>{{verification_code}}</h2>",
      "<p>It expires in 10 minutes. If you didn’t request this, you can ignore this email.</p>",
      "<p>— Bazar Real Estate</p>",
    ].join(""),
  },
  valuation_report_requested: {
    subject: "Your Bazar valuation report is on the way",
    body: [
      "<p>Thanks for verifying.</p>",
      "<p>A Bazar advisor will review your property details, sense-check the instant estimate against the latest comparables, and send you the full advisor-prepared report within 24 hours.</p>",
      "<p>Questions in the meantime? Reply to this email.</p>",
      "<p>— Bazar Real Estate</p>",
    ].join(""),
  },
  valuation_report: {
    subject: "Your Bazar valuation: {{valuation_final}}",
    body: [
      "<p>Hello {{lead_first_name}},</p>",
      "<p>Here is the refined valuation for <strong>{{valuation_property}}</strong>.</p>",
      "<p>{{valuation_report_panel}}</p>",
      "<blockquote><p>{{advisor_notes}}</p></blockquote>",
      '<p>If you’d like to discuss the figure or what a listing would look like, just reply to this email or <a href="{{contact_url}}">book a call</a>.</p>',
      "<p>— {{advisor_name}}, Bazar Real Estate</p>",
    ].join(""),
  },
  valuation_nurture_day7: {
    subject: "How’s the valuation landing?",
    body: [
      "<p>Hi {{lead_first_name}},</p>",
      "<p>It’s been a week since we sent your Bazar valuation. Our advisor estimate landed at {{valuation_midpoint}}.</p>",
      "<p>If you’d like to talk through next steps — listing strategy, targeted off-market introductions, or a re-cut at a different price point — reply to this thread.</p>",
      '<p><a href="{{contact_url}}">Talk to an advisor →</a></p>',
      "<p>— Bazar</p>",
    ].join(""),
  },
  valuation_nurture_day30: {
    subject: "Market update on your Abu Dhabi unit",
    body: [
      "<p>Hi {{lead_first_name}},</p>",
      '<p>A month on from your valuation — we publish a monthly Abu Dhabi market read at <a href="{{insights_url}}">Bazar Insights</a>.</p>',
      "<p>If your view on selling has shifted, or you’d like a fresh valuation cut, reply here.</p>",
      "<p>— Bazar</p>",
    ].join(""),
  },
  newsletter_confirmation: {
    subject: "Confirm your subscription to the Bazar Brief",
    body: [
      "<p>Hello,</p>",
      "<p>You’re one click away from subscribing to <strong>the Bazar Brief</strong> — our weekly briefing on the Abu Dhabi market.</p>",
      '<a data-email-button="" href="{{confirm_url}}">Confirm subscription</a>',
      "<p>If you didn’t request this, ignore this email — we won’t add you to the list.</p>",
    ].join(""),
  },
  newsletter_welcome: {
    subject: "You’re in — welcome to the Bazar Brief",
    body: [
      "<h2>Welcome to the Bazar Brief.</h2>",
      "<p>Every Wednesday, we send one short email: one market chart, one observation from our advisors, and one off-market listing worth a look.</p>",
      '<p>You can <a href="{{unsubscribe_url}}">unsubscribe at any time</a>.</p>',
    ].join(""),
  },
  staff_invitation: {
    subject: "You’re invited to Bazar as {{staff_role}}",
    body: [
      "<p>Hi {{staff_name}},</p>",
      "<p><strong>{{sender_name}}</strong> invited you to Bazar Real Estate’s internal console as <strong>{{staff_role}}</strong>.</p>",
      '<a data-email-button="" href="{{password_url}}">Set your password</a>',
      "<p>The link is valid for {{link_valid_days}} days.</p>",
      "<p>— Bazar</p>",
    ].join(""),
  },
  staff_password_reset: {
    subject: "Set a new password for your Bazar admin account",
    body: [
      "<p>Hi {{staff_name}},</p>",
      "<p><strong>{{sender_name}}</strong> has sent you a link to set a new password for the Bazar admin console.</p>",
      '<a data-email-button="" href="{{password_url}}">Set a new password</a>',
      "<p>Valid for {{link_valid_days}} days, single use. If you didn’t expect this, tell an administrator — your current password keeps working until you set a new one.</p>",
      "<p>— Bazar</p>",
    ].join(""),
  },
  enquiry_escalation: {
    subject:
      "Escalation · enquiry from {{lead_name}} unassigned {{minutes_waiting}} min",
    body: [
      "<p>Hi {{staff_name}},</p>",
      "<p>An enquiry from <strong>{{lead_name}}</strong> has been waiting <strong>{{minutes_waiting}} minutes</strong> without an assigned advisor.</p>",
      "<p>{{property_line}}</p>",
      '<a data-email-button="" href="{{enquiry_url}}">Open enquiry</a>',
      "<p>— Bazar lead engine</p>",
    ].join(""),
  },
  permit_expiry_warning: {
    subject:
      "Permit {{permit_number}} ({{property_reference}}) expires in {{days_to_expiry}} days",
    body: [
      "<p>Hi,</p>",
      "<p>Listing permit {{permit_number}} for <strong>{{property_reference}}</strong> expires on <strong>{{permit_expires_on}}</strong> (in {{days_to_expiry}} days).</p>",
      "<p>The listing will be archived automatically at expiry unless renewed.</p>",
      '<a data-email-button="" href="{{properties_url}}">Open properties</a>',
      "<p>— Bazar compliance</p>",
    ].join(""),
  },
  bulk_reassign_digest: {
    subject: "You were assigned {{listings_assigned}}",
    body: [
      "<p>Hi {{staff_name}},</p>",
      "<p>We’ve just assigned you <strong>{{listings_assigned}}</strong> in the Bazar CMS.</p>",
      "<p>{{listing_references}}</p>",
      '<a data-email-button="" href="{{queue_url}}">Open my queue</a>',
      "<p>— Bazar CMS</p>",
    ].join(""),
  },
  form_submission_notification: {
    subject: "New {{form_name}} submission · {{form_surface}}",
    body: [
      "<p><strong>{{form_name}}</strong></p>",
      "<p>{{form_surface}}</p>",
      "<p>{{form_answers}}</p>",
      '<p><a href="{{enquiry_url}}">Open the enquiry</a> · <a href="{{responses_url}}">All responses</a></p>',
    ].join(""),
  },
};
