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
  // The mortgage flow's two confirmations. Provisional wording: the copy for
  // every mortgage email is still to be designed (docs/mortgage/DECISIONS.md
  // D29). The sentences the website already says — W4's "A member of our
  // mortgage team…", W7's WhatsApp line — are kept word for word, and the
  // promise is "working hours" because that is what the clock counts (D11a).
  mortgage_consultancy_received: {
    subject: "We've received your request — {{mortgage_reference}}",
    body: [
      "<p>Hello {{lead_first_name}},</p>",
      "<p>Thank you for requesting a mortgage consultation with Bazar. We received your request on {{mortgage_submitted}}.</p>",
      "<p>Your reference is <strong>{{mortgage_reference}}</strong>.</p>",
      "<p>A member of our mortgage team will contact you shortly.</p>",
      "<p>— The Bazar mortgage team</p>",
    ].join(""),
  },
  mortgage_preapproval_received: {
    subject: "Your Fast Pre-Approval application — {{mortgage_reference}}",
    body: [
      "<p>Hello {{lead_first_name}},</p>",
      "<p>Thank you for applying for Fast Pre-Approval with Bazar. Your details and documents have reached our mortgage team.</p>",
      "<p>Your reference is <strong>{{mortgage_reference}}</strong>.</p>",
      "<p>We'll contact you by <strong>{{mortgage_due}}</strong> — 24 working hours from when you submitted.</p>",
      "<p>{{mortgage_documents}}</p>",
      "<p>If we need anything else, we'll message you on WhatsApp with a secure link. You won't need to start again.</p>",
      "<p>— The Bazar mortgage team</p>",
    ].join(""),
  },
  // The booking and the invitation (0144). Provisional too (D29). The booking
  // says the calendar invite is attached because the send path attaches it;
  // the invitation says how the link is guarded without naming the channel
  // the code arrives by, which is still open (D5).
  mortgage_consultation_booked: {
    subject: "Your mortgage consultation is booked for {{mortgage_consultation_when}}",
    body: [
      "<p>Hello {{lead_first_name}},</p>",
      "<p>Your mortgage consultation with {{mortgage_adviser}} is booked.</p>",
      "<ul>",
      "<li><p>When: <strong>{{mortgage_consultation_when}}</strong> (UAE time)</p></li>",
      "<li><p>How: {{mortgage_consultation_format}}</p></li>",
      "<li><p>Duration: {{mortgage_consultation_duration}}</p></li>",
      "<li><p>Reference: {{mortgage_reference}}</p></li>",
      "</ul>",
      "<p>A calendar invite is attached — open it to add the consultation to your calendar.</p>",
      "<p>If the time no longer suits you, reply to this email and we'll find another.</p>",
      "<p>— The Bazar mortgage team</p>",
    ].join(""),
  },
  mortgage_preapproval_invite: {
    subject: "Your secure link to apply for Fast Pre-Approval",
    body: [
      "<p>Hello {{lead_first_name}},</p>",
      "<p>{{mortgage_adviser}} has sent you a secure link to apply for Fast Pre-Approval with Bazar.</p>",
      "<p>Your details carry over from your consultation request ({{mortgage_reference}}), so you'll only need to upload your documents.</p>",
      '<a data-email-button="" href="{{mortgage_secure_url}}">Start your application</a>',
      "<p>Before you upload, we'll send you a code to confirm it's you.</p>",
      "<p>The link works until <strong>{{mortgage_link_expires}}</strong>. It's personal to you, so please don't forward this email.</p>",
      "<p>— The Bazar mortgage team</p>",
    ].join(""),
  },
  // Reviewing the documents (0146). Provisional too (D29). The subject is
  // W8's heading, and the adviser's message is a panel so every line of it is
  // quoted. Neither email says how the code arrives: by email until WhatsApp
  // is connected, by WhatsApp after (D5).
  mortgage_reupload_request: {
    subject: "One document needs another look — {{mortgage_reference}}",
    body: [
      "<p>Hello {{lead_first_name}},</p>",
      "<p>{{mortgage_adviser}} has asked for another look at one document for your application {{mortgage_reference}}: <strong>{{mortgage_document}}</strong>.</p>",
      "<p>{{mortgage_adviser_message}}</p>",
      "<p>Your application is on hold until the document arrives. Any documents we've already accepted stay accepted.</p>",
      '<a data-email-button="" href="{{mortgage_secure_url}}">Upload your document</a>',
      "<p>Before you upload, we'll send you a code to confirm it's you.</p>",
      "<p>The link works until <strong>{{mortgage_link_expires}}</strong>. It's personal to you, so please don't forward this email.</p>",
      "<p>— The Bazar mortgage team</p>",
    ].join(""),
  },
  // Never the code in the subject: a phone prints the subject on its lock
  // screen.
  mortgage_code: {
    subject: "Your Bazar verification code",
    body: [
      "<p>Hello {{lead_first_name}},</p>",
      "<p>Use this code to open your secure link:</p>",
      "<h2>{{verification_code}}</h2>",
      "<p>It expires in {{mortgage_code_expires_in}}.</p>",
      "<p>If you didn't ask for it, you can ignore this email — nobody can open your application without the code.</p>",
      "<p>— The Bazar mortgage team</p>",
    ].join(""),
  },
  // Partner banks (0150). Provisional too (D29). A bank email holds the
  // reference and nothing else about the applicant; the details are behind
  // the link. The greeting reads right when the bank's name falls back ("the
  // team at the bank"), and the reminder is worded so a missing adviser's name
  // reads right too.
  mortgage_bank_package: {
    subject: "Fast Pre-Approval package {{mortgage_reference}} from Bazar",
    body: [
      "<p>Hello to the team at {{mortgage_bank}},</p>",
      "<p>{{mortgage_adviser}} from Bazar's mortgage team has shared a Fast Pre-Approval application with you: a structured summary and {{mortgage_document_count}}.</p>",
      '<a data-email-button="" href="{{mortgage_package_url}}">Open the package</a>',
      "<p>The link works until <strong>{{mortgage_link_expires}}</strong>. Every open and download is recorded.</p>",
      "<p>Reply to this email to reach {{mortgage_adviser}}.</p>",
      "<p>— The Bazar mortgage team</p>",
    ].join(""),
  },
  mortgage_bank_reminder: {
    subject: "Reminder: Fast Pre-Approval package {{mortgage_reference}}",
    body: [
      "<p>Hello to the team at {{mortgage_bank}},</p>",
      "<p>A reminder that {{mortgage_adviser}} shared Fast Pre-Approval application {{mortgage_reference}} with you on {{mortgage_package_sent}}. We'd be grateful for your response.</p>",
      "<p>Here's a fresh link, working until <strong>{{mortgage_link_expires}}</strong>.</p>",
      '<a data-email-button="" href="{{mortgage_package_url}}">Open the package</a>',
      "<p>Every open and download is recorded.</p>",
      "<p>Reply to this email to reach {{mortgage_adviser}}.</p>",
      "<p>— The Bazar mortgage team</p>",
    ].join(""),
  },
  // The pre-approval (0150). The decline's subject, word for word, so a lock
  // screen tells the two outcomes apart by neither. The send path attaches the
  // bank's letter; the wording only says it is there.
  mortgage_decision_pre_approved: {
    subject: "An update on your Fast Pre-Approval application — {{mortgage_reference}}",
    body: [
      "<p>Hello {{lead_first_name}},</p>",
      "<p>{{mortgage_adviser}} from Bazar's mortgage team has written about your Fast Pre-Approval application {{mortgage_reference}}.</p>",
      "<p>{{mortgage_adviser_message}}</p>",
      "<p>Your pre-approval letter from {{mortgage_bank}} is attached.</p>",
      "<p>You can reply to this email to reach {{mortgage_adviser}} directly, or call the mortgage team on +971 2 632 2223.</p>",
      "<p>— The Bazar mortgage team</p>",
    ].join(""),
  },
  // The decline (0148). Provisional too (D29). The subject is "an update",
  // never the outcome, because a phone prints it on its lock screen; the news
  // is the adviser's own message, the same panel the re-upload request quotes.
  // Tokens cannot branch, so with no name for the adviser the opening line
  // names the team twice; the built-in says it once.
  mortgage_decision_declined: {
    subject: "An update on your Fast Pre-Approval application — {{mortgage_reference}}",
    body: [
      "<p>Hello {{lead_first_name}},</p>",
      "<p>{{mortgage_adviser}} from Bazar's mortgage team has written about your Fast Pre-Approval application {{mortgage_reference}}.</p>",
      "<p>{{mortgage_adviser_message}}</p>",
      "<p>You can reply to this email to reach {{mortgage_adviser}} directly, or call the mortgage team on +971 2 632 2223.</p>",
      "<p>— The Bazar mortgage team</p>",
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
  // The mortgage team's alerts (0144). Provisional wording (D29). No token
  // here can carry the applicant's details — none is in these emails' scope —
  // and the last line says where they are instead. The promise is working
  // time (D11), so "left" is working time and the due time is the instant.
  mortgage_team_new_request: {
    subject: "New {{mortgage_service}} · {{mortgage_reference}}",
    body: [
      "<p>A new mortgage request has arrived.</p>",
      "<ul>",
      "<li><p>Reference: <strong>{{mortgage_reference}}</strong></p></li>",
      "<li><p>Service: {{mortgage_service}}</p></li>",
      "<li><p>Received: {{mortgage_submitted}}</p></li>",
      "<li><p>Owner: {{mortgage_owner}}</p></li>",
      "</ul>",
      '<a data-email-button="" href="{{mortgage_request_url}}">Open the request</a>',
      "<p>The applicant's details are in the CMS, not in this email.</p>",
      "<p>— Bazar CMS</p>",
    ].join(""),
  },
  mortgage_team_at_risk: {
    subject: "At risk · {{mortgage_reference}} has {{mortgage_remaining}} left",
    body: [
      "<p>This request has <strong>{{mortgage_remaining}}</strong> of working time left before its promise to the applicant falls due.</p>",
      "<ul>",
      "<li><p>Reference: <strong>{{mortgage_reference}}</strong></p></li>",
      "<li><p>Service: {{mortgage_service}}</p></li>",
      "<li><p>Due: {{mortgage_due}}</p></li>",
      "</ul>",
      '<a data-email-button="" href="{{mortgage_request_url}}">Open the request</a>',
      "<p>— Bazar CMS</p>",
    ].join(""),
  },
  mortgage_team_breached: {
    subject: "Promise missed · {{mortgage_reference}}",
    body: [
      "<p>This request has missed its promise to the applicant, and there is no decision yet.</p>",
      "<ul>",
      "<li><p>Reference: <strong>{{mortgage_reference}}</strong></p></li>",
      "<li><p>Service: {{mortgage_service}}</p></li>",
      "<li><p>Was due: {{mortgage_due}}</p></li>",
      "</ul>",
      "<p>The applicant was told to expect contact by then. If the decision needs more time, let them know.</p>",
      '<a data-email-button="" href="{{mortgage_request_url}}">Open the request</a>',
      "<p>— Bazar CMS</p>",
    ].join(""),
  },
  // 0146. The clock resumes rather than restarts (SPEC §2.5), so "resumed".
  mortgage_team_reupload_received: {
    subject: "Re-upload received · {{mortgage_reference}}",
    body: [
      "<p>A re-upload has arrived.</p>",
      "<ul>",
      "<li><p>Reference: <strong>{{mortgage_reference}}</strong></p></li>",
      "<li><p>Service: {{mortgage_service}}</p></li>",
      "<li><p>Document: {{mortgage_document}}</p></li>",
      "<li><p>Uploaded: {{mortgage_files}}</p></li>",
      "</ul>",
      "<p>The request is back in review, and the clock on its promise to the applicant has resumed.</p>",
      '<a data-email-button="" href="{{mortgage_request_url}}">Open the request</a>',
      "<p>— Bazar CMS</p>",
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
  health_digest: {
    subject: "Bazar health · something needs a look",
    body: [
      "<p>The last 24 hours turned up the following.</p>",
      "<p><strong>Errors</strong></p>",
      "<p>{{health_errors}}</p>",
      "<p><strong>Jobs</strong></p>",
      "<p>{{health_jobs}}</p>",
      '<a data-email-button="" href="{{health_url}}">Open the health page</a>',
      "<p>— Bazar CMS</p>",
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
