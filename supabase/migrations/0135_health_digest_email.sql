-- 0135 · The daily health digest joins the email catalogue.
--
-- Every email the site sends is listed and rewritable at
-- /admin/content-assets. The digest added in this batch is a team email like
-- the escalation and the bulk-reassign notice, so it belongs there too —
-- otherwise the gallery would claim completeness it does not have, and an
-- admin reading "all the emails we send" would be missing one that lands in
-- their own inbox every morning.
--
-- Seeded as a DRAFT, like every other system email: a draft sends nothing and
-- the built-in template in lib/email-templates.ts keeps sending until someone
-- publishes an override.
--
-- The wording below is lib/content-assets/system-defaults.ts and
-- system-defaults-ar.ts, reproduced verbatim. system.test.ts and
-- arabic.test.ts fail if the two drift.

alter table public.content_assets
  drop constraint if exists content_assets_system_key_known;

alter table public.content_assets
  add constraint content_assets_system_key_known check (
    system_key is null
    or system_key = any (array[
      'enquiry_auto_reply',
      'mortgage_enquiry_ack',
      'valuation_request_ack',
      'valuation_code',
      'valuation_report_requested',
      'valuation_report',
      'valuation_nurture_day7',
      'valuation_nurture_day30',
      'newsletter_confirmation',
      'newsletter_welcome',
      'staff_invitation',
      'staff_password_reset',
      'enquiry_escalation',
      'permit_expiry_warning',
      'bulk_reassign_digest',
      'health_digest',
      'form_submission_notification'
    ])
  );

insert into public.content_assets
  (slug, system_key, kind, name, category, subject, body, body_format, role,
   subject_ar, body_ar, notes, status, position)
values
  (
    $s$system-health-digest$s$,
    $s$health_digest$s$,
    'email',
    $s$Daily health digest$s$,
    'system',
    $s$Bazar health · something needs a look$s$,
    $body$<p>The last 24 hours turned up the following.</p><p><strong>Errors</strong></p><p>{{health_errors}}</p><p><strong>Jobs</strong></p><p>{{health_jobs}}</p><a data-email-button="" href="{{health_url}}">Open the health page</a><p>— Bazar CMS</p>$body$,
    'html',
    -- `role` is not decoration: content_assets_html_is_whole_message only
    -- lets a row store HTML when it is a system email or a form reply, and
    -- the column default is 'outreach'. All sixteen existing system rows
    -- carry 'system'.
    'system',
    $s$حالة بازار · هناك ما يستدعي المراجعة$s$,
    $body$<p>أظهرت آخر ٢٤ ساعة ما يلي.</p><p><strong>الأخطاء</strong></p><p>{{health_errors}}</p><p><strong>المهام</strong></p><p>{{health_jobs}}</p><a data-email-button="" href="{{health_url}}">افتح صفحة الحالة</a><p>— نظام بازار</p>$body$,
    $note$Sent each morning only when something broke in the previous day or a job has gone late — never on a quiet day, so an arrival always means there is something to read. Recipients are every active admin.$note$,
    'draft',
    1
  )
on conflict (slug) do nothing;
