# Mortgage sample data (for a demo)

Sample mortgage requests in a deployed stack, so the client can walk the
team's CMS end to end (C1 queue, C2/C6 files, the C3/C4 viewer, C5 decision,
the bank package page) before any real application exists. They are the CMS
designs' requests — the same data as the local seed — written by the demo mode
of [`scripts/db-local/seed-mortgage.ts`](../db-local/seed-mortgage.ts).

**Production holds a sample since 1 Oct 2026** (docs/mortgage/PROGRESS.md).
Erase it before the flag goes `public` (RUNBOOK §11).

## What a sample is

- Its reference is `BZM-yy-9xxx` (the designs' `BZM-26-0412` becomes
  `BZM-26-9412`), which the reference counter won't reach, so the counter isn't
  touched; and its applicant's email is `@example.com`, which can't receive
  mail. `sample.ts` needs both, and the scripts act on nothing else.
- Its files belong to existing team members (`MORTGAGE_DEMO_OWNERS`); no login
  is created, and no role, hours, setting or the flag changes.
- Nothing is sent when it's seeded: the team's "new request" alerts are marked
  skipped, and each 24-hour clock counts as already alerted, so the SLA tick
  emails nobody about a sample.
- Its bearer tokens are random. The bank package links are written to the
  manifest, so the bank's view can be shown; the re-upload link (W8) isn't
  kept, since its code would go to an `@example.com` inbox.
- Its partner banks are FAB, ADCB and Mashreq with `@example.com` inboxes,
  unless the stack already has banks with those codes, which are then used.
- Its files' bytes are placeholders (a PDF per page count naming the
  document, a card-shaped PNG for a photo), marked clean without a scan: we
  made them.

**While a sample exists:** what the team does to it is real. A decision, a
re-upload request, an invite, a send to banks or a reminder emails the
`@example.com` addresses, which bounce. Don't give the sample banks real
inboxes, or send a sample to a real bank: it would get a working package link
to the sample.

## Seed

```bash
# Who owns what: the designs' Head (Yasmin) and advisers (Rashid, Leena) → real team members.
export MORTGAGE_SEED_MODE=demo
export MORTGAGE_DEMO_MANIFEST=/tmp/mortgage-demo.json
export MORTGAGE_DEMO_OWNERS='{"yasmin":{"id":"<user id>","name":"<name>"},"rashid":{…},"leena":{…}}'
npx tsx scripts/db-local/seed-mortgage.ts > /tmp/mortgage-demo.sql
```

The SQL is one transaction. Run it as the database owner, since it sets
`mortgage.transition` to write statuses and clocks:

- **Local stack:** `docker exec -i supabase_db_bazar-local psql -U postgres -d postgres -v ON_ERROR_STOP=1 < /tmp/mortgage-demo.sql`
- **Production:** the Management API with the project's access token
  (`.env.local`):
  `jq -Rs '{query:.}' < /tmp/mortgage-demo.sql | curl -sS -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' --data-binary @- "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query"`

Then the files' bytes, with the stack's service-role key. Production's comes
from `.env.local`; locally, pass `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
from `supabase status --workdir scripts/db-local -o env`:

```bash
(set -a; source .env.local; set +a; npx tsx scripts/mortgage-demo/upload-files.ts /tmp/mortgage-demo.json)
```

It uploads only the manifest's files, refuses any that isn't a sample's, and
never overwrites, so a rerun only fills gaps. Seeding twice fails on the
references (one transaction, nothing written): clear first.

Clocks are set relative to the moment of seeding, as the local seed's are, so
the queue shows the designs' remaining times then; they run on from there.
Package links expire seven days after their "sent" time.

## Clear

```bash
(set -a; source .env.local; set +a; npx tsx scripts/mortgage-demo/clear.ts)         # lists the sample
(set -a; source .env.local; set +a; npx tsx scripts/mortgage-demo/clear.ts --yes)   # erases it
```

Erases every sample request through the functions the DSR tool uses (0151):
the files from the private bucket first, then the rows, activity log
included. Then the sample banks, once no submission points at one.
