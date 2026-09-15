-- 0127_system_emails_catalogue.sql
-- Every email the site sends, visible and rewritable in /admin/content-assets.
--
-- WHAT WAS MISSING. 0117 made four transactional emails rewritable. The site
-- sends eighteen. The other fourteen — the newsletter confirmation, the
-- valuation code and report, the nurture follow-ups, the team invitation and
-- password link, the escalation, permit and assignment notices, the form
-- notifications — were string literals in lib/email-templates.ts, and two of
-- them (the valuation code and its follow-up) were HTML typed inline in a route
-- handler, without even the Bazar header. Nobody without a code editor could
-- see what any of them said, let alone change it.
--
-- WHAT THIS DOES, in four parts. None of it changes a sent email.
--
--   1. `body_format`. System bodies are now authored in a rich-text editor and
--      stored as sanitised HTML with {{tokens}} in it. Existing rows are
--      plain text and keep rendering as they did; the column says which is
--      which, so neither format has to be guessed from the content.
--
--   2. Thirteen new system rows, seeded as DRAFTS. A draft sends nothing: the
--      built-in template keeps sending until someone publishes. The one new
--      email with no built-in of its own, the mortgage acknowledgement, falls
--      back to the general enquiry acknowledgement — which is what mortgage
--      leads receive today.
--
--   3. The four 0117 rows move to the rich-text starting wording, but ONLY
--      where the row is still exactly what 0117 seeded (subject and body
--      matched by hash, still a draft). In production all four were untouched
--      when this was written. An edited row is left exactly as it is.
--
--   4. `site_settings.email_branding` — the logo, colours and footer every
--      email is wrapped in, edited at /admin/content-assets/design. `{}`
--      resolves to the look the emails already have (lib/content-assets/
--      email-brand.ts), so it too changes nothing until someone saves.
--
-- The starting wording is lib/content-assets/system-defaults.ts, reproduced
-- below. lib/content-assets/system.test.ts fails if the two drift.

-- ───────────────────────────────────────────────────────────────
-- 1. Body format
-- ───────────────────────────────────────────────────────────────
alter table public.content_assets
  add column if not exists body_format text not null default 'text';

alter table public.content_assets
  drop constraint if exists content_assets_body_format_known;
alter table public.content_assets
  add constraint content_assets_body_format_known
  check (body_format in ('text', 'html'));

-- Outreach assets are sent from the enquiry composer as plain text and WhatsApp
-- has no markup at all, so rich text is a system-email feature only.
alter table public.content_assets
  drop constraint if exists content_assets_html_is_system;
alter table public.content_assets
  add constraint content_assets_html_is_system
  check (body_format = 'text' or system_key is not null);

comment on column public.content_assets.body_format is
  'How `body` is stored: text (paragraphs separated by blank lines) or html (sanitised rich text from the system email editor). html only on system rows.';

-- ───────────────────────────────────────────────────────────────
-- 2. The key vocabulary, widened — before the seed, which it validates
-- ───────────────────────────────────────────────────────────────
alter table public.content_assets
  drop constraint if exists content_assets_system_key_known;
alter table public.content_assets
  add constraint content_assets_system_key_known
  check (system_key is null or system_key in (
    'enquiry_auto_reply',
    'mortgage_enquiry_ack',
    'valuation_request_ack',
    'valuation_code',
    'valuation_report_requested',
    'valuation_report',
    'valuation_nurture_day7',
    'valuation_nurture_day30',
    'viewing_confirmation',
    'newsletter_confirmation',
    'newsletter_welcome',
    'staff_invitation',
    'staff_password_reset',
    'enquiry_escalation',
    'permit_expiry_warning',
    'bulk_reassign_digest',
    'form_submission_notification'
  ));

-- ───────────────────────────────────────────────────────────────
-- 3. Seed — drafts, idempotent on slug, never overwriting a row
-- ───────────────────────────────────────────────────────────────
insert into public.content_assets
  (slug, system_key, kind, name, category, subject, body, body_format, notes, status, position)
