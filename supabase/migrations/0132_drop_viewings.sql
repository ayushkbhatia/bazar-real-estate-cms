-- 0132 · Remove viewing bookings.
--
-- The website no longer offers viewing booking or reminders, so the table,
-- the hourly reminder cron, the scheduling UI on an enquiry, the calendar
-- invite builder and the confirmation email all went with it.
--
-- Safe to drop rather than retire: `viewings` holds zero rows in production
-- and nothing references it — no foreign key points at it, and the only
-- readers were the cron and the admin action that are deleted in the same
-- change. There is no AML retention argument here either, because there is
-- nothing recorded to retain.
--
-- ── What is NOT removed ──────────────────────────────────────────────────
-- `enquiry_status = 'viewing_scheduled'` stays. That is a stage on the sales
-- pipeline, not a feature of the website: an advisor who arranges a visit by
-- phone still moves the lead into that column on the Kanban. Removing it
-- would mean rebuilding the `enquiry_status` enum and the board that reads
-- it, for a word rather than for the feature being dropped.

drop table if exists public.viewings;

-- The confirmation email was one of the seventeen rewritable system emails at
-- /admin/content-assets (0117, catalogued in 0127). Its built-in template is
-- gone, so a published override would render nothing — the row goes with it.
--
-- `content_assets_protect_system` refuses to delete, trash or unassign a row
-- carrying a `system_key`, which is correct: an editor must never be able to
-- remove one. Its own error text says the key "is assigned by migration, not
-- by the editor", and this is that migration — so the trigger is disabled for
-- exactly this statement and switched straight back on.
alter table public.content_assets disable trigger content_assets_protect_system;

delete from public.content_assets where system_key = 'viewing_confirmation';

alter table public.content_assets enable trigger content_assets_protect_system;

-- …and the key leaves the allow-list, so nothing can re-create it.
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
      'form_submission_notification'
    ])
  );

-- `notifications.kind` is free text with no constraint, and no row has ever
-- carried 'viewing_reminder', so the type narrowing in lib/notifications.ts
-- needs nothing here.
