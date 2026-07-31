# Project understanding — Bazar Real Estate (bazar.ae)

This is the onboarding document for anyone — engineer, designer, advisor, AI assistant — joining the build. Read this first. Everything below is distilled from the handoff at `/Users/ayushkbhatia/Downloads/design_handoff_bazar_website_cms/`; that folder is the source of truth for screens, copy, and data structures.

---

## What we're building

**bazar.ae** is two products in one codebase:

1. **A luxury marketplace** — a public website where buyers, renters, and investors find Abu Dhabi properties. 16 screens cover discovery (home with 4 hero variants, search with map, property detail, off-plan developments), credibility (about, agents directory, insights blog), and proprietary tools (valuation calculator, mortgage calculator, AI concierge powered by Anthropic Claude, compare).
2. **A full operations CMS** — a private back-office where the Bazar team runs the business. 11 screens cover the property catalogue, a 3-pane enquiries inbox with lead routing, viewings/offers/deals lifecycle, AML/KYC verification, blog editor, pages/blocks system, agents/team, users/roles, site settings, analytics, and an audit log.

These ship as a **single Next.js app** with internal route groups: `(public)` for the anonymous marketplace, `(staff-auth)` for the staff door, and `(admin)` for staff. There are no customer accounts — see [ADR-0005](decisions/ADR-0005-remove-customer-accounts.md).

## Who Bazar Real Estate is

**Bazar Real Estate** is a boutique advisory firm based in Abu Dhabi. The brand positioning is deliberately the opposite of a listing portal — it's curated, editorial, and credibility-first:

- **12 capped senior advisors.** They close fewer deals by design.
- **Fiduciary-aligned.** Paid by clients, not developers.
- **Off-market deal flow.** Listings that don't appear on Property Finder or Bayut.
- **Voice:** editorial, numerically honest, confident, no hype, no emoji, no feature-list-speak.
- **Brand line:** "Abu Dhabi, properly understood."

Target users are HNW investors, end-user buyers (relocators, families), sellers (using the valuation tool to enter the funnel), and — secondary — renters.

Business model: ~1.5% advisory on transactions, newsletter as primary marketing channel, referral revenue from mortgage pre-approvals.

## Information architecture

Public:
- `/` (4 hero variants — fullbleed default), `/buy`, `/rent`, `/off-plan`, `/commercial` (search)
- `/p/:slug-:ref` (property detail, e.g. `/p/mamsha-3-bed-baz-ad-04891`)
- `/developments`, `/developments/:slug`, `/developers`, `/developers/:slug`
- `/areas`, `/areas/:slug`
- `/agents`, `/agents/:slug`
- `/about`, `/services`, `/services/:slug` (buy/sell/rent/invest/manage)
- `/insights`, `/insights/:slug`, `/insights/category/:cat`, `/insights/author/:slug`
- `/tools/valuation`, `/tools/mortgage`, `/tools/compare?ids=...`
- `/concierge`
- `/contact`
- `/legal/{privacy,terms,cookies}`

Authenticated user (`/account/*`):
- ~~Customer account pages~~ — removed, ADR-0005. The marketplace is anonymous.

Admin (`/admin/*`):
- `/admin` (dashboard), `/admin/analytics`, `/admin/properties`, `/admin/properties/:id`, `/admin/media`, `/admin/enquiries`, `/admin/agents`, `/admin/blog/:id`, `/admin/pages`, `/admin/users`, `/admin/settings`

Auth: staff only — `/admin/login`, `/forgot-password` (Resend token link), `/staff-invite`. The customer auth pages were removed (ADR-0005) and permanently redirect to `/admin/login`.

Slug-+-ref URLs (e.g. `/p/mamsha-3-bed-baz-ad-04891`) give SEO-friendly slugs while keeping refs stable. Old slugs 301-redirect; removed listings return 410 Gone with a "This listing has sold" message and similar suggestions.

## Stack (locked)