values
  (
    $s$system-mortgage-enquiry-ack$s$,
    $s$mortgage_enquiry_ack$s$,
    'email',
    $s$Mortgage enquiry acknowledgement$s$,
    'system',
    $s$Your mortgage scenario is with our desk$s$,
    $body$<p>Hello {{lead_first_name}},</p><p>Thank you — your pre-approval request is with the Bazar mortgage desk.</p><p>An advisor will come back to you with what our partner banks will actually lend on this scenario, and what they will need from you to confirm it.</p><p>The scenario you sent:</p><blockquote><p>{{enquiry_message}}</p></blockquote><p>— The Bazar mortgage desk</p>$body$,
    'html',
    $note$Only mortgage pre-approval leads receive this. While it is a draft, they receive the general enquiry acknowledgement instead, exactly as before this email existed.$note$,
    'draft',
    1
  ),
  (
    $s$system-valuation-code$s$,
    $s$valuation_code$s$,
    'email',
    $s$Valuation report code$s$,
    'system',
    $s$Your Bazar valuation code: {{verification_code}}$s$,
    $body$<p>Your one-time code:</p><h2>{{verification_code}}</h2><p>It expires in 10 minutes. If you didn’t request this, you can ignore this email.</p><p>— Bazar Real Estate</p>$body$,
    'html',
    $note$The code is the point of the email. Keep {{verification_code}} somewhere it cannot be missed — the editor will not publish a version without it.$note$,
    'draft',
    3
  ),
  (
    $s$system-valuation-report-requested$s$,
    $s$valuation_report_requested$s$,
    'email',
    $s$Valuation report on its way$s$,
    'system',
    $s$Your Bazar valuation report is on the way$s$,
    $body$<p>Thanks for verifying.</p><p>A Bazar advisor will review your property details, sense-check the instant estimate against the latest comparables, and send you the full advisor-prepared report within 24 hours.</p><p>Questions in the meantime? Reply to this email.</p><p>— Bazar Real Estate</p>$body$,
    'html',
    $note$Sent seconds after the code email, to the same owner. Keep it short; they have just read one email from us.$note$,
    'draft',
    4
  ),
  (
    $s$system-valuation-report$s$,
    $s$valuation_report$s$,
    'email',
    $s$Refined valuation$s$,
    'system',
    $s$Your Bazar valuation: {{valuation_final}}$s$,
    $body$<p>Hello {{lead_first_name}},</p><p>Here is the refined valuation for <strong>{{valuation_property}}</strong>.</p><p>{{valuation_report_panel}}</p><blockquote><p>{{advisor_notes}}</p></blockquote><p>If you’d like to discuss the figure or what a listing would look like, just reply to this email or <a href="{{contact_url}}">book a call</a>.</p><p>— {{advisor_name}}, Bazar Real Estate</p>$body$,
    'html',
    $note$The advisor's notes and the figure panel are filled in per valuation. Notes vanish when the advisor wrote none.$note$,
    'draft',
    5
  ),
  (
    $s$system-valuation-nurture-day7$s$,
    $s$valuation_nurture_day7$s$,
    'email',
    $s$Valuation follow-up · day 7$s$,
    'system',
    $s$How’s the valuation landing?$s$,
    $body$<p>Hi {{lead_first_name}},</p><p>It’s been a week since we sent your Bazar valuation. Our advisor estimate landed at {{valuation_midpoint}}.</p><p>If you’d like to talk through next steps — listing strategy, targeted off-market introductions, or a re-cut at a different price point — reply to this thread.</p><p><a href="{{contact_url}}">Talk to an advisor →</a></p><p>— Bazar</p>$body$,
    'html',
    $note$Sent by a cron, a week after the refined valuation. It should read like a person checking in, not a campaign.$note$,
    'draft',
    6
  ),
  (
    $s$system-valuation-nurture-day30$s$,
    $s$valuation_nurture_day30$s$,
    'email',
    $s$Valuation follow-up · day 30$s$,
    'system',
    $s$Market update on your Abu Dhabi unit$s$,
    $body$<p>Hi {{lead_first_name}},</p><p>A month on from your valuation — we publish a monthly Abu Dhabi market read at <a href="{{insights_url}}">Bazar Insights</a>.</p><p>If your view on selling has shifted, or you’d like a fresh valuation cut, reply here.</p><p>— Bazar</p>$body$,
    'html',
    $note$Sent by a cron, a month after the refined valuation.$note$,
    'draft',
    7
  ),
  (
    $s$system-newsletter-confirmation$s$,
    $s$newsletter_confirmation$s$,
    'email',
    $s$Newsletter confirmation$s$,
    'system',
    $s$Confirm your subscription to the Bazar Brief$s$,
    $body$<p>Hello,</p><p>You’re one click away from subscribing to <strong>the Bazar Brief</strong> — our weekly briefing on the Abu Dhabi market.</p><a data-email-button="" href="{{confirm_url}}">Confirm subscription</a><p>If you didn’t request this, ignore this email — we won’t add you to the list.</p>$body$,
    'html',
    $note$Double opt-in: nobody is subscribed until they click. The confirm button is required — without it the address can never join the list.$note$,
    'draft',
    9
  ),
  (
    $s$system-staff-invitation$s$,
    $s$staff_invitation$s$,
    'email',
    $s$Team invitation$s$,
    'system',
    $s$You’re invited to Bazar as {{staff_role}}$s$,
    $body$<p>Hi {{staff_name}},</p><p><strong>{{sender_name}}</strong> invited you to Bazar Real Estate’s internal console as <strong>{{staff_role}}</strong>.</p><a data-email-button="" href="{{password_url}}">Set your password</a><p>The link is valid for {{link_valid_days}} days.</p><p>— Bazar</p>$body$,
    'html',
    $note$Goes to someone who has never used the console. The set-password link is required.$note$,
    'draft',
    11
  ),
  (
    $s$system-staff-password-reset$s$,
    $s$staff_password_reset$s$,
    'email',
    $s$Set a new password$s$,
    'system',
    $s$Set a new password for your Bazar admin account$s$,
    $body$<p>Hi {{staff_name}},</p><p><strong>{{sender_name}}</strong> has sent you a link to set a new password for the Bazar admin console.</p><a data-email-button="" href="{{password_url}}">Set a new password</a><p>Valid for {{link_valid_days}} days, single use. If you didn’t expect this, tell an administrator — your current password keeps working until you set a new one.</p><p>— Bazar</p>$body$,
    'html',
    $note$The only sign-in email the site sends. The set-password link is required.$note$,
    'draft',
    12
  ),
  (
    $s$system-enquiry-escalation$s$,
    $s$enquiry_escalation$s$,
    'email',
    $s$Unassigned enquiry escalation$s$,
    'system',
    $s$Escalation · enquiry from {{lead_name}} unassigned {{minutes_waiting}} min$s$,
    $body$<p>Hi {{staff_name}},</p><p>An enquiry from <strong>{{lead_name}}</strong> has been waiting <strong>{{minutes_waiting}} minutes</strong> without an assigned advisor.</p><p>{{property_line}}</p><a data-email-button="" href="{{enquiry_url}}">Open enquiry</a><p>— Bazar lead engine</p>$body$,
    'html',
    $note$Internal. Goes to every administrator when a lead has waited an hour for an advisor.$note$,
    'draft',
    13
  ),
  (
    $s$system-permit-expiry-warning$s$,
    $s$permit_expiry_warning$s$,
    'email',
    $s$Listing permit expiring$s$,
    'system',
    $s$Permit {{permit_number}} ({{property_reference}}) expires in {{days_to_expiry}} days$s$,
    $body$<p>Hi,</p><p>Listing permit {{permit_number}} for <strong>{{property_reference}}</strong> expires on <strong>{{permit_expires_on}}</strong> (in {{days_to_expiry}} days).</p><p>The listing will be archived automatically at expiry unless renewed.</p><a data-email-button="" href="{{properties_url}}">Open properties</a><p>— Bazar compliance</p>$body$,
    'html',
    $note$Internal. A listing whose permit lapses is archived automatically, so this is the last warning before it disappears.$note$,
    'draft',
    14
  ),
  (
    $s$system-bulk-reassign-digest$s$,
    $s$bulk_reassign_digest$s$,
    'email',
    $s$Listings assigned to you$s$,
    'system',
    $s$You were assigned {{listings_assigned}}$s$,
    $body$<p>Hi {{staff_name}},</p><p>We’ve just assigned you <strong>{{listings_assigned}}</strong> in the Bazar CMS.</p><p>{{listing_references}}</p><a data-email-button="" href="{{queue_url}}">Open my queue</a><p>— Bazar CMS</p>$body$,
    'html',
    $note$Internal. One email per reassign, however many listings moved.$note$,
    'draft',
    15
  ),
  (
    $s$system-form-submission-notification$s$,
    $s$form_submission_notification$s$,
    'email',
    $s$New form submission$s$,
    'system',
    $s$New {{form_name}} submission · {{form_surface}}$s$,
    $body$<p><strong>{{form_name}}</strong></p><p>{{form_surface}}</p><p>{{form_answers}}</p><p><a href="{{enquiry_url}}">Open the enquiry</a> · <a href="{{responses_url}}">All responses</a></p>$body$,
    'html',
    $note$Internal. Goes to the addresses on each form's notification list in /admin/forms.$note$,
    'draft',
    16
  )
