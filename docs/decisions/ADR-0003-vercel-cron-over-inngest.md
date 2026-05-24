# ADR-0003: Vercel Cron with Bearer secret instead of Inngest

Date: 2026-05-22 · Revised 2026-05-24
Status: Accepted, with a known gap (see Follow-up)
Deciders: Engineering

## Context

The original spec named Inngest as the background-job platform for
both scheduled tasks (saved-search alerts, viewing reminders) and
event-driven follow-ups (deal-stage-changed emails, "new comparable"
fan-out).

Inngest gives us durable execution: a job can crash, be retried, and
its state is checkpointed externally. It also gives us a real workflow
UI for the ops team.

Against that, Inngest is one more vendor account, one more secret, and
one more place to look during an incident. Each individual job in
scope today is idempotent and fits in a single function execution —
it doesn't need durable workflow state, it needs to run on schedule.

## Decision

Use **Vercel Cron Jobs** ([vercel.json](../../vercel.json)) calling
Next.js route handlers under `app/api/cron/*`. Authenticate each call
with an `Authorization: Bearer ${CRON_SECRET}` header that Vercel sets
when the cron is configured.

The cron set as of Sprint 13 (13 jobs):

| Schedule | Job |
|---|---|
| Every minute | `enquiry-auto-reply` |
| Every 5 min | `enquiry-escalation` |
| Every 15 min | `saved-search-alerts-diff` |
| Hourly | `viewing-reminders` |
| Daily 02:00 | `meilisearch-sync` |
| Daily 03:00 | `embeddings-backfill` |
| Daily 04:00 | `saved-search-alerts?frequency=daily`, `syndication-push` |
| Daily 05:00 (Mon) | `dld-import` |
| Daily 06:00 | `brn-validation`, `permit-expiry` |
| Daily 08:00 | `post-valuation-nurture` |
| Weekly Mon 04:00 | `saved-search-alerts?frequency=weekly` |

Event-driven follow-ups (deal-stage emails) run inline inside the
server action that mutates state, with the email send wrapped in
try/catch so the mutation completes even if the email provider is
down.

## Consequences

- Zero additional vendor or dashboard. The cron schedule lives in
  `vercel.json` next to the code that runs.
- **No retries.** If a cron run errors, Vercel logs it but doesn't
  replay. In practice each handler is idempotent (`processed_at`
  guards) so a re-run on the next tick fixes it — but the
  detection layer is missing.
- **The silent-failure surface is now bigger.** With minute-cadence
  and 5-minute-cadence jobs, a misconfigured Bearer secret or a
  Vercel deploy that 500s the route can go unnoticed for hours.
- Cost: free at Vercel's current tier (we're well under the 100 cron
  invocations/day limit on Pro, which we have).
- No durable workflow state. We can't pause a multi-step job
  mid-way. None of the jobs in scope require that today.

## Follow-up — TODO

Add a `cron_runs` audit-log row on every invocation (success or
failure) so the SQL is queryable: "did saved-search-alerts run in the
last hour?" Alert from there. Tracked in the engineering backlog;
priority went up after Sprint 12's cron count doubled.

## When to revisit

- If we add a multi-step workflow that can't fit in a single function
  call (e.g., a property's image pipeline).
- When the silent-failure cost catches us in production for the first
  time — that's the trigger.
- If email retries become a regular need rather than the exception.

## Alternatives considered

- **Inngest** — strongest durability story. Right call once we have
  multi-step workflows or we stop being able to absorb silent-failure
  risk.
- **Trigger.dev** — similar shape; same trade-offs as Inngest.
- **Supabase Edge Functions with pg_cron** — keeps everything in the
  database but loses Vercel's deployment model and complicates preview
  environments.