- **Next.js 16** App Router + Turbopack
- **TypeScript** (strict mode from day one)
- **Tailwind v4** + **shadcn/ui** primitives + brand components under `components/brand/`
- **Fonts:** Instrument Serif (display), Geist (UI), JetBrains Mono (numbers/data) — via `next/font/google`
- **Supabase** for Postgres + Auth + Storage + Realtime (single platform; MCP-managed)
- **Mapbox GL JS** for maps (Phase 1+)
- **Meilisearch** for property search (Phase 1+)
- **pgvector** in Supabase Postgres for AI concierge semantic search (Phase 5)
- **Anthropic Claude** for the concierge (Haiku for tool calls, Sonnet for synthesis)
- **Inngest** for background jobs + cron (Phase 1+)
- **Resend** (transactional email) + **Mailchimp** (newsletters)
- **Meta WhatsApp Business Cloud API** (Phase 2)
- **Sentry** + **PostHog** + Vercel Analytics for observability
- **Vercel** for hosting (already wired), pushes to `main` auto-deploy

## Data model (high level)

The full ERD is in [handoff docs/06-data-model.md](/Users/ayushkbhatia/Downloads/design_handoff_bazar_website_cms/docs/06-data-model.md). Roughly:

- **Identity:** `auth.users` (Supabase) + `accounts` (marketplace users) + `staff` (internal employees, incl. agents with BRN licenses).
- **Catalogue:** `areas` (tree: emirate → area → sub-community → building), `developers`, `developments` (off-plan), `properties` (THE central entity — reference like `BAZ-AD-04891`, lifecycle `draft → in_review → published → off_market → archived`), `media_assets` + `property_media` (typed roles: hero, gallery, floor_plan, brochure, video, virtual_tour).
- **Engagement:** `saved_properties`, `saved_searches`, `enquiries`, `conversations`, `messages`, `viewings`, `offers`, `deals`, `documents` (KYC docs).
- **Tools:** `valuation_requests`, `mortgage_inquiries`, `comparisons`, `concierge_sessions`.
- **Content:** `articles`, `pages` (block-based), `reviews`, `floor_plans`.
- **Operational:** `audit_log` (append-only), `notifications`, `integrations`, `webhooks`, `api_keys`.

RLS from day one. Permissions baked into Postgres, not application code.

## Workflows that matter most

From [handoff docs/07-workflows.md](/Users/ayushkbhatia/Downloads/design_handoff_bazar_website_cms/docs/07-workflows.md):

1. **Lead lifecycle** (the most critical): capture → qualify → viewing → offer → close. Auto-reply within 30s, route to assigned agent, escalate at 60min, log every step to `audit_log`.
2. **Listing publication:** pre-flight (developer, title, slug, price, valid + non-expired listing permit), publish → Meilisearch reindex → ISR revalidation → optional Property Finder/Bayut syndication. The paperwork flags on `properties.compliance` (Form A, title deed, NOC, PoA) and the hero-image requirement were removed from the gate — that paperwork is chased outside the CMS and was blocking listings that were otherwise ready.
3. **Valuation request:** 4-step form → auto-estimate from DARI/DMT comparables → advisor reviews and adjusts → branded PDF delivered → 7- and 30-day nurture emails.
4. **AI Concierge:** Anthropic Claude with function-calling against Meilisearch + pgvector + DB. Streams responses; manages an inferred brief (chips with × to remove); can hand off to a human advisor.
5. **Saved-search alerts:** instant/daily/weekly cadence; Inngest cron.
6. **KYC verification:** triggered at offer/deal stage; document upload to Supabase Storage with server-side encryption; compliance role reviews; status enum on `accounts`.

## Compliance — non-negotiable

UAE-specific. From [handoff docs/10-security-compliance.md](/Users/ayushkbhatia/Downloads/design_handoff_bazar_website_cms/docs/10-security-compliance.md):

1. **UAE PDPL** — Personal Data Protection Law, Federal Decree-Law 45 of 2021. Cookie consent + DSR endpoints (data export, deletion) are required. Data residency preferred-but-not-required in UAE.
2. **AML/KYC** — Bazar must verify Buyer & Seller identity before sharing offer terms or transferring funds. 7-year document retention.
3. **RERA/ADREC + DMT** — Each listing requires a valid ORN (Office Registration Number) and Trakheesi/DARI permit number. Listings without valid + non-expired permits are unpublishable (enforced as a publish gate). ORN must be displayed in footer.
4. **goAML** — Bazar registers with the UAE Financial Intelligence Unit; the CMS supports suspicious-activity reporting (Phase 6+).

