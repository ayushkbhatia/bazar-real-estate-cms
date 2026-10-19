# ADR-0009: The site sends its own newsletter through Resend; Mailchimp is retired

Date: 2026-10-15
Status: Accepted
Deciders: Engineering, Client

Supersedes the campaign half of [ADR-0004](ADR-0004-postgres-newsletter-with-mailchimp-campaigns.md).
Its first half — Postgres `newsletter_subscribers` as the source of truth —
stands, and is what this builds on.

## Context

ADR-0004 kept Mailchimp as the place campaigns were written and sent, with a
two-way sync to the Postgres list. In production that half was never
switched on: no Mailchimp credentials were ever set, so subscribers never
reached it and no newsletter could be sent at all.

Meanwhile every other email the site sends already goes through Resend, with
an editor (Content assets) that writes branded, bilingual, previewable email.
The client asked for exactly that for the newsletter (15 Oct 2026): "Let's
not use Mailchimp. We already have the newsletter sending ability through
the Resend subscription … build our own newsletter build feature, similar to
the content assets builder."

## Decision

- Newsletters are written, previewed, tested and sent from
  `/admin/newsletter`, reusing the Content assets editor, sanitiser, render
  pipeline and email design (docs/NEWSLETTER.md).
- Delivery is Resend batch sends (100 per call, idempotency-keyed), drained
  from a `newsletter_deliveries` queue by a minute cron, each message carrying
  the subscriber's own unsubscribe link and RFC 8058 one-click headers.
- The public subscribe, confirm and unsubscribe flows stop calling Mailchimp.
  `lib/mailchimp.ts`, its webhook and the settings entry were left in place
  and inert at first, and removed in the follow-up. The `mailchimp` value
  stays in the `integration_kind` enum, with its disconnected row; nothing
  reads it.

## Consequences

- One system for every email, one list, one DSR surface: deliveries hold no
  address and cascade on the subscriber's deletion.
- What Mailchimp would have offered and this does not: open/click
  analytics, A/B tests, segments beyond language. Resend's webhooks can add
  delivery, bounce and complaint events later (docs/NEWSLETTER.md follow-ups).
- Sending volume is bounded by the Resend plan; the sender paces itself to
  Resend's default two requests a second.
