# Integrations onboarding

This document is the client-handover checklist for every external
service Bazar Real Estate talks to. Every integration is optional —
the app boots and renders without any of them. As keys land, features
light up. Order below matches priority for launch.

## At-a-glance

| Integration | Env vars | Used by | Sprint |
|---|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | All persistence + auth | 0 |
| Resend | `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `RESEND_REPLY_TO` | All transactional email | 0 |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` | Error tracking | 0 |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Product analytics (consent-gated) | 0 |
| Anthropic | `ANTHROPIC_API_KEY` | `/concierge` AI chat | 5 |
| Cron secret | `CRON_SECRET` | Vercel cron Bearer auth | 8 |
| WhatsApp deep links | `NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER`, `NEXT_PUBLIC_WHATSAPP_MORTGAGE_NUMBER` | All WhatsApp CTAs | 4 |
| Meilisearch | `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY`, `NEXT_PUBLIC_MEILISEARCH_HOST`, `NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY` | `/buy`, `/rent`, `/off-plan`, `/commercial` search | 12 |
| Voyage AI | `VOYAGE_API_KEY` | `/concierge` semantic search | 12 |
| Mapbox | `NEXT_PUBLIC_MAPBOX_TOKEN` | Address typeahead, isochrones, HQ map | 12 |
| Property Finder | `PROPERTY_FINDER_FEED_TOKEN` | XML feed at `/api/feeds/property-finder.xml` (rewrites to `/api/feeds/property-finder`) | 13 |
| Bayut | `BAYUT_FEED_TOKEN` | XML feed at `/api/feeds/bayut.xml` (rewrites to `/api/feeds/bayut`) | 13 |
| Mailchimp | `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID`, `MAILCHIMP_DC`, `MAILCHIMP_WEBHOOK_SECRET` | Newsletter signup + webhooks | 13 |
| DocuSign | `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_BASE_URL`, `DOCUSIGN_WEBHOOK_SECRET` | Envelope creation + signed-doc callbacks | 13 |
| DLD open data | (uses `dld_open_data.config.csv_url` on the integrations table) | `/tools/valuation` comparables | 13 |
| WhatsApp Cloud API | (deferred) | Phase 6+ | post-launch |

The status of each integration in production is visible at
`/admin/settings/integrations`.

## Supabase

Required for everything. Create a fresh project at
https://supabase.com/ and set:

- `NEXT_PUBLIC_SUPABASE_URL` — `https://<ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key (safe to expose)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (NEVER expose; used
  by crons + webhooks only)

Then apply every file in `supabase/migrations/`, in filename order, via the
Supabase CLI or MCP. Run `npm run db:types` after the project is wired
to regenerate `db/types.ts` (this also lets us delete the manual
type stubs in `lib/types/sprint-8.ts`).

## Resend

Transactional email. Sign up at https://resend.com/.

- `RESEND_API_KEY` — server-only, starts `re_…`
- `RESEND_FROM_ADDRESS` — `hello@bazar.ae` or `Bazar <hello@bazar.ae>`
- `RESEND_REPLY_TO` — where replies land (e.g. `hello@bazar.ae`)

**The sender's domain must be verified in Resend before anyone but the
account owner can receive mail.** Until then Resend rejects every send with
"You can only send testing emails to your own email address", and the app
surfaces that verbatim. Verification is per-account and does **not** transfer
when the API key is swapped — see the handover note below.

Setup order matters:

1. Add the domain at https://resend.com/domains and publish the three DNS
   records it gives you (DKIM `TXT` on `resend._domainkey`, plus `MX` and SPF
   `TXT` on the `send` subdomain). The records live on a subdomain, so they
   don't collide with existing mailboxes on the apex.
2. Wait for the domain to report `verified` — DKIM is the slow one.
3. Only then set `RESEND_FROM_ADDRESS` to an address on that domain, in
   `.env.local` **and** in Vercel (Production + Preview), and redeploy.

Note for local dev: `.env.local` is per-worktree and gitignored, so a git
worktree gets its own copy. Setting the variable in one checkout does not
affect a dev server running out of another.

Supabase Auth's own emails (sign-up confirmation, magic link) are a separate
delivery system and do **not** go through `lib/email.ts`. They're sent by
Supabase's SMTP, configured under Auth → SMTP Settings, and are governed by
`site_url` and `uri_allow_list` rather than anything in this repo.

## Sentry

Error tracking. Sign up at https://sentry.io/.

- `NEXT_PUBLIC_SENTRY_DSN` — browser DSN (same project)
- `SENTRY_DSN` — server DSN (same project)

User context is automatically attached on signed-in pages via
`instrumentation-client.ts`.

## PostHog

Analytics. Sign up at https://posthog.com/. PostHog only initialises
after the cookie banner is accepted (see `app/_consent/`).

- `NEXT_PUBLIC_POSTHOG_KEY` — project key, starts `phc_…`
- `NEXT_PUBLIC_POSTHOG_HOST` — e.g. `https://us.i.posthog.com`

## Anthropic Claude

Powers the `/concierge` chat. Sign up at
https://console.anthropic.com/. Without this key the route still
renders but returns 503 on send.

- `ANTHROPIC_API_KEY` — server-only, starts `sk-ant-…`

## CRON_SECRET

Shared secret used by Vercel cron jobs to authenticate. Generate via
`openssl rand -base64 32` and set as a server env in Vercel. The same
value is used by all cron routes.

## WhatsApp deep links

Wa.me links are public so the only thing needed is the official Bazar
number for two channels. Both can be unset in dev (falls back to a
placeholder).

- `NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER` — general advisory handoff
- `NEXT_PUBLIC_WHATSAPP_MORTGAGE_NUMBER` — pre-approval queue