## Phased roadmap

Full plan: [handoff docs/11-phased-roadmap.md](/Users/ayushkbhatia/Downloads/design_handoff_bazar_website_cms/docs/11-phased-roadmap.md). 21 weeks to production, 26 to feature-complete v1, with a team of 3 engineers + 1 designer + 1 PM.

| Phase | Weeks | Theme |
|---|---|---|
| 0 | 1–2 | Foundations — design system, auth, core schema *(this PR)* |
| 1 | 3–6 | Public catalogue — visitors find a property + CMS can publish |
| 2 | 7–9 | Lead engine — enquiries inbox, WhatsApp, saved-search alerts |
| 3 | 10–11 | Editorial — blog, pages/blocks CMS, newsletter |
| 4 | 12–14 | Tools — valuation, mortgage, compare |
| 5 | 15–17 | Off-plan + concierge — development pages + Claude concierge |
| 6 | 18–19 | Admin polish — users/roles, settings, analytics, audit |
| 7 | 20–21 | Launch hardening — security, perf, PDPL, a11y, UAT |
| 8+ | post | Arabic/RTL, mobile app, deal room, tenant/landlord portals |

## Where things live

```
app/
  (public)/        # marketplace + auth pages
  (admin)/         # CMS shell (dashboard, properties, enquiries, …)
components/
  ui/              # shadcn primitives (don't modify; re-add via shadcn CLI)
  brand/           # Bazar-specific (Wordmark, ListingCard, PublicNav, CmsShell, …)
lib/
  supabase/        # server.ts, browser.ts, middleware.ts
  env.ts           # zod-validated env loader
  utils.ts         # cn() and friends
  posthog.tsx      # PostHogProvider (no-op without keys)
db/types.ts        # generated from Supabase; regenerate with `npm run db:types`
supabase/migrations/  # versioned SQL (apply via Supabase MCP)
docs/              # PROJECT_UNDERSTANDING.md (this) and ADRs
```

## Critical open questions

Resolve early to avoid bottlenecks:

1. **License jurisdiction.** Abu Dhabi only, or also Dubai? Drives RERA vs DMT compliance scope.
2. **Photography sourcing + launch inventory.** Real images for 15–20 listings by end of Phase 1.
3. **WhatsApp Business approval.** Meta takes 4–8 weeks. Start Day 1.
4. **Mortgage partner banks.** Confirm ≥1 by Week 10.
5. **PDPL legal review.** Privacy policy, terms, cookie policy, DPA. Budget AED 10–20K. Start Phase 0.
6. **goAML registration.** Before handling transaction data.
7. **Final accent palette + type pair.** Default is Moss + Instrument Serif/Geist.

Lesser-priority decisions live in [handoff docs/12-open-questions.md](/Users/ayushkbhatia/Downloads/design_handoff_bazar_website_cms/docs/12-open-questions.md) (50 items). New decisions land in `docs/decisions/` ADRs from Phase 1.

## Status as of Phase 0

What's wired:
- Next.js 16 + TS + Tailwind v4 + shadcn/ui
- Design tokens (OKLCH palette, fonts, density)
- Brand components: Wordmark, Eyebrow, PlaceholderImage, ListingCard, PublicNav, PublicFooter, CmsShell
- Route groups: `(public)` / `(staff-auth)` / `(admin)` with layouts
- Staff auth (`/admin/login`, `/forgot-password`, `/staff-invite`) with server actions wired to Supabase
- Supabase client utilities (server, browser, middleware) — gracefully no-op until env keys are added
- Sentry instrumentation (env-gated)
- PostHog client provider (env-gated)
- Vercel Analytics
- Repo, GitHub, Vercel auto-deploy

What's deferred to immediately after Phase 0 commits:
- Provisioning a fresh Supabase project (the existing MCP-wired project is for another app)
- Applying the first migration (`accounts`, `staff`, `areas`, `developers`, `developments`, `properties`, `media_assets`, `property_media`, `audit_log` with RLS)
- Generating `db/types.ts`
- Seeding 4 staff users + 5 areas + 1 developer + 1 development + 6 properties from the design references
- Re-pointing the Supabase MCP at the new project

Once those are in place, Phase 1 (public catalogue + property publish flow) begins.
