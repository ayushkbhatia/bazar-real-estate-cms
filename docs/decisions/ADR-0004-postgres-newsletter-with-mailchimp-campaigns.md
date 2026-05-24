# ADR-0004: Postgres as the newsletter source of truth; Mailchimp as the campaign surface

Date: 2026-05-22 · Revised 2026-05-24
Status: Accepted
Deciders: Engineering, Marketing

## Context

The original spec named Mailchimp as the newsletter provider —
managing subscribers, sending the Bazar Brief, and running any future
audience segmentation or A/B testing.

Two problems with Mailchimp-only:

1. **PDPL / DSR surface.** A Mailchimp list is one more place a
   delete-my-data request has to reach, with its own API surface and
   audit trail. Our compliance flows had to cover Postgres anyway;
   Mailchimp doubled that work.
2. **Source-of-truth ambiguity.** If a subscriber confirms in
   Mailchimp but the Bazar CRM doesn't know, every cross-table query
   ("which subscribers also have an open enquiry?") needs a Mailchimp
   API call.

We also need Mailchimp's campaign tooling — segmentation, template
editor, deliverability dashboard — for marketing to do their job. We
shouldn't rebuild any of that in-house.

## Decision

**Two-layer architecture, both shipped:**

1. **Postgres `newsletter_subscribers` is the source of truth.** The
   `subscribeToNewsletter()` server action upserts a `pending` row,
   emits a confirmation email through **Resend**, and a confirm route
   flips the row to `confirmed`. Unsubscribes flip it to
   `unsubscribed`. DSR delete cascades through this table.
   ([app/(public)/_actions/newsletter.ts](../../app/(public)/_actions/newsletter.ts))

2. **Mailchimp is the campaign surface.** Every Postgres state change
   syncs to Mailchimp through `lib/mailchimp.ts`. A `/api/webhooks/mailchimp`
   endpoint receives `unsubscribe`, `cleaned`, and `subscribe` events
   from Mailchimp and writes them back into Postgres, so both lists
   converge regardless of where the change originated.

Marketing schedules and sends campaigns from Mailchimp using the synced
list. Transactional emails (confirmation, welcome, unsubscribe receipt,
DSR notifications) go through Resend so they don't depend on Mailchimp
being configured.

## Consequences

- Postgres is queryable as a CRM. JOINs against `enquiries`, `accounts`,
  and `deals` work without ETL.
- DSR delete walks one table. The Mailchimp sync layer applies the same
  unsubscribe-by-email signal it would for any other unsubscribe; the
  audit trail still lives in Postgres.
- Marketing keeps Mailchimp's template editor, segmentation, A/B
  testing, deliverability dashboard. We don't rebuild any of that.
- The webhook is a real surface to operate. It's verified by a shared
  secret in the URL (`?secret=`) and degrades to 200-OK with `skipped`
  payload when Supabase isn't configured.
- Two systems mean two failure modes: Mailchimp could be unreachable
  during a confirm (transactional Resend still fires, sync is
  best-effort and retried by the webhook), or our webhook receiver
  could fail to update Postgres after a Mailchimp-side action (a
  reconciliation job can be added if this becomes a real problem).

## When to revisit

- If Mailchimp deliverability degrades and we can't diagnose with
  Resend logs alone.
- If marketing stops using Mailchimp's segmentation in earnest — at
  which point a self-hosted broadcast tool becomes attractive again.
- If the webhook receiver shows real drift between Mailchimp and
  Postgres state, we add a daily reconciliation cron.

## Alternatives considered

- **Mailchimp as the only list.** Rejected on DSR surface and
  source-of-truth ambiguity.
- **Postgres + Resend only, no Mailchimp.** Originally proposed in the
  Sprint 2 hardening pass; Sprint 13 reversed by adding Mailchimp
  back as the campaign surface so marketing keeps its tooling without
  giving up the Postgres source-of-truth.
- **ConvertKit / Buttondown.** Friendlier API but same DSR
  consideration; Mailchimp wins on marketing-team familiarity.
- **Self-hosted (Listmonk).** A third vendor to run. Wrong fit.
