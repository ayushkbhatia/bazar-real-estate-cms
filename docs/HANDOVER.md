# Handover — Bazar Real Estate

Single document the Bazar team needs to take ownership of the platform.
Pair this with [PROJECT_UNDERSTANDING.md](PROJECT_UNDERSTANDING.md) for the architecture context.

---

## 1. What you're inheriting

A working Next.js 16 luxury marketplace and operations CMS. The public site renders Bazar's catalogue, advisor team, editorial blog, and proprietary tools. The admin CMS manages listings, deals, enquiries, agents, and analytics. Both deploy from `main` to https://bazar-real-estate-cms.vercel.app via Vercel.

The current production database contains **demo content** sized to make the marketplace feel complete on demo day:

| Layer | Live in DB at handover |
|---|---:|
| Active advisors (`staff` role='agent') | 12 |
| Published articles (`articles`) | 13 |
| Published properties (`properties`) — total | 65 |
| ↳ buy / rent / off-plan / commercial | 34 / 16 / 10 / 5 |
| Published developments | 8 |
| Approved reviews (`reviews`) | 26 |
| Imagery (`media_assets`, `property_media`) | **0** — see §4 below |

Demo records are identifiable two ways:
- Properties use `listing_permit_no` of the form `BAZ-DEMO-####`. Real Trakheesi numbers will never match this pattern, so the compliance pre-flight can distinguish them at a glance.
- Advisor auth records carry `user_metadata.seeded = true` on `auth.users`. Their emails are `<first>@bazar.ae`; you'll change these for real staff.

The demo content is here so the site feels lived-in at handover. You can keep all of it, replace selectively, or run the deletion query in §6 to wipe and start from blank.

---

## 2. Environment variables

Every key in `.env.example` is currently a development credential owned by us. **All of them need to be swapped for Bazar-owned production credentials before launch.** Set the new values in the Vercel project for both *Production* and *Preview* environments, then redeploy.

### Required (the site won't function without these)

| Variable | What it is | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public URL of your Supabase project | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public/anon JWT | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin JWT — never expose to the browser | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SITE_URL` | Canonical public URL | The bazar.ae domain when live |
| `CRON_SECRET` | Bearer token for the 13 scheduled cron jobs in [vercel.json](../vercel.json). Vercel includes this automatically when calling cron endpoints. | Generate a random 32-byte hex string |

### Operational (features degrade gracefully when unset)

| Variable | Feature that depends on it | Behavior when missing |
|---|---|---|
| `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `RESEND_REPLY_TO` | Transactional email (enquiry auto-reply, viewing confirmations, valuation PDFs) | Send is skipped; nothing breaks |
| `ANTHROPIC_API_KEY` | `/concierge` AI chat | Route returns 503 with a "Coming soon" page |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Property detail maps, commute-time isochrone | Falls back to MapLibre + open tiles |
| `MEILISEARCH_HOST` + `MEILISEARCH_API_KEY` | Typo-tolerant search across listings | Falls back to Postgres full-text search |
| `VOYAGE_API_KEY` | AI Concierge semantic similarity | Concierge falls back to text search |
| `MAILCHIMP_API_KEY` + `MAILCHIMP_LIST_ID` + `MAILCHIMP_DC` + `MAILCHIMP_WEBHOOK_SECRET` | Newsletter campaign sync | DB remains source of truth; campaign tooling disabled |
| `DOCUSIGN_*` (5 vars) | KYC and offer-letter e-signature | Manual document upload only |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Per-IP rate limiting on public POSTs | No-op (no rate limit) |
| `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` | Product analytics | Silently disabled |
| `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` | Error tracking | Silently disabled |
| `NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER` + `NEXT_PUBLIC_WHATSAPP_MORTGAGE_NUMBER` | WhatsApp deep links from /contact, /tools/mortgage | Buttons render but fall back to a UAE placeholder number |
| `GOOGLE_PLACES_API_KEY` + `GOOGLE_PLACES_PLACE_ID` | Live Google Reviews on home/about TrustStrip | Falls back to a curated star count |
| `PROPERTY_FINDER_FEED_TOKEN` / `BAYUT_FEED_TOKEN` | Outbound listing syndication | Syndication is skipped |
| `NEXT_PUBLIC_FX_USD_PER_AED` | USD conversion shown on property detail | Uses a static 0.272 fallback |

### Seeder-only (only needed if you re-run `npm run seed:demo`)

| Variable | What it is |
|---|---|
| `SUPABASE_PROJECT_REF` | Your project ref (the `abcd1234` part of the URL) — used by `scripts/db-seed.sh` and `scripts/promote-staff.sh` |
| `SUPABASE_ACCESS_TOKEN` | Personal access token from your Supabase account — used by the same scripts |