Free-form format: `+971 50 …` works; the helper strips non-digits.

## Meilisearch

Search backend. Sign up for Meilisearch Cloud (Builder tier or higher
at https://www.meilisearch.com/) or self-host.

Server-only:
- `MEILISEARCH_HOST` — `https://<id>.meilisearch.io`
- `MEILISEARCH_API_KEY` — admin key (writes the index)

Browser-safe:
- `NEXT_PUBLIC_MEILISEARCH_HOST` — same host (the browser doesn't need
  it today but allowed for client-side queries later)
- `NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY` — search-only key (scope:
  search; do NOT use the admin key here)

After wiring, run `/api/admin/meilisearch-reindex` (admin POST) once
to seed the index. After that, the daily sync cron keeps it fresh.

## Voyage AI

Embeddings for the `/concierge` semantic search. Sign up at
https://www.voyageai.com/. Cost is trivial at our scale (~$1/mo).

- `VOYAGE_API_KEY` — server-only, starts `pa-…`

`/api/cron/embeddings-backfill` (daily 03:00) handles the writes.

## Mapbox

Geocoding + isochrones + tiles. Free tier covers ~50k loads/month +
100k geocodes/month. Sign up at https://www.mapbox.com/.

- `NEXT_PUBLIC_MAPBOX_TOKEN` — public token, starts `pk.…`. Scope:
  styles + geocoding + isochrone + directions

If unset, the address typeahead falls back to a static curated list
and the commute-time tool is hidden. The contact + map embed
components still render via maplibre on open tiles.

## Property Finder + Bayut

Both are pull-based: the portal fetches our `/api/feeds/*.xml` route
periodically. Bazar configures a per-portal token; the feed route
returns 403 to anything that doesn't match.

- `PROPERTY_FINDER_FEED_TOKEN` — random opaque string
- `BAYUT_FEED_TOKEN` — random opaque string

Send the full feed URL (incl. token) to the portal partnership
contact. Daily sync cron updates the `integrations` row so the admin
panel shows "last synced X hrs ago".

## Mailchimp

Newsletter list management.

- `MAILCHIMP_API_KEY` — server-only, ends with the datacenter, e.g. `…-us21`
- `MAILCHIMP_LIST_ID` — audience id (10 chars)
- `MAILCHIMP_DC` — datacenter slug, e.g. `us21`
- `MAILCHIMP_WEBHOOK_SECRET` — opaque token used as
  `/api/webhooks/mailchimp?secret=<...>` so Mailchimp's POST is
  authenticated

In Mailchimp dashboard → Audience → Settings → Webhooks, set:
- URL: `https://bazar.ae/api/webhooks/mailchimp?secret=<MAILCHIMP_WEBHOOK_SECRET>`
- Events: Subscribe, Unsubscribe, Profile update, Cleaned address

## DocuSign

E-signature for Form A / NOC / offer letters. Use the **JWT
impersonation** flow (server-to-server, no user OAuth).

In DocuSign Admin → Settings → Apps and Keys:
1. Create an Integration Key.
2. Add an RSA keypair (public key uploaded; private key as
   `DOCUSIGN_PRIVATE_KEY` env — multi-line, keep the
   `-----BEGIN/END PRIVATE KEY-----` headers).
3. Grant the app `signature` + `impersonation` scope.
4. Authorise via the consent URL (one-time per environment).

Env:
- `DOCUSIGN_INTEGRATION_KEY` — integration key (client id)
- `DOCUSIGN_USER_ID` — impersonated user GUID (the Bazar admin who
  owns the templates)
- `DOCUSIGN_ACCOUNT_ID` — account guid
- `DOCUSIGN_PRIVATE_KEY` — the RSA private key contents
- `DOCUSIGN_BASE_URL` — `https://demo.docusign.net/restapi` for
  sandbox, `https://docusign.net/restapi` for production
- `DOCUSIGN_WEBHOOK_SECRET` — shared secret for HMAC verification on
  the Connect webhook

In DocuSign Admin → Settings → Connect, add a custom configuration:
- URL: `https://bazar.ae/api/webhooks/docusign`
- Events: Envelope sent, delivered, completed, declined, voided
- Include: Custom fields (so we can read `bazar_document_id`)
- Authentication: HMAC-SHA256 with `DOCUSIGN_WEBHOOK_SECRET`

## DLD comparables

DMT/DLD don't publish a permanent API — they release periodic CSV
exports at https://gisr.dubailand.gov.ae/ (Dubai) and
https://www.dmt.gov.ae/ (Abu Dhabi). Configure the source by setting
`config.csv_url` on the `dld_open_data` row in the `integrations`
table:

```sql
update public.integrations
set config = jsonb_set(config, '{csv_url}', '"https://…/transactions.csv"')
where kind = 'dld_open_data';
```

`/tools/valuation` and `/market-reports` read the `dld_comparables` snapshot.
The weekly import cron that refreshed it was **removed** — the feature was
never live and the table is empty. Load it manually, or reinstate the cron,
before either surface can price against real comparables.

## WhatsApp Cloud API (deferred)

Not part of v1. The wa.me deep-link path covers the entire user-facing
WhatsApp surface today. Cloud API upgrade is a Phase-6 effort that
needs Meta Business Suite approval + a verified template library
before it can replace the deep links.

## Verifying after handover

Visit `/admin/settings/integrations` once env vars are set. Each card
shows:
- "connected" / "disconnected" / "error" status from the
  `integrations` table
- whether the required env vars are present (browser-side ones only —
  the page is server-rendered so it sees both)
- last sync timestamp and any error message from the most recent cron
  run

If a card stays "disconnected" after env vars are set, the
corresponding cron hasn't run yet. Trigger it manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://bazar.ae/api/cron/meilisearch-sync
```
