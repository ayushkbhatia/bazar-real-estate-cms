# Mortgage module — runbook

What to do when the mortgage module (Fast Pre-Approval and Mortgage Consultancy) misbehaves after launch, and how to take it live. Steps on a CMS screen are for the Head of mortgages (or an admin, where it says so); steps with SQL or environment variables are for an engineer.

**Contents**

1. [Where to look](#1-where-to-look)
2. [Stuck scans](#2-stuck-scans)
3. [Emails that didn't arrive or bounced](#3-emails-that-didnt-arrive-or-bounced)
4. [WhatsApp templates (D1)](#4-whatsapp-templates-d1)
5. [A disputed clock](#5-a-disputed-clock)
6. [Break-glass access (D10, SR-14)](#6-break-glass-access-d10-sr-14)
7. [Recording a consent withdrawal (SR-17)](#7-recording-a-consent-withdrawal-sr-17)
8. [Partner banks](#8-partner-banks)
9. [An applicant locked out of a secure link](#9-an-applicant-locked-out-of-a-secure-link)
10. [The feature flag](#10-the-feature-flag)
11. [Going live](#11-going-live)
- [Data-subject requests (export and erasure)](#data-subject-requests-export-and-erasure)
- [Retention](#retention)

**Before you use it**

- Checked against the code at commit `27165051`, plus Phase 7's changes (migration `0151`, retention, data-subject requests, scrubbing), and a local database built from every migration, 30 Sep 2026. D-numbers are decisions in [DECISIONS.md](DECISIONS.md); SR-numbers are gaps in [SECURITY-REVIEW.md](SECURITY-REVIEW.md).
- Screens: C1 is the queue (`/admin/mortgages`); C2 is a Fast Pre-Approval's file and C6 a consultancy's (`/admin/mortgages/[reference]`); C3/C4 is the document viewer (`…/documents/[kind]`); C5 is the decision (`…/decision`). W1–W7 are the website's application; W8 is the secure-link page.
- The examples use the local seed's file BZM-26-0412 (Priya Raman). Put the real reference in its place.
- The SQL returns references, ids, statuses and times, not names, emails or mobiles (an event's `data` can still hold a file name). Keep personal data out of tickets, chats and error reports.
- **Read-only** SQL changes nothing. **Changes data** SQL is for an engineer only, and runs in production only after the change is agreed (each section says with whom). Try it on the local stack first: `npm run db:local:reset`, then `docker exec -it supabase_db_bazar-local psql -U postgres -d postgres`. Each such statement writes its own audit row in the same statement, so the change and its record land together or not at all.

---

## 1. Where to look

### The health page: /admin/settings/health

Admins only; anyone else is sent back to /admin. If the Head of mortgages isn't an admin, ask one. The page has two lists: scheduled jobs and open errors.

**The mortgage-worker line.** `/api/cron/mortgage-worker` runs every five minutes. Each run does four things, in this order: retries scans, purges expired upload drafts, checks the 24-hour promises, and sends what the outbox holds. The chip next to it reads:

- **ok**: the last run worked.
- **late**: no run for 15 minutes (three missed runs).
- **failing**: the last run failed. The detail reads `failed`, and the error is under "Open errors" with source `cron.mortgage-worker`. The four steps run in one go, so a failure in an early step also means no alarms and no emails went out in that run.
- **never run**: "No run recorded. Either the schedule has never fired, or CRON_SECRET is unset." Without `CRON_SECRET` the route answers 503.

A good run's detail looks like this:

```
scanned 2 clean, 0 rejected, 1 waiting; purged 3 drafts; promises 14 checked, 1 at risk, 0 missed; notified 6 sent, 2 skipped, 0 failed
```

| Part | Meaning |
|---|---|
| `scanned N clean` | files that passed the malware scan in this run |
| `N rejected` | files the scanner called infected or couldn't scan, or whose stored copy was missing. Each is deleted and marked removed |
| `N waiting` | files still waiting after this run. The worker takes the 20 oldest each run, so with no scanner this reads up to 20, every run (§2) |
| `purged N drafts` | upload drafts nobody submitted, past their expiry, deleted with their files (up to 100 a run) |
| `promises N checked` | running Fast Pre-Approval clocks: not paused, not stopped, not already reported missed |
| `N at risk`, `N missed` | alarms raised in this run. Each fires once; a clock that resumes after a pause can fire them again |
| `notified N sent, N skipped, N failed` | outbox messages handled in this run (up to 40). `skipped` is final; `failed` is tried again (§3) |

```sql
-- Read-only: the same line
select job, last_run_at, last_ok, last_detail, consecutive_failures
  from public.cron_heartbeats
 where job = 'mortgage-worker';
```

**The mortgage-retention line.** `/api/cron/mortgage-retention` runs once a day, at 22:30 UTC (02:30 in Dubai). Until a retention period is set it reads "retention not set (D7): nothing deleted"; afterwards, how many files it deleted ("Retention", below). It counts as late after a day without a run.

**Open errors** (`error_events`). One row per distinct problem, with a count, when it was first and last seen, and a Context block. The module's rows have source `cron.mortgage-worker`, `cron.mortgage-retention`, or start with `mortgage.`:

- `mortgage.notify`: the outbox;
- `mortgage.cms.…`: the CMS actions;
- `mortgage.requests.…`, `mortgage.drafts.…`, `mortgage.files.…`, `mortgage.links.…`, `mortgage.letters.…` and `mortgage.packages.file`: the website and its API.

"Resolve" hides a row until the problem happens again. Contexts carry ids and codes, and since Phase 7 every message, stack and context is scrubbed of email addresses, phone numbers and tokens before it's stored (`lib/pii-scrub.ts`); still read a message before you paste it anywhere else. When the database itself is down, errors reach only Vercel's function logs.

```sql
-- Read-only
select source, level, message, count, first_seen_at, last_seen_at
  from public.error_events
 where resolved_at is null
   and (source like 'mortgage.%' or source like 'cron.mortgage-%')
 order by last_seen_at desc;
```

### The file's Activity card

On C2, and inside C6's contact log. Newest first; "View all {count}" opens the rest. It shows who opened or downloaded each document (staff by first name, banks by name), re-upload requests and replies, the bank steps, the decision, "The secure link locked after five wrong codes", "Promise at risk" and "Promise missed".

It doesn't show emails, codes sent, links verified or failed scans: those are in `mortgage_events` and `mortgage_notifications`. On a Fast Pre-Approval, the "Submitted from the website" line's "Confirmation shown · email sent" is fixed wording and doesn't prove the email went. Opening or downloading a document is logged; looking at a file's page isn't.

```sql
-- Read-only: a file's whole log
select e.created_at, e.type, e.actor_kind, e.actor_id, e.data
  from public.mortgage_events e
  join public.mortgage_requests r on r.id = e.request_id
 where r.reference = 'BZM-26-0412'
 order by e.created_at;
```

### The outbox: mortgage_notifications

One row per message and channel (`email`, `whatsapp`, `in_app`), including the emails an action sends itself. No screen shows it. The columns that matter:

- `kind`: what the message is (§3 lists them).
- `status`: `queued`, `sending`, `sent`, `skipped` or `failed`.
- `attempts`, `next_attempt_at`: the retries (§3).
- `last_error`: the reason for a skip or a failure, with anything shaped like an email address replaced by `[address]`.
- `provider_id`: Resend's id for a sent email; the bell notification's id for `in_app`.

Rows hold no address: it's read from the request when the message is sent. Team alerts (new request, promise at risk, promise missed, re-upload received) go to the owner and every active Head of mortgages, each as a bell notification and an email.

```sql
-- Read-only: one file's messages
select n.id, n.kind, n.channel, n.status, n.attempts, n.next_attempt_at,
       n.last_error, n.provider_id, n.created_at, n.sent_at
  from public.mortgage_notifications n
  join public.mortgage_requests r on r.id = n.request_id
 where r.reference = 'BZM-26-0412'
 order by n.created_at;

-- Read-only: the last week at a glance
select kind, channel, status, count(*)
  from public.mortgage_notifications
 where created_at > now() - interval '7 days'
 group by kind, channel, status
 order by kind, channel, status;
```

### The audit log: /admin/audit-log

Admins only. The module writes a row when the Head saves the settings (`mortgage.settings.update`, with the flag before and after), when the Head adds or removes a holiday (`mortgage.holiday.set`, `mortgage.holiday.remove`), and when a partner bank is saved (`mortgage.bank.create`, `mortgage.bank.update`). Nothing else in the module writes one. Changing someone's mortgage role writes none (SR-14). A data-subject request's record is its `dsr_requests` row ("Data-subject requests", below).

Every **Changes data** statement in this runbook writes its own row. This is the shape; the statements below fill it in for you:

```sql
-- Template only. Use the statements in each section, which include it.
insert into public.audit_log (actor_id, actor_kind, action, target_kind, target_id, before, after)
values (
  '<your user id>',              -- your staff.user_id: who ran the SQL
  'user',
  '<action>',                    -- named in each section
  '<target kind>',               -- what you changed, e.g. 'staff'
  '<target id>',                 -- that row's id
  '{"<column>": "<before>"}',
  '{"<column>": "<after>", "reason": "<why>", "agreed_by": "<name>"}'
);
```

- `id` and `at` fill themselves.
- If you have no staff account, use the id of the person who agreed, and add `"run_by": "<your name>"` to `after`.
- Put nothing about the applicant in `before` or `after` except the reference.

---

## 2. Stuck scans

**What you see**

- The applicant, on W5/W6 or W8: a file never shows as ready, so "Get Fast Pre-Approval" (or "Send documents") stays disabled. A submit that gets through anyway answers "Some documents are still being checked. Wait a moment, then try again." After 24 hours W5/W6 says "Your uploads expired after 24 hours…" and they start again.
- The team: C5's "Record response" stays on "Checking the letter…" or says "The letter is still being checked. Try again in a minute." A document that isn't clean shows "Checking" on C2 and "This file is still being checked. It opens once the check is done." in the viewer; the file route answers 409 `not_scanned`.
- The health page: the worker is ok, but its detail reads `0 clean … N waiting`, run after run.

**Why**

Nothing can be attached to a request, opened by staff or sent to a bank until its scan says clean (SPEC §8). The scan runs when the upload completes. If the scanner can't answer (none configured, down, or quiet for 30 seconds), the file stays `pending` and the worker tries it again on its next runs.

Which scanner runs is decided by `scannerFromEnv()` in `lib/mortgage-requests/server/deps.ts`:

- `MORTGAGE_SCANNER=clamd` with `MORTGAGE_CLAMD_HOST` set (and `MORTGAGE_CLAMD_PORT`, default 3310): the ClamAV daemon.
- Anything else, on the production deployment: no scanner. Files wait for good and none can be opened. That's deliberate (fail closed), and it's where production stands until D6 is decided (SR-3).
- `MORTGAGE_SCANNER=dev` passes everything except the EICAR test string. The production deployment refuses it; other deployments don't (SR-24).

A scanner that answers but can't scan a file (any reply but OK or FOUND) marks it `failed`: the file is deleted and the applicant sees "We couldn't check this file. Please upload it again." An infected file is deleted too, and the applicant sees "This file didn't pass our security check. Please upload a different copy."

**Check**

1. The worker line (§1).
2. The variables: `vercel env ls production` for `MORTGAGE_SCANNER`, `MORTGAGE_CLAMD_HOST` and `MORTGAGE_CLAMD_PORT`.
3. That clamd is running and reachable on that host and port, and that its own stream-size limit allows the largest file the bucket takes (40 MB).
4. What is waiting, and where. "In a draft" is an applicant still uploading, or gone:

```sql
-- Read-only
select case
         when f.bank_submission_id is not null then 'bank letter'
         when f.document_id is not null then 'on a request'
         else 'in a draft'
       end as place,
       count(*) as files,
       min(f.uploaded_at) as oldest
  from public.mortgage_files f
 where f.state = 'active' and f.scan_status = 'pending'
 group by 1
 order by 1;
```

5. What was rejected lately. A burst of `failed` points at the scanner, not at applicants:

```sql
-- Read-only
select scan_status, count(*) as files, max(uploaded_at) as latest
  from public.mortgage_files
 where state = 'removed' and scan_status in ('infected', 'failed')
 group by scan_status;
```

**Do**

- Fix the scanner, or its variables. A changed variable takes effect with the next production deployment.
- Once clamd answers, the worker clears the backlog at 20 files every five minutes. Applicants still on the page see their files turn ready by themselves.
- Drafts older than 24 hours are gone, so those applicants must upload again. They have no request yet, so the team can't contact them. A secure link's uploads last as long as the link.
- A long outage means no Fast Pre-Approval can be submitted; consultancy requests still can. The Head can set the flow to staff (§10) until it's fixed.

**Don't**

- Don't set `scan_status` to `clean` by hand, or bring back an `infected` or `failed` file. A file marked clean without a scan can be attached, opened by staff and downloaded by banks.
- Don't set `MORTGAGE_SCANNER=dev` on any deployment that uses the production database. Preview deployments do today.
- Don't choose a scanning service that shares uploads (never VirusTotal; D6).
- Don't take documents by email or WhatsApp instead. Mortgage files live only in the private bucket, where every open is logged.

---

## 3. Emails that didn't arrive or bounced

**What you see**

- An applicant, a team member or a bank says an email never came.
- A CMS action says "The link was made, but the email didn't go. Send a new link to try again." or "The file is with the banks, but the email to {bank} didn't go. Send a reminder from the decision page."
- Open errors shows "mortgage notification gave up after five attempts" (source `mortgage.notify`).

**Why: there are two kinds of email**

| | Queued | Link emails |
|---|---|---|
| Kinds | `applicant_received` (the confirmation), `consultation_booked` (with the calendar invite), `decision_pre_approved` (with the bank's letter), `decision_declined`; the team's `team_new_request`, `team_at_risk`, `team_breached`, `team_reupload_received` | `reupload_request`, `preapproval_invite`, `otp_code` (the code), `bank_package`, `bank_reminder` |
| Sent | by the outbox, right after the action, then by the worker | once, when made |
| Retried | yes, up to five attempts | never. The row is written already final, with `attempts` at 5 |
| Because | the email can be rebuilt from the request | it carries a link whose token exists only in the email; the database keeps a hash |
| Fix | the retries, then a re-queue (below) | a fresh link (below) |

**Queued emails.** After a failure, the next try waits 1, 2, 4, then 8 minutes. The worker runs every five minutes, so five attempts take roughly 20 to 30 minutes. After the fifth failure:

- the row stays `failed` and is never tried again;
- a `notification.failed` event is written;
- "mortgage notification gave up after five attempts" is reported, with the notification id, request id and kind.

A send that died midway is taken back after 10 minutes, unless it was the fifth attempt; that row stays `sending` for good (SR-23).

`skipped` is final. Reasons in `last_error` include "dry run — set EMAIL_DRY_RUN=false to send", "RESEND_API_KEY not set", "whatsapp isn't connected yet" (§4), "the promise is no longer running" (an alarm about a clock that has since paused or stopped, dropped on purpose), "the recipient has no email" and "consultation no longer booked".

**Link emails.** The adviser sees at once when the send failed (the messages above), with two exceptions (SR-25). "Send a reminder" on C5 says "Reminder sent to {bank}." even when the email failed. And C2 reports a bank as failed only when every one of its inboxes failed. A `skipped` send (a dry run, no key) reads as success. Check the outbox.

**Settings that stop every email on the site**, mortgage or not (`lib/email.ts`):

- `EMAIL_DRY_RUN` set to `1`, `true` or `yes`: nothing is sent, in production too. Unset, email is sent wherever `NODE_ENV` is `production`, and nowhere else.
- `RESEND_API_KEY` unset: nothing is sent.
- `RESEND_FROM_ADDRESS` unset, or on a domain Resend hasn't verified: Resend refuses the send, and `last_error` explains why.

**Bounces.** `sent` means Resend accepted the message, not that it arrived. The site gets nothing back from Resend, so a bounce never shows in the CMS. Look the message up in Resend's dashboard by its `provider_id`.

**Check**

1. The file's messages (§1).
2. Messages that won't be tried again. Link emails that failed show here too; tell them apart by `kind`:

```sql
-- Read-only
select r.reference, n.id, n.kind, n.channel, n.status, n.attempts, n.last_error, n.created_at
  from public.mortgage_notifications n
  join public.mortgage_requests r on r.id = n.request_id
 where n.attempts >= 5
   and (n.status = 'failed'
        or (n.status = 'sending' and n.claimed_at < now() - interval '10 minutes'))
 order by n.created_at desc;
```

3. `vercel env ls production` for `EMAIL_DRY_RUN`, `RESEND_API_KEY` and `RESEND_FROM_ADDRESS`.

**Do**

- **Wrong address:** correct it first, with Edit on the file's Applicant card (owner or Head). Every later send reads the address at that moment.
- **A link email:** send a fresh link.
  - Re-upload request: on C2, "Cancel request" beside the document, then open it in the viewer (C4) and "Request re-upload" again.
  - Invite: on C6, "Send a new link". The old, unused link stops working.
  - Code: the applicant presses "Send a new code" (once a minute at most).
  - Bank package or reminder: on C5, "Send a reminder" (at most one per bank every ten minutes).
- **A queued email that gave up, or was skipped by a setting since fixed, and still matters** (a decision, a booking): once the cause is fixed and the file's owner or the Head agrees, an engineer re-queues that one row. The worker sends it within five minutes. Re-queue a `sent` row only after Resend shows it bounced and the address has been corrected. No row back means nothing changed.

> **Changes data.** Engineer only. In production only once the file's owner or the Head of mortgages has agreed.

```sql
-- CHANGES DATA. Re-queue one queued-kind email, with its audit row.
with requeued as (
  update public.mortgage_notifications n
     set status = 'queued', attempts = 0, next_attempt_at = now(), claimed_at = null
    from public.mortgage_notifications old
   where old.id = n.id
     and n.id = '<notification id>'
     and n.channel = 'email'
     and n.kind in ('applicant_received', 'consultation_booked', 'decision_pre_approved', 'decision_declined')
     and (n.status in ('failed', 'skipped', 'sent')
          or (n.status = 'sending' and n.claimed_at < now() - interval '10 minutes'))
  returning n.id, old.status as was_status, old.attempts as was_attempts
)
insert into public.audit_log (actor_id, actor_kind, action, target_kind, target_id, before, after)
select '<your user id>'::uuid, 'user'::public.audit_actor_kind, 'mortgage.notification.requeue',
       'mortgage_notification', q.id,
       jsonb_build_object('status', q.was_status, 'attempts', q.was_attempts),
       jsonb_build_object('status', 'queued', 'reason', '<why>', 'agreed_by', '<name>')
  from requeued q
returning target_id;
```

- **Every email stopped** (a dry run or a missing key in production): fix the variable (it takes effect with the next deployment). Then:
  - re-queue what matters, decisions and bookings; confirmations and team alerts can be left, since the team works from the queue;
  - find the links that were never delivered, and send each a fresh one:

```sql
-- Read-only: link emails skipped during the outage
select r.reference, n.kind, n.created_at, n.last_error
  from public.mortgage_notifications n
  join public.mortgage_requests r on r.id = n.request_id
 where n.channel = 'email'
   and n.status = 'skipped'
   and n.kind in ('reupload_request', 'preapproval_invite', 'bank_package', 'bank_reminder')
   and n.created_at > '<when the outage began>'
 order by n.created_at;
```

**Don't**

- Don't re-queue a link email: its token is gone and the outbox would skip it. Send a fresh link.
- Don't copy an applicant's address into a ticket or a chat, and don't forward a link email to anyone.
- Don't set `EMAIL_DRY_RUN` in production, except to stop all of the site's email during an incident.
- Don't delete outbox rows. Each one is the record that a message went, or didn't.

---

## 4. WhatsApp templates (D1)

**What you see today**

- Every WhatsApp row in the outbox is `skipped`, with "whatsapp isn't connected yet".
- When WhatsApp is ticked, C4's request form, the Decline dialog and C5's decision card say "WhatsApp isn't connected yet, so this goes by email."
- Codes go by email, and W8 shows the masked email address where the design shows a mobile.

Nothing is lost. Wherever WhatsApp is chosen, an email goes too and carries the whole message: the decision functions refuse a send without email, the re-upload and invite actions always email, and a booking's calendar invite goes by both or by neither.

**Why**

There is no WhatsApp Business API sender in the code. `deliver()` in `lib/mortgage-requests/server/notify.ts` records every WhatsApp row as skipped, and `sendLinkCode()` in `lib/mortgage-requests/server/links.ts` always picks email. D5 chose WhatsApp for codes, with email until D1 lands.

**When the Business API is connected**

- It's a build, not a setting: a sender, a webhook for replies and delivery status, and new variables in `lib/env.ts`. The plan is in IMPLEMENTATION.md §1.9.
- It would deliver the WhatsApp rows instead of skipping them, let codes go by WhatsApp, and remove the notes above.
- Outside WhatsApp's 24-hour customer-service window only approved templates can be sent. Staff's own words then go by email, with a template carrying a short notice and the link (SPEC §6).
- Rows already `skipped` are never sent later.

**If Meta rejects a template**

- Nothing breaks: the email carries everything. Today nothing sends WhatsApp at all.
- The drafts are in DECISIONS.md's appendix: `bazar_mortgage_code` (Authentication); `bazar_mortgage_reupload`, `bazar_mortgage_invite`, `bazar_mortgage_consultation`, `bazar_mortgage_preapproved` and `bazar_mortgage_update` (Utility).
- Read Meta's reason. The appendix warns that a utility template that reads as promotional can be reclassified as marketing, so keep the wording transactional.
- Bazar approves the new wording; whoever controls Bazar's Meta Business Manager resubmits it; the appendix is updated to what was approved.
- Arabic templates are separate, and wait for D12.

**Don't**

- Don't read a `skipped` WhatsApp row as a failure. It records that a WhatsApp message was due.
- Don't tell the team WhatsApp works until a real message has gone and its delivery status has come back.

---

## 5. A disputed clock

**What you see**

An applicant says the promise was missed. Or the team thinks a clock is wrong: C1's "24-hour promise" column; on the file, "{remaining} left", "Paused · {remaining} left", "Met · {elapsed}" or "{overdue} overdue"; or a "Promise at risk" or "Promise missed" alarm that seems early or late.

**How the promise works**

- Fast Pre-Approval only. A consultancy request has no clock.
- A budget of 24 working hours (`mortgage_settings.sla_budget_minutes`, 1440), counted against `mortgage_settings.working_hours` minus the dates in `mortgage_holidays`, in Dubai time (D11). The default hours are Sunday to Thursday 09:00–19:00, Friday 09:00–15:00, Saturday closed. So the budget is about two and a half working days: an application sent on a Tuesday at 10:14 is due on Thursday at 14:14.
- **Start:** at submission. `sla_due_at` is fixed then. It's the time W7 showed and the confirmation email gave: "We'll contact you by {due} — 24 working hours from when you submitted." A later change to the hours or holidays never moves it; a pause and resume does.
- **At risk and missed:** at risk with 4 working hours or less left (`sla_risk_minutes`, 240); missed once past `sla_due_at`. Both show on C1 and on the file, and each sends a bell notification and an email to the owner and every Head. The worker checks every five minutes. Each alarm fires once, and again only after a pause and resume.
- **Pause:** a re-upload request moves the file to Awaiting applicant. `sla_paused_at` is set, the working time left is frozen in `sla_remaining_seconds`, and `sla_due_at` is cleared. A second request while already waiting doesn't pause again.
- **Resume:** when the last open re-upload is sent back or cancelled. The new `sla_due_at` is the frozen time counted on from that moment, so the applicant's wait doesn't count against the team. `sla_paused_seconds` totals the calendar time spent paused, for the record only. Nothing sends the applicant the new time.
- **Stop:** a decision, pre-approved or declined (`sla_stopped_at`, `decided_at`, `closed_at`). Met if it stopped by the due time. A file declined while paused keeps the time frozen at the pause.
- The clock runs until a decision. The website and email promise contact ("We'll contact you by"), so a phone call alone doesn't stop it.
- Until design rewords them (D11a), W1's "Within 24 hours" and W7's "24 hours from when you submitted" read as calendar hours, even though W7 shows the working-hours due time. Expect disputes about that wording. If the file was paused, its due time moved later by the time the applicant took, and nothing told them.

**Check**

1. The file's clock:

```sql
-- Read-only
select reference, status, submitted_at, sla_started_at, sla_due_at, sla_paused_at,
       sla_remaining_seconds, sla_paused_seconds, sla_stopped_at,
       sla_risk_notified_at, sla_breach_notified_at, decision, decided_at
  from public.mortgage_requests
 where reference = 'BZM-26-0412';
```

2. Its history:

```sql
-- Read-only
select e.created_at, e.type, e.actor_kind, e.data
  from public.mortgage_events e
  join public.mortgage_requests r on r.id = e.request_id
 where r.reference = 'BZM-26-0412'
   and (e.type in ('request.submitted', 'status.changed', 'reupload.requested',
                   'reupload.fulfilled', 'reupload.cancelled', 'sla.at_risk', 'sla.breached')
        or e.type like 'decision.%')
 order by e.created_at;
```

Read it as stretches of running time:

- The first runs from `request.submitted` to the first `status.changed` whose `data.to` is `awaiting_applicant` (a pause).
- Each later stretch runs from a `status.changed` back to `in_review` with `data.event` `reupload_fulfilled` or `reupload_cancelled` (a resume) to the next pause, or to the decision (`decision.pre_approved` or `decision.declined`).
- `sla.at_risk` and `sla.breached` record the due time in force when they fired (`data.due_at`).
- The working time used is the working time inside those stretches.

3. The calendar:

```sql
-- Read-only
select sla_budget_minutes, sla_risk_minutes, working_hours
  from public.mortgage_settings
 where id = 1;

select day, name, created_at
  from public.mortgage_holidays
 order by day;
```

A holiday shaped a due time only if it was entered (`created_at`) before the clock started or resumed. Removed holidays are gone from the table; the audit log keeps them (`mortgage.holiday.set`, `mortgage.holiday.remove`).

4. The arithmetic. Don't count working hours by hand: use `lib/mortgage-requests/sla.ts`. Save this as `clock.ts` at the repo root, run `npx tsx clock.ts`, then delete it:

```ts
import {
  addWorkingSeconds,
  calendarFromSettings,
  DEFAULT_WORKING_HOURS,
  formatDuration,
  workingSecondsBetween,
} from "./lib/mortgage-requests/sla";

// working_hours from the query above (DEFAULT_WORKING_HOURS if unchanged), and the holiday dates then in force.
const calendar = calendarFromSettings(DEFAULT_WORKING_HOURS, [/* "2026-12-02", … */]);
const started = new Date("2026-09-29T06:14:00Z"); // sla_started_at: Tuesday 29 Sep, 10:14 Dubai

// The due time: 2026-10-01T10:14:00.000Z (Thursday 14:14 Dubai). 24 * 60 * 60 is sla_budget_minutes × 60.
console.log(addWorkingSeconds(started, 24 * 60 * 60, calendar).toISOString());
// Working time used by Wednesday 10:14 Dubai: 10h 00m.
console.log(formatDuration(workingSecondsBetween(started, new Date("2026-09-30T06:14:00Z"), calendar)));
```

**Do**

- Explain the promise with the times from the history: working hours, and the pauses while the applicant had a request open. The Head decides what to tell the applicant.
- If a clock is wrong because of a bug, fix the code. Correct data only through a reviewed migration.
- Holidays: the Head enters them ahead of time on `/admin/mortgages/settings`, under "Public holidays (the promise pauses on these)": Date, Name, then "Add holiday". Each addition or removal writes an audit row.
  - A holiday entered after a clock started doesn't move that file's due time. If it falls before the due time, it shrinks the working time the CMS shows as left, so "at risk" can come sooner.
  - For Eid, enter the expected dates early and correct them when they're announced (D30).
- Working hours show on the settings page but can't be edited there. A change is an engineer's SQL, agreed with the Head, and only affects clocks that start or resume afterwards.

**Don't**

- Don't edit a clock. The trigger `mortgage_requests_guard` rejects any change to `status`, `sla_started_at`, `sla_due_at`, `sla_paused_at`, `sla_paused_seconds`, `sla_remaining_seconds`, `sla_stopped_at` or the decision columns: "status, clock and decision columns change only through mortgage_transition()".
- Don't set the `mortgage.transition` setting yourself to get past the trigger, and don't call `mortgage_transition()` by hand.
- Don't clear `sla_risk_notified_at` or `sla_breach_notified_at`. The trigger doesn't guard them, but clearing them sends the alarms again.
- Don't work deadlines out in calendar hours or in a spreadsheet.

---

## 6. Break-glass access (D10, SR-14)

**What you see**

Someone outside the mortgage team (an admin, an engineer) gets a 404 at `/admin/mortgages` and a 403 from a document link. That's by design: the website promises that only the mortgage team can open documents (D10). Admins are not exempt.

**What break-glass is**

Giving someone a mortgage role (`staff.mortgage_role`) for as long as the job takes, then removing it. There's no screen for roles: it's SQL, and today setting a role writes no audit row (SR-14). The statements below write one.

**When**

Only when the mortgage team can't do the job themselves; for example, an engineer tracing a fault on one file. Ask the Head of mortgages first.

**Who agrees and who reviews**

The Head of mortgages agrees to each grant and reviews it afterwards. D10 leaves the reviewer to Bazar; until Bazar names someone else, it's the Head. The audit log is admin-only, so an admin confirms the two audit rows exist.

**Which role**

| | `adviser` | `head` |
|---|---|---|
| Sees the queue and every file | yes | yes |
| Opens and downloads documents, each logged under their name | yes | yes |
| Acts on a file | only files they own; can claim unassigned ones | any file; can reassign |
| Settings page (the flag, assignment, holidays) | no | yes |
| Partner banks | can change them only if they're an admin | yes |
| Side effect | in round-robin mode, new requests can be assigned to them | gets every team alert, by bell and email |

Use `adviser` unless they must act on a file they don't own.

**Procedure (engineer)**

1. Write down who, which files, why, until when, and who agreed.
2. Find them. They must be `active` (a role counts only for active staff) and have no `mortgage_role`:

```sql
-- Read-only
select user_id, display_name, role, status, mortgage_role
  from public.staff
 where display_name ilike '%<name>%';
```

3. Grant the role. No row back means nothing changed. It takes effect on their next page load, and "Mortgage requests" appears in their menu.

> **Changes data.** Engineer only. In production only once the Head of mortgages has agreed.

```sql
-- CHANGES DATA. Break-glass grant, with its audit row.
with granted as (
  update public.staff
     set mortgage_role = 'adviser'
   where user_id = '<their user id>'
     and status = 'active'
     and mortgage_role is null
  returning user_id, mortgage_role
)
insert into public.audit_log (actor_id, actor_kind, action, target_kind, target_id, before, after)
select '<your user id>'::uuid, 'user'::public.audit_actor_kind, 'staff.mortgage_role_change', 'staff', g.user_id,
       jsonb_build_object('mortgage_role', null),
       jsonb_build_object('mortgage_role', g.mortgage_role, 'break_glass', true, 'reason', '<why>',
                          'files', '<references>', 'until', '<date and time>', 'agreed_by', '<name>')
  from granted g
returning id, at;
```

4. Remove it as soon as the job is done, the same day. If you granted `head`, put `'head'` in both places below.

> **Changes data.** Engineer only.

```sql
-- CHANGES DATA. End a break-glass grant, with its audit row.
with removed as (
  update public.staff
     set mortgage_role = null
   where user_id = '<their user id>'
     and mortgage_role = 'adviser'
  returning user_id
)
insert into public.audit_log (actor_id, actor_kind, action, target_kind, target_id, before, after)
select '<your user id>'::uuid, 'user'::public.audit_actor_kind, 'staff.mortgage_role_change', 'staff', r.user_id,
       jsonb_build_object('mortgage_role', 'adviser'),
       jsonb_build_object('mortgage_role', null, 'break_glass', true, 'reason', 'break-glass ended')
  from removed r
returning id, at;
```

5. Find files that became theirs meanwhile (round robin, or a claim). The Head reassigns each one with "Reassign" on the file's Owner card:

```sql
-- Read-only
select reference, status
  from public.mortgage_requests
 where owner_staff_id = '<their user id>'
   and closed_at is null;
```

6. Review. The engineer lists what they did; the Head reads it alongside each file's Activity card. Every document they opened (`document.viewed`) or downloaded (`document.downloaded`), and every action, is there. Reading a file's page isn't logged.

```sql
-- Read-only. The two times are the audit rows' "at".
select r.reference, e.type, e.created_at
  from public.mortgage_events e
  join public.mortgage_requests r on r.id = e.request_id
 where e.actor_id = '<their user id>'
   and e.created_at between '<granted at>' and '<removed at>'
 order by e.created_at;
```

An admin then confirms both `staff.mortgage_role_change` rows at `/admin/audit-log`.

Setting the team's own roles (§11) uses the same statements, without `break_glass`.

**Don't**

- Don't leave a role in place "in case". Only the mortgage team may open documents.
- Don't give `head` when `adviser` will do.
- Don't reach documents any other way, such as the Supabase dashboard's storage browser or the service role reading the `mortgage-files` bucket. Nothing logs those reads. Open files only in the CMS.
- Don't sign in as a member of the team.

---

## 7. Recording a consent withdrawal (SR-17)

**What you see**

An applicant asks, by email or phone, to withdraw their consent to share their documents with partner banks. Nothing in the CMS can record it yet.

**Why**

Every Fast Pre-Approval stores that consent in `mortgage_consents` (kind `partner_bank_sharing`, with the wording's version and text). A withdrawal is a time in `mortgage_consents.withdrawn_at`. There's no screen for it yet (SR-17: this runbook now, a CMS action later), so it's SQL. The owner or the Head takes the request, the Head agrees, and an engineer records it.

**What stops working** (checked in the SQL)

- Sending the file to banks. C2's "Accept application" is disabled, and `mortgage_transition()` (0147) refuses with "consent is not on file".
- Pre-approving. `mortgage_pre_approve()` (0149) refuses with `no_consent`. C5's Confirm says "Consent isn't on file.", and its consent tile turns red: "Consent isn't on file · Nothing more can be shared with the banks."

**What doesn't stop, today** (SR-22)

- Links the banks already have keep working until they expire (`package_expires_at`: seven days after sending, or after the last reminder). The package page and its downloads don't check consent.
- C5's "Send a reminder" isn't blocked, and it gives the bank a fresh link. Don't press it on this file.
- C2's Consent card still shows the tick and "Given …".
- Declining still works.
- What a bank has already downloaded can't be recalled. The file's Activity shows which bank opened or downloaded what.

**Check**

```sql
-- Read-only
select c.id, c.kind, c.wording_version, c.given_at, c.withdrawn_at, r.reference, r.status
  from public.mortgage_consents c
  join public.mortgage_requests r on r.id = c.request_id
 where r.reference = 'BZM-26-0412';
```

**Do**

1. Record the withdrawal.

> **Changes data.** Engineer only. In production only once the Head of mortgages has agreed.

```sql
-- CHANGES DATA. Record a consent withdrawal, with its audit row.
with withdrawn as (
  update public.mortgage_consents
     set withdrawn_at = now()
   where request_id = (select id from public.mortgage_requests where reference = 'BZM-26-0412')
     and withdrawn_at is null
  returning id, withdrawn_at
)
insert into public.audit_log (actor_id, actor_kind, action, target_kind, target_id, before, after)
select '<your user id>'::uuid, 'user'::public.audit_actor_kind, 'mortgage.consent.withdraw',
       'mortgage_consent', w.id,
       jsonb_build_object('withdrawn_at', null),
       jsonb_build_object('withdrawn_at', w.withdrawn_at, 'reference', 'BZM-26-0412',
                          'asked', '<when and how the applicant asked>', 'agreed_by', '<name>')
  from withdrawn w
returning target_id;
```

2. If the banks' access must stop now, expire the file's open package links. Each bank's page then says "This package link has expired" and its downloads are refused. The banks' recorded answers stay.

> **Changes data.** Engineer only. In production only once the Head of mortgages has agreed.

```sql
-- CHANGES DATA. Expire a file's open package links, with an audit row each.
with expired as (
  update public.mortgage_bank_submissions s
     set package_expires_at = now()
    from public.mortgage_bank_submissions old
   where old.id = s.id
     and s.request_id = (select id from public.mortgage_requests where reference = 'BZM-26-0412')
     and s.status <> 'withdrawn'
     and s.package_expires_at > now()
  returning s.id, old.package_expires_at as was
)
insert into public.audit_log (actor_id, actor_kind, action, target_kind, target_id, before, after)
select '<your user id>'::uuid, 'user'::public.audit_actor_kind, 'mortgage.bank_submission.expire',
       'mortgage_bank_submission', x.id,
       jsonb_build_object('package_expires_at', x.was),
       jsonb_build_object('package_expires_at', now(), 'reference', 'BZM-26-0412',
                          'reason', 'consent withdrawn', 'agreed_by', '<name>')
  from expired x
returning target_id;
```

3. Tell the owner and the Head that nothing more can go to banks from this file, and not to send reminders. What happens to the file next is the Head's call. There's no end state for a withdrawn application yet (D20), and Decline, the only decision left, emails the applicant.

**Don't**

- Don't delete the consent row or change `given_at`. The record of what was agreed, and when, stays.
- Don't change a bank submission's `status` to stop its link: `status` holds the bank's answer. Expire the link as above.
- Don't tell the applicant their documents have been taken back from the banks.

---

## 8. Partner banks

**Where**

`/admin/mortgages/banks` ("Partner banks", linked from C1's header for the Head and for admins on the team). The whole team can read it. The Head of mortgages, or an admin who has a mortgage role, can change it; an admin without a role can't reach it (SR-13). The list starts empty in production (D3): no file can go to a bank until the Head adds some.

**Adding a bank, or changing its inboxes**

- "Add bank", or "Edit" on a row. Fill in Code (2–12 capital letters or digits, as the team says it: FAB), Name, Colour, Order, Package inboxes (one address per line, up to five; each gets the package) and "Offer this bank when sending a file". Then "Save bank".
- An active bank needs at least one inbox. Codes are unique ("Another bank already uses that code.").
- Each save writes an audit row (`mortgage.bank.create` or `mortgage.bank.update`) with the before and after.
- A bank is never deleted, because its submissions point at it. Switch it off instead; C2's send dialog then greys it out.
- New inboxes apply to what's sent next. Packages already sent stay in the old inbox, and their links work until they expire. A reminder goes to the inboxes on file at that moment, so "Send a reminder" (below) puts a fresh link in the new inbox and stops the old one.

**A bank says its link expired**

Package links last `link_expiry_days` (7) days from sending. After that the bank's page says "This package link has expired" and asks it to reply to the email for a new one; replies reach the adviser who sent it. On C5, press "Send a reminder" on that bank's row:

- The bank gets a fresh link for another seven days, and the old one stops working. The row then reads "Reminder sent {time}".
- At most one per bank every ten minutes ("A reminder went to {bank} a few minutes ago.").
- Only while the file is With banks and that bank hasn't answered.
- "Reminder sent to {bank}." shows even if the email failed. If the bank still has nothing, check the outbox for kind `bank_reminder` (§3).

"This package isn't available" means the link was withdrawn (the file was decided while that bank was still deciding) or is incomplete.

```sql
-- Read-only: a file's bank links
select b.code, s.status, s.sent_at, s.reminder_sent_at, s.package_expires_at
  from public.mortgage_bank_submissions s
  join public.mortgage_partner_banks b on b.id = s.bank_id
 where s.request_id = (select id from public.mortgage_requests where reference = 'BZM-26-0412')
 order by b.sort_order;
```

**A bank that never answers**

Nothing times out. The row stays at "Awaiting reply · sent {time}", and the 24-hour promise keeps running: only a decision stops it (§5). In order:

1. "Send a reminder".
2. Call the bank.
3. Decide with what you have. "Confirm pre-approval" on another bank's offer withdraws the banks still deciding, and their links stop working. Or Decline, with "No bank made an offer" if none has.

An answer that arrives after the decision can't be recorded: the file is no longer with the banks.

**Don't**

- Don't email documents to a bank, or forward a package email. Each link belongs to one bank, and every open is logged as that bank.
- Don't change `mortgage_partner_banks` by SQL. The page checks the addresses and writes the audit row.
- Don't press "Send a reminder" to test an inbox: it replaces the link the bank has.

---

## 9. An applicant locked out of a secure link

Secure links (`/mortgages/r/[token]`) are the re-upload request (W8) and the pre-approval invite sent from a consultation. Each works for `link_expiry_days` (7) days. The applicant asks for a six-digit code, sent to the email on the application (D5: email until WhatsApp is connected). A code works for 10 minutes, and a new one can be asked for once a minute. The right code opens the link in that browser for two hours.

**What you see**

The applicant's page says:

| Title | Means |
|---|---|
| "This link is locked" | five wrong codes; locked for good. The file's Activity shows "The secure link locked after five wrong codes" |
| "This link has expired" | seven days have passed |
| "This link doesn't work" | the link was cancelled, replaced by a newer one, or is incomplete |
| "You've already sent this" | the re-upload was sent |
| "You've already applied" | the invite was used. C6's Activity shows "{firstName} applied for Fast Pre-Approval" with the new reference |

A page that asks for a code again after two hours, or when the link is opened from an email app, is expected: the applicant asks for a new code.

**Why**

Five wrong codes lock a link for good. Rate limits are off in production until Upstash is set up (SR-1), so that lock is what stops anyone guessing a code. A locked or expired re-upload link leaves the file in Awaiting applicant with the clock paused. Nothing moves until someone acts.

**Check**

Links that stopped working but haven't been replaced:

```sql
-- Read-only
select r.reference, r.status, l.purpose, l.expires_at, l.otp_attempts
  from public.mortgage_access_links l
  join public.mortgage_requests r on r.id = l.request_id
 where l.revoked_at is null
   and l.used_at is null
   and (l.expires_at <= now() or l.otp_attempts >= 5)
 order by l.expires_at;
```

If codes never arrive: the file's `otp_code` rows in the outbox (§3), and whether the email on the file is right.

**Do: send a new link.** The applicant starts again with a new code.

- **Re-upload (owner or Head):** on C2, "Cancel request" beside the document, and confirm ("Cancel this request?", then "Cancel request"). The clock resumes. Open the document ("Review"), press "Request re-upload", fill in the form and press "Send request to {firstName}". The clock pauses again with the working time that was left.
- **Invite (owner or Head):** on C6, "Send a new link" on the "Ready to apply?" card. The old, unused link stops working. Once the consultation is Completed, C6 offers no link and the database refuses one; the applicant can apply on the website while the flow is public.
- **Wrong email:** correct it first, with Edit on the Applicant card. Codes and links go to the address on file at the moment they're sent.

**Don't**

- Don't reset `otp_attempts`, clear `revoked_at` or push `expires_at` back by SQL. That undoes the only guard against guessing codes.
- Don't ask the applicant to forward the email or read out a code. The link and the code are for them alone.

---

## 10. The feature flag

**What you see**

The application (`/mortgages/apply`) answers 404, or the entry points to it are missing from the site, or are showing when they shouldn't.

**Where it's set**

`/admin/mortgages/settings`, "Who can see the application flow", then "Save settings".

- Head of mortgages only. The page is a 404 for everyone else, admins included, and `mortgage_update_settings()` refuses anyone but the Head.
- Each save writes an audit row (`mortgage.settings.update`, with the flag before and after).
- No deploy is needed.

| Value | Label on the page | The application (W1–W7) and its API | Entry points |
|---|---|---|---|
| `off` | "Nobody (off)" | 404 | hidden |
| `staff` | "Signed-in staff only" | signed-in active staff only, of any role | hidden |
| `public` | "Everyone (live)" | everyone | shown |

- The entry points, shown only while `public`: the home page's "Get pre-approval today", the calculator's "Start pre-approval" and "Talk to advisor" (a link an editor set wins), and "Get mortgage pre-approval" on listings that aren't for rent. While `public`, the calculator's old pre-approval form isn't shown (D25).
- The home page and `/tools/mortgage` update as soon as the flag is saved; listing pages at their next revalidation.
- The Services menu's mortgage item is a megamenu row, edited at `/admin/megamenu`. It doesn't follow the flag (§11).
- Secure links (`/mortgages/r/[token]`) and bank packages (`/mortgages/p/[token]`) work whatever the flag, so switching it off strands nobody mid-review. It also means an invite link still lets an applicant submit a Fast Pre-Approval while the flag is off.
- The CMS works whatever the flag.

**Check**

```sql
-- Read-only: the flag's history
select at, actor_id, before ->> 'flag' as flag_before, after ->> 'flag' as flag_after
  from public.audit_log
 where action = 'mortgage.settings.update'
 order by at desc;
```

**Don't**

- Don't look for it at `/admin/settings/mortgage`: that page holds the calculator's settings.
- Don't set it to `public` before §11's checks have passed.
- Don't change `mortgage_settings.flag` by SQL. The page writes the audit row and refreshes the pages that show entry points.

---

## 11. Going live

At the time of writing, migrations `0138`–`0151` are not in production (PROGRESS.md).

**1. Before anything**

- The blockers are settled: the scanner (D6, SR-3); Turnstile keys (D14, SR-2; without them production answers 503 to every draft and submit); Upstash (D14, SR-1); the security-review fixes approved in Phase 7 step 2; the copy flagged in `lib/mortgage-requests/copy-status.ts` (D11a, D2, D17, D27, D29, FE-1); and D4 and D7.
- Bazar has said who is on the mortgage team, and who is Head (D16).

**2. Apply the migrations, only with Ayush's go-ahead**

- Apply every migration from `supabase/migrations/0138_mortgage_requests.sql` on that isn't in production yet, in filename order, each once, none skipped. Run `npm run db:check` first: it catches duplicate numbers after a rebase.
- They're forward-only: there's no down migration. A mistake is fixed with a new migration, never by editing one that has run.
- Apply them at the batch merge, just before the deploy that ships the module. The mortgage-worker cron starts with that deploy and fails every run until its tables exist. The rest of the CMS and the public pages cope: the mortgage nav item and the entry points just don't show.
- Afterwards, compare `db/types.ts` with what `npm run db:types` produces.
- Then check the settings row. Expect `off`, `round_robin` and `7`:

```sql
-- Read-only
select flag, assignment_mode, link_expiry_days
  from public.mortgage_settings
 where id = 1;
```

- Within five minutes of the deploy, `/admin/settings/health` should show mortgage-worker as ok; mortgage-retention shows after its first night, with nothing deleted until a period is set.

**3. Set up**

- The team's roles, by SQL: the statements in §6 with `'head'` or `'adviser'`, without the break-glass fields (`break_glass`, `files`, `until`), and with the reason "team member". Each change writes its audit row. At least one person must be `head`.
- The Head adds the partner banks and their inboxes (§8) and the public holidays (§5), and checks the settings page.

**4. Production checks**

Work through SECURITY-REVIEW.md §6 and record each result there: the bucket, encryption at rest, the region, the variables (`vercel env ls production`: Turnstile, Upstash, the scanner, Resend, `EMAIL_DRY_RUN` unset, `CRON_SECRET`), an admin without a mortgage role getting 404 and 403, the file and package headers, the gallery, and the flag still `off`.

**5. UAT**

PLAN.md has UAT with the mortgage team on staging, which needs a staging project (D8, open). If UAT has to run on production instead, set the flag to `staff` and treat every test application as real:

- it takes a reference from the one series, which is never reused;
- it emails whatever address is typed in, and alerts the team;
- its activity log is append-only, and removing it needs the erasure path (see "Data-subject requests" below);
- a bank added for testing can't be deleted later, only switched off.

Use the team's own addresses and no real applicant's details. Never point the mortgage e2e specs (`MORTGAGE_E2E_BASE_URL`) at production: they submit real applications.

**6. Switch on**

- `staff` first, for internal use (PLAN.md: internal users, then the public).
- `public` once UAT has passed and the security copy is signed off (D17).
- The same day, point the Services menu's mortgage item at `/mortgages/apply?service=consultancy&from=services_menu` (`/admin/megamenu`). Check the live calculator and home page copy while you're there: editors may have changed it from the defaults.
- Watch the health page, the queue and the outbox for the first days.

To go back, set the flag to `off` (§10). No deploy is needed, and secure links and bank packages keep working.

**Don't**

- Don't apply a migration out of order, twice, or after editing one that has run.
- Don't run `npm run db:seed` (it writes to the remote project, which is production), and don't load the local mortgage seed there.
- Don't switch to `public` while the scanner or the Turnstile keys are missing: no Fast Pre-Approval can be submitted, and without Turnstile every application answers 503.

---

## Data-subject requests (export and erasure)

**Where**

`/admin/dsr` ("Data-subject requests"), the platform's tool, admins only. Requests arrive at the address the privacy notice gives; verify the requester controls the address before either action.

- **Email address:** the address the request came from. It finds the subject's mortgage requests with everything else Bazar holds.
- **UAE mobile (optional):** also finds mortgage requests made with another address. Enter it only once you know the number is theirs: it matches any request with that mobile.

**Export** ("Build access archive")

- The archive downloads to your machine; send it from the DPO mailbox yourself. Nothing is emailed automatically.
- Its `mortgage_requests` section has, for each request: the details the applicant gave, the consents (with the IP address and browser they were given from), each document's status and what the team recorded from it, its files by name and size, the banks it was sent to with their answers, the decision and the message sent, consultations, the contact log, re-upload requests, and the activity's kinds and dates. Staff aren't named.
- **The documents themselves aren't in it.** If the subject asks for copies, the file's owner or the Head downloads each in the CMS viewer (every download is logged) and they go from the DPO mailbox.
- Each request's activity gets a `dsr.exported` line.

**Erasure** ("Erase all data")

- **Mortgage requests are deleted outright,** unlike the platform's other tables, which keep AML-relevant rows with their personal fields wiped. The documents and the banks' letters leave the bucket first; then the requests go with their consents, secure links (and their unsent uploads), bank submissions, consultations, contact log, outbox rows and activity log. An open file disappears from the queue, and banks still deciding lose their links.
- The result names what went: "mortgage requests deleted: N (references), with N files". If a request had gone to partner banks, it also says "already sent to {banks}, which Bazar can't recall". Say so in the reply to the subject; if they want a bank to delete its copy, they (or the Head, at their request) ask that bank.
- **If it fails** ("The mortgage requests couldn't be erased (…). Nothing was changed; try again."), run it again. Files deleted before the failure stay deleted; the rows are still there until a run completes. Erasing the platform's tables only happens after the mortgage part succeeds.
- **D7 caution.** Whether the UAE AML record rule covers these files is still open. Until compliance answers, ask the Head (and compliance) before erasing a pre-approved file, or one with banks' letters, and record their answer in the reply.

**The record**

Each export or erasure writes a `dsr_requests` row. For an erasure its `payload.mortgage` holds the references, the number of files and activity lines deleted, and which banks had a package — that row is the evidence the request was handled.

```sql
-- Read-only: what an erasure recorded
select kind, status, fulfilled_at, payload -> 'mortgage' as mortgage
  from public.dsr_requests
 where email = '<the subject''s email>'
 order by created_at desc;
```

**Don't**

- Don't delete mortgage rows by SQL to "erase" someone. The activity log refuses it, and only the erasure path deletes the files from the bucket too; rows deleted without their files would leave the documents behind, unfindable.
- Don't paste an archive, an email address or a mobile into a ticket or a chat.

## Retention

**What it does**

`/api/cron/mortgage-retention`, daily at 22:30 UTC (02:30 in Dubai). For every request closed (pre-approved, declined or completed) more than `mortgage_settings.retention_months` months ago, it deletes the files — the applicant's documents and the banks' letters — from the bucket, then keeps each file's row as `removed`, with its name replaced by "deleted", and adds "files purged" (`files.purged`) to the request's activity. The request itself, its details, what was recorded from its documents and its activity stay. A run clears up to 2,000 files; any more are cleared on the following nights.

**Today it's off.** `retention_months` is null until compliance decides the period (D7), and the job deletes nothing. The health page line says so, and the Head's settings page shows "Kept until compliance sets how long (decision D7). Nothing is deleted."

**Setting the period** (engineer, once compliance has decided and Ayush has agreed)

1. See what the first run would delete. Use the months compliance decided:

```sql
-- Read-only
select count(*) as files, count(distinct request_id) as requests
  from public.mortgage_retention_files(<months>, 1000);
```

2. Set it. The first run is the next night. **Deleted files can't be restored**: the bucket has no copy.

> **Changes data.** Engineer only. In production only once compliance has decided D7 and Ayush has agreed.

```sql
-- CHANGES DATA. Set the retention period, with its audit row.
with changed as (
  update public.mortgage_settings s
     set retention_months = <months>
    from public.mortgage_settings old
   where s.id = 1 and old.id = 1
  returning old.retention_months as was, s.retention_months as now_months
)
insert into public.audit_log (actor_id, actor_kind, action, target_kind, target_id, before, after)
select '<your user id>'::uuid, 'user'::public.audit_actor_kind, 'mortgage.settings.retention',
       'mortgage_settings', '00000000-0000-0000-0000-000000000000',
       jsonb_build_object('retention_months', c.was),
       jsonb_build_object('retention_months', c.now_months, 'decided_by', '<compliance decision>', 'agreed_by', '<name>')
  from changed c
returning id, at;
```

3. The morning after, check the health page's mortgage-retention line and a closed file's activity.

**Turning it off** is the same statement with `null`. Files already deleted stay deleted.

**Don't**

- Don't shorten the period to "catch up": a request closed longer ago than the new period is deleted at the next run.
- Don't delete files by hand, or in the Supabase dashboard's storage browser: their rows would still point at them, and nothing records the deletion.