on conflict (slug) do nothing;

-- ───────────────────────────────────────────────────────────────
-- 4. The four 0117 rows, where untouched
-- ───────────────────────────────────────────────────────────────
update public.content_assets
   set subject = $s$We received your brief$s$,
       body = $body$<p>Hello {{lead_first_name}},</p><p>Thank you for getting in touch with Bazar.</p><p>{{property_line}}</p><p>One of our advisors will reach out within <strong>two hours during business hours</strong>, and by next morning otherwise.</p><p>Your message:</p><blockquote><p>{{enquiry_message}}</p></blockquote><p>— Bazar</p>$body$,
       body_format = 'html',
       position = 0
 where system_key = 'enquiry_auto_reply'
   and status = 'draft'
   and body_format = 'text'
   and md5(body) = '3c09e83345938ca02acd21ac6c8f7fa4'
   and md5(subject) = 'f013043069024130b762dd4451b66792';
update public.content_assets
   set subject = $s$Your Bazar valuation is in review$s$,
       body = $body$<p>Hello {{lead_first_name}},</p><p>Thanks for sharing the details on <strong>{{valuation_property}}</strong>.</p><p>{{valuation_range_panel}}</p><p>A senior advisor will refine this and send you a final number within <strong>24 hours</strong>. There’s no obligation — and no listing pressure.</p><p>— Bazar</p>$body$,
       body_format = 'html',
       position = 2
 where system_key = 'valuation_request_ack'
   and status = 'draft'
   and body_format = 'text'
   and md5(body) = 'ed3cae151751c39aab5c4f0dc2eaa265'
   and md5(subject) = '83ca03349788c7dcfbb7be94d32a89de';
