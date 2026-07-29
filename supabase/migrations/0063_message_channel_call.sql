-- 0063_message_channel_call.sql
-- Add 'call' to message_channel.
--
-- The enquiry composer is gaining a "Log a call" tab, and a phone call has no
-- honest home in the existing set ('web','email','whatsapp','sms'). Recording
-- one as 'web' would make the conversation timeline lie about how the advisor
-- reached the lead, which is the specific problem this route already had:
-- every staff reply was logged 'web' even when it went out by email.
--
-- Logging the call matters beyond the timeline. `first_response_at` drives the
-- escalation banner and the enquiry-escalation cron, and an advisor who picked
-- up the phone should not still read as unresponded.
--
-- Adding a value to an enum is backward-compatible: existing rows and existing
-- code keep working, and nothing in the app switches exhaustively over this
-- type (checked before writing this). Postgres will not let a new enum value
-- be used in the same transaction that adds it, so this migration only adds
-- it — the first insert happens later, from the app.

alter type public.message_channel add value if not exists 'call';
