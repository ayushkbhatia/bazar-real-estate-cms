# Newsletter

The site's own newsletter: a subscriber list, a composer, and a sender, all in
`/admin/newsletter`, delivered through Resend. Mailchimp is not used
([ADR-0009](decisions/ADR-0009-own-newsletter-sender-over-mailchimp.md)).

## What an editor does

1. **Newsletter → New newsletter.** A draft opens in the composer.
2. **Write** — subject, preview line and body in the same rich-text editor the
   Content assets emails use (headings, lists, links, buttons, images, fields).
   An optional **Arabic edition** (subject + body); Arabic subscribers get it,
   and get the English when it's blank.
3. **Audience** — every confirmed subscriber, English only, or Arabic only,
   with the live count beside each.
4. **Review** — the real email in a desktop / phone frame, English and Arabic,
   and **Send me a test** to the signed-in address.
5. **Send** — now, or scheduled for a date and time. Sending asks for the
   recipient count to be confirmed.
6. The campaign's page then shows progress: queued / sent / failed / skipped.

**Subscribers** lists everyone who signed up — status, language, source,
dates — filterable and searchable, with **Re-send confirmation** for anyone
still pending (per row, or every pending address at once) and **Unsubscribe**
for anyone who asks by other means.

## Who may do what

| | admin | marketing | editor | others |
|---|---|---|---|---|
| View subscribers and campaigns | ✓ | ✓ | ✓ | — |
| Draft, edit, preview, send a test | ✓ | ✓ | ✓ | — |
| Send / schedule to the list | ✓ | ✓ | — | — |
| Re-send confirmation, unsubscribe someone | ✓ | ✓ | — | — |

Enforced twice: `requireRole` in every action, and RLS on the tables
(`current_staff_role()`).

## How sending works

- **Start.** `newsletter_start_campaign(id)` (SQL, migration 0162) snapshots
  the audience into `newsletter_deliveries` — one row per confirmed subscriber
  in the chosen language(s), unique per campaign — and marks the campaign
  `sending`. A scheduled campaign is started by the cron once its time comes.
- **Drain.** `drainNewsletterQueue()` claims up to 100 queued deliveries
  (`newsletter_claim_deliveries`, `FOR UPDATE SKIP LOCKED`, so two runs never
  take the same row), renders each recipient's email in their language, and
  sends them as one Resend batch with an idempotency key. The send action
  drains once straight away; `/api/cron/newsletter-send` (every minute) drains
  the rest, starts due schedules and closes finished campaigns.
- **Per recipient.** Each email carries that subscriber's own unsubscribe link
  in the footer and as `List-Unsubscribe` / `List-Unsubscribe-Post` headers
  (one-click, RFC 8058) — mailbox providers require both for bulk mail.
- **Safety.** A subscriber who unsubscribed after the snapshot is skipped at
  send time. A failed batch is retried up to three times, then marked failed.
  Outside production, delivery is a dry run (`EMAIL_DRY_RUN`), and every
  delivery is marked `skipped` rather than `sent`.
- **Done.** When nothing is left queued or in flight, the campaign is `sent`
  with its totals.

## Unsubscribing

Every subscriber has a permanent `unsubscribe_token` (0162). It is what the
footer link, the header and the welcome email use. The old flow used the
confirmation token, which confirming cleared — so every confirmed
subscriber's unsubscribe link was dead. Legacy links that still carry a
confirmation token keep working.

`POST /api/newsletter/unsubscribe?token=…` is the one-click endpoint the
`List-Unsubscribe-Post` header points mail clients at;
`/newsletter/unsubscribe/[token]` is the page a person lands on.

## Data and privacy

- `newsletter_deliveries` stores no address — only the subscriber id — and
  cascades on the subscriber's deletion, so a data-subject erasure (which
  deletes the subscriber row) removes their delivery history too.
- No PII in logs: addresses are masked as everywhere else in `lib/email.ts`.

## Files

| | |
|---|---|
| `supabase/migrations/0162_newsletter_campaigns.sql` | token column, campaigns, deliveries, the two SQL functions, RLS |
| `lib/newsletter/campaign.ts` | types, schema, audience, render (shared by preview, test and send) |
| `lib/newsletter/send.ts` | start, drain, finish — the sender |
| `lib/email.ts` | `headers` on a send; `sendEmailBatch` |
| `app/api/cron/newsletter-send/` | the minute cron |
| `app/api/newsletter/unsubscribe/` | one-click unsubscribe |
| `app/[locale]/(admin)/admin/newsletter/` | Campaigns, the composer, Subscribers |

## Follow-ups

- **Delivery events.** Resend webhooks (delivered, bounced, complained) could
  mark subscribers `bounced` and show delivery rates per campaign.
- **Retire Mailchimp code.** `lib/mailchimp.ts`, its webhook route and the
  integrations-panel entry are inert; remove them.
- **Unsubscribe on GET.** `/newsletter/unsubscribe/[token]` unsubscribes as
  the page renders, so a link scanner that opens it removes the subscriber.
  The one-click POST endpoint doesn't have this problem; the page could ask
  for a click.