---

## 3. Replacing the demo content

The demo content is loaded by a single command:

```bash
npm run seed:demo
```

Behind it: `scripts/seed-demo-content/` — a TypeScript module per entity (`01-agents.ts`, `02-articles.ts`, `03-properties.ts`, `04-reviews.ts`), all idempotent via deterministic IDs and `upsert(..., { onConflict: ... })`. The script runs under Node 24's native TypeScript support — no build step.

### To replace one entity (e.g. agents)

1. Edit `scripts/seed-demo-content/data/agents.ts` with the real 12 advisors (real names, BRNs, emails, bios).
2. Run `SEED_ONLY=agents npm run seed:demo`. Existing demo advisors are updated in place; their auth.users records keep their IDs so foreign keys (assigned_agent_id on properties, author_id on articles, subject_id on reviews) stay intact.
3. Repeat for `articles`, `properties`, `reviews` as Bazar's real content is ready.

### To wipe demo content entirely

See §6.

### Useful flags

- `SEED_ONLY=agents,articles npm run seed:demo` — run only those modules
- `SEED_SKIP=properties npm run seed:demo` — skip a specific module
- The full run is idempotent; you can re-run it safely after any data change

---

## 4. Imagery — the biggest open item

The site renders with `PlaceholderImage` gray tiles on every surface that expects a photo (property cards, advisor profiles, development cards, article heroes). **0 `media_assets` rows exist.**

This is a deliberate choice agreed at handover planning: Bazar provides the real photography rather than ship with stock images that don't match the brand. Two ways to load real photos:

### Option A — Admin CMS upload

Use `/admin/media` to upload images one at a time (drag-drop, up to 10 MB each, image or PDF). Then on `/admin/properties/[id]` → media tab, pick the uploaded asset as the hero and gallery. Works today; ~5 minutes per listing.

### Option B — Bulk via seeder (recommended for the 60+ demo listings)

The architecture for this is sketched but the seeder module is not wired in (deferred during the 2-week handover sprint). To finish:

1. Create `scripts/seed-demo-content/data/assets-manifest.ts` mapping entity slug → array of image URLs (Supabase Storage public URLs, generated from uploads to the `media` bucket under `listings/`, `team/`, `blog/` folders).
2. Add `scripts/seed-demo-content/seeds/05-media.ts` that, for each entry in the manifest, upserts a `media_assets` row and a `property_media` (or `development_media`) row with the correct role (hero, gallery, floor_plan).
3. Wire it into `scripts/seed-demo-content/index.ts`.
4. Re-run `npm run seed:demo`.

The lifecycle decision is whether to load Bazar's real photography this way or only use the admin CMS uploader. Either works.

---

## 5. Pre-handover redeploy

The `/agents` listing route is statically generated with ISR (5-minute revalidation). After loading new content via the seeder, force a fresh rebuild so the cache reflects the new state:

```bash
# Either:
git commit --allow-empty -m "trigger redeploy" && git push origin main
# Or:
# Use the "Redeploy" button on the latest production deployment in Vercel.
```

Other public routes are server-rendered on demand or revalidate within minutes; this only matters for static pages like `/agents` and `/pages/[slug]`.

---

## 6. Wiping all demo content

If you want to start production from a blank slate rather than mutating the demo content, run these in the Supabase SQL editor:

```sql
-- Demo properties (and dependent property_media, embeddings, audit log).
delete from public.properties where listing_permit_no like 'BAZ-DEMO-%';

-- Demo articles (only the 10 added by the seeder; the original 3 in seed.sql stay).
delete from public.articles where slug in (
  'yas-island-q1-2026', 'al-reem-q1-2026', 'off-plan-handover-schedule-2026',
  'noc-snagging-handover', 'service-charge-transparency-tufl',
  'pricing-a-saadiyat-villa', 'when-to-take-it-off-market',
  'mamsha-lobby-walkthrough', 'trakheesi-permit-q2-2026',
  'saadiyat-q3-launches-preview'
);

-- Demo reviews.
delete from public.reviews
  where id::text like 'aaaaaaaa-%';

-- Demo advisors (cascades from auth.users → staff via FK).
-- WARNING: this is the most destructive step. Confirm before running.
delete from auth.users where raw_user_meta_data ->> 'seeded' = 'true';
```

The 6 properties, 1 page, and 3 articles in `supabase/seed.sql` are kept — they're project-level seed data, not demo content.

---

## 7. Known gaps to address post-handover

In rough priority order. None of these block launch but all are worth addressing.

