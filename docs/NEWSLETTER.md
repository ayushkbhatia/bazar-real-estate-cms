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

## Where people sign up

Two boxes, one form: the /insights hero and the box under every article
(`insights/[slug]/_components/article-newsletter.tsx`). Both take their
button, placeholder and confirmation from the `insights_newsletter` form
(/admin/forms) and their eyebrow, heading and blurb from the Insights master
page's `featured` section (/admin/pages/master/insights), so an edit there
words both, in English and Arabic. Their sign-ups are told apart by `source`:
`insights_header` and `insights_article`.

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

## Delivery events

"Delivered to Resend" only says Resend accepted a message. What happened next
comes back from Resend's webhook, `POST /api/webhooks/resend`, subscribed to
`email.delivered`, `email.bounced` and `email.complained` for every email the
site sends:

- The route checks the Svix signature (`svix-id`, `svix-timestamp`,
  `svix-signature`, five minutes' tolerance) against `RESEND_WEBHOOK_SECRET`.
  Without the secret it refuses everything.
- Each event goes to `newsletter_record_email_event()` (0164, service role
  only). It stamps `delivered_at` / `bounced_at` + `bounce_type` /
  `complained_at` on the newsletter delivery whose `resend_id` matches, which
  is where the campaign report's **Reached the inbox / Bounced / Marked as
  spam** come from.
- A **permanent** bounce on any email to a subscriber's address (the
  confirmation email included) marks them `bounced`, so no campaign mails
  them again. Transient bounces change nothing.
- A **spam complaint** about a newsletter unsubscribes its reader.
- Only `pending` and `confirmed` subscribers change. Every write is a
  coalesce or a guarded status change, so Resend's retries are harmless. A
  bounced address that signs up again goes back to `pending`.

Setting it up (done once per Resend account): create the webhook for the
production URL with those three events — the Resend dashboard, or
`resend.webhooks.create` — then set its `whsec_…` signing secret as
`RESEND_WEBHOOK_SECRET` in Vercel production and redeploy.

## Unsubscribing

Every subscriber has a permanent `unsubscribe_token` (0162). It is what the
footer link, the header and the welcome email use. The old flow used the
confirmation token, which confirming cleared — so every confirmed
subscriber's unsubscribe link was dead. Legacy links that still carry a
confirmation token keep working.

`POST /api/newsletter/unsubscribe?token=…` is the one-click endpoint the
`List-Unsubscribe-Post` header points mail clients at;
`/newsletter/unsubscribe/[token]` is the page a person lands on. The page
only reads: it shows the address and an **Unsubscribe** button, and the
button does the unsubscribing. Mail scanners and link previewers open every
URL in an email, so a page that unsubscribed as it rendered removed people
who never asked to go.

## Data and privacy

- `newsletter_deliveries` stores no address — only the subscriber id — and
  cascades on the subscriber's deletion, so a data-subject erasure (which
  deletes the subscriber row) removes their delivery history too.
- No PII in logs: addresses are masked as everywhere else in `lib/email.ts`.

## Files

| | |
|---|---|
| `supabase/migrations/0162_newsletter_campaigns.sql` | token column, campaigns, deliveries, the two SQL functions, RLS |
| `supabase/migrations/0164_newsletter_delivery_events.sql` | delivery event columns, `newsletter_record_email_event()` |
| `lib/newsletter/events.ts` | webhook signature check and event parsing |
| `app/api/webhooks/resend/` | the delivery-event webhook |
| `lib/newsletter/campaign.ts` | types, schema, audience, render (shared by preview, test and send) |
| `lib/newsletter/send.ts` | start, drain, finish — the sender |
| `lib/email.ts` | `headers` on a send; `sendEmailBatch` |
| `app/api/cron/newsletter-send/` | the minute cron |
| `app/api/newsletter/unsubscribe/` | one-click unsubscribe |
| `app/[locale]/(admin)/admin/newsletter/` | Campaigns, the composer, Subscribers |

## Follow-ups

- **Opens and clicks.** Resend can report both (`email.opened`,
  `email.clicked`), but open tracking adds a pixel and click tracking rewrites
  every link through Resend's domain. Not switched on; a decision for the
  client, and the privacy policy would need to say so.