update public.content_assets
   set subject = $s$Tentative viewing · {{property_reference}}$s$,
       body = $body$<p>Hello {{lead_first_name}},</p><p>We’ve tentatively scheduled your viewing for <strong>{{viewing_time}}</strong> (Asia/Dubai).</p><ul><li><p>Listing: {{property_reference}} · {{property_title}}</p></li><li><p>Where: {{viewing_location}}</p></li><li><p>Duration: {{viewing_duration}}</p></li></ul><p>The calendar invite is attached — accept it to add the viewing to your calendar.</p><p>If this time doesn’t work, simply reply and we’ll find another.</p><p>— Bazar Real Estate</p>$body$,
       body_format = 'html',
       position = 8
 where system_key = 'viewing_confirmation'
   and status = 'draft'
   and body_format = 'text'
   and md5(body) = 'c70db3133b99bfe5510d96f5e2a893f1'
   and md5(subject) = 'c50ef546c6eebde5ccf1377656b9db03';
update public.content_assets
   set subject = $s$You’re in — welcome to the Bazar Brief$s$,
       body = $body$<h2>Welcome to the Bazar Brief.</h2><p>Every Wednesday, we send one short email: one market chart, one observation from our advisors, and one off-market listing worth a look.</p><p>You can <a href="{{unsubscribe_url}}">unsubscribe at any time</a>.</p>$body$,
       body_format = 'html',
       position = 10
 where system_key = 'newsletter_welcome'
   and status = 'draft'
   and body_format = 'text'
   and md5(body) = '08ecdb037e20a9a2f1100a55274a2e44'
   and md5(subject) = '01e75eec30558bc9f865190d0bc6ca28';

-- ───────────────────────────────────────────────────────────────
-- 5. Email design
-- ───────────────────────────────────────────────────────────────
alter table public.site_settings
  add column if not exists email_branding jsonb not null default '{}'::jsonb;

comment on column public.site_settings.email_branding is
  'Email design overrides — header logo or wordmark, colours, footer lines — applied to every email the site sends. Edited at /admin/content-assets/design; validated by emailBrandSchema (lib/content-assets/email-brand.ts). {} means the design the emails shipped with.';

-- NO anon grant, deliberately. site_settings is the table with column-level
-- grants (0096/0097) and CLAUDE.md warns that a new PUBLIC column needs one.
-- This column is not public: nothing a visitor's browser renders reads it. It
-- is read with the service role on the send path and with a staff session in
-- the admin, and every anon select on site_settings names its columns, so an
-- ungranted column here breaks none of them.