| Gap | Where | Effort |
|---|---|---|
| **Imagery** — load real photography (see §4) | media_assets / property_media | 1-2 days |
| **`/agents/[slug]` reviews section** — 26 approved reviews are seeded but no UI surfaces them. The query layer (`lib/queries/reviews-by-subject.ts`) and the section in `app/(public)/agents/[slug]/page.tsx` both need adding. | Agent profile page | ~2 hours |
| **`/agents/[slug]` Active listings** — page shows "Listings linked to advisors land in Sprint 9" but properties already have `assigned_agent_id` populated. Wire a query and render `<ListingCard>`. | Agent profile page | ~2 hours |
| **`/admin/agents` photo upload** — current form is a `photo_url` text input. Per [docs/FOLLOWUPS.md](FOLLOWUPS.md), real Storage upload was deferred. | Admin agent form | ~3 hours |
| **`/admin/properties` CSV import** — the import button is a stub (Sprint 10). For Bazar to load their own listings post-handover, this needs the server-side CSV validator + Postgres upsert. | Admin properties list | ~1 day |
| **Megamenu image picker** — featured tiles in admin navigation editor lack a media library picker. | Admin navigation editor | See [docs/FOLLOWUPS.md](FOLLOWUPS.md) |
| **PostHog megamenu events** | Megamenu component | See [docs/FOLLOWUPS.md](FOLLOWUPS.md) |

---

## 8. Operational essentials

### CI gate before any merge to main

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
```

All four must pass. The current state passes (0 errors, 35 pre-existing warnings).

### Scheduled cron jobs

13 jobs run on Vercel Cron, configured in [vercel.json](../vercel.json). They require the `CRON_SECRET` env var. Important ones:

- `daily-saved-search-alerts` — runs nightly, sends saved-search digest emails
- `daily-meilisearch-sync` — refreshes the search index from Postgres
- `weekly-dld-import` — pulls DLD comparable transaction data
- `enquiry-escalation-60m` — re-routes unanswered enquiries to a backup advisor
- `permit-expiry-alert` — warns when listing permits are 30 days from expiry

See `app/api/cron/*` for the full list. None of these are load-bearing during a soft launch; they all degrade gracefully without their respective integrations.

### Database migrations

Apply via the Supabase MCP `apply_migration` tool or the Supabase CLI. Migrations live in `supabase/migrations/` and are numbered; never reorder or rename existing ones once applied to production. After applying schema changes, regenerate types:

```bash
npm run db:types
```

### Admin access

1. Sign up via `/sign-up` with the real owner email.
2. Run `bash scripts/promote-staff.sh <email> admin` to grant admin role.
3. From there, the Admin user can invite other staff at `/admin/users`.

The seeded `@bazar.ae` advisors don't have access to admin — their role is `agent`, which only gates `/admin/agents/[my-slug]` and viewing their own assignments. For full admin, use the script.

---

## 9. Where things live (quick reference)

| Need | Location |
|---|---|
| The audit + planning notes that produced this content | This document + [PROJECT_UNDERSTANDING.md](PROJECT_UNDERSTANDING.md) |
| Architecture Decision Records (FTS+Meilisearch, MapLibre+Mapbox, Vercel cron, Postgres+Mailchimp) | [docs/decisions/](decisions/) |
| Cross-session follow-ups noted during sprints | [FOLLOWUPS.md](FOLLOWUPS.md) |
| Design source-of-truth (mockups, copy, entity shapes) | `/Users/ayushkbhatia/Downloads/design_handoff_bazar_website_cms/` — not in repo |
| Repo | https://github.com/ayushkbhatia/bazar-real-estate-cms |
| Production | https://bazar-real-estate-cms.vercel.app (will become bazar.ae) |
| Database | Supabase project (project ref in `.env.local` as `SUPABASE_PROJECT_REF`) |

---

## 10. First-week checklist for the Bazar team

1. **Swap env vars** in Vercel (Production + Preview) per §2. Redeploy.
2. **Set up Resend** for transactional email — enquiry auto-replies and saved-search alerts depend on this.
3. **Provision Anthropic API key** if `/concierge` should be live at launch.
4. **Replace the 12 demo advisors** with real Bazar advisors via `SEED_ONLY=agents npm run seed:demo`, or edit each row in `/admin/agents`.
5. **Source photography** and load via §4 either path.
6. **Walk every public route** in a browser and replace any remaining demo-flavoured copy or numbers.
7. **Set the WhatsApp numbers** (`NEXT_PUBLIC_WHATSAPP_*`) and verify the deep links work end-to-end.
8. **Confirm the cron jobs** in Vercel are firing — the dashboard at `/admin/analytics` exposes the last run timestamps once they have data.

When points 1–3 are done, the site is live. Points 4–8 are about polishing the demo into Bazar's real presence — work measured in days, not weeks.
