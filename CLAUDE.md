# bazar-real-estate-cms

A luxury real-estate marketplace **and** full operations CMS for [bazar.ae](https://bazar.ae) — a boutique advisory firm in Abu Dhabi.

## Read first

- **[docs/PROJECT_UNDERSTANDING.md](docs/PROJECT_UNDERSTANDING.md)** — what we're building, who Bazar is, IA, data model, compliance, roadmap. Required reading for any new contributor (human or AI).
- **[docs/FOLLOWUPS.md](docs/FOLLOWUPS.md)** — cross-session backlog of small "noticed during a PR, not worth bloating it" items. Pick from here when you have a slot; add to it when you finish a PR and spot something.
- **[docs/decisions/ADR-0008](docs/decisions/ADR-0008-machine-generated-arabic-first-draft.md)** — curated Arabic is a gated machine FIRST DRAFT the client edits, not hand-authored. Amends ADR-0007 §4; read it before assuming a surface needs writing by hand.
- **[docs/I18N.md](docs/I18N.md)** — Arabic + RTL: what you must do when you add a new page, component, section, block, form field or public column. Read before adding any of those.
- **[AGENTS.md](AGENTS.md)** — Next.js 16 has breaking changes from earlier versions; consult `node_modules/next/dist/docs/` when in doubt.
- **[docs/decisions/](docs/decisions/)** — Architecture Decision Records. Read these before assuming the spec is current; we deliberately diverged from the original brief in four places (FTS+Meilisearch, MapLibre+Mapbox, Vercel cron, Postgres+Mailchimp).
- **Design handoff** (not in repo): `/Users/ayushkbhatia/Downloads/design_handoff_bazar_website_cms/` — 13 docs + 15 JSX screen mockups + tokens. The source of truth for screens, copy, and entity shapes.

## Deviations from the original spec

Four choices in the stack diverge from the original brief. Don't try to "fix" them back to the spec without reading the ADR first — most are two-layer architectures where the spec's choice was added later as a progressive enhancement, not replaced.

| Spec said | We use | Why | ADR |
|---|---|---|---|
| Meilisearch | Postgres FTS baseline + Meilisearch when configured (Sprint 12) | Local/preview run on FTS; prod with Meilisearch creds gets typo tolerance. ID-only index contract keeps RLS as the boundary. | [ADR-0001](docs/decisions/ADR-0001-postgres-fts-with-meilisearch-fallback.md) |
| Mapbox GL JS | MapLibre GL for tiles + Mapbox APIs for geocoding/isochrones (Sprint 12) | Avoid metered map loads on preview/e2e/lhci; pay only for the API calls that need Mapbox quality. | [ADR-0002](docs/decisions/ADR-0002-maplibre-tiles-with-mapbox-apis.md) |
| Inngest | Vercel Cron + Bearer secret (7 jobs) | Jobs are idempotent and fit one execution; durability not yet load-bearing. **Known gap**: silent-failure surface grew with minute-cadence crons. | [ADR-0003](docs/decisions/ADR-0003-vercel-cron-over-inngest.md) |
| Mailchimp | Postgres `newsletter_subscribers` source of truth + Mailchimp campaign surface (Sprint 13), two-way synced | One DSR surface, full CRM queryability, marketing keeps its tooling. | [ADR-0004](docs/decisions/ADR-0004-postgres-newsletter-with-mailchimp-campaigns.md) |

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind v4 with OKLCH tokens + shadcn/ui primitives |
| Fonts | Instrument Serif (display), Geist (UI), JetBrains Mono (data) — `next/font/google` |
| DB / Auth / Storage / Realtime | Supabase (single platform, MCP-managed) |
| Forms | react-hook-form + zod |
| Icons | lucide-react |
| Maps | MapLibre GL JS (tiles) + Mapbox APIs (geocoding, isochrone) ([ADR-0002](docs/decisions/ADR-0002-maplibre-tiles-with-mapbox-apis.md)) |
| Search | Postgres FTS baseline + Meilisearch progressive enhancement ([ADR-0001](docs/decisions/ADR-0001-postgres-fts-with-meilisearch-fallback.md)) |
| Vector embeddings | pgvector inside Supabase Postgres + Voyage AI for embeddings |
| LLM | Anthropic Claude (Haiku for tool calls, Sonnet for synthesis) — AI Concierge live |
| Background jobs | Vercel Cron + Bearer secret, 7 scheduled jobs ([ADR-0003](docs/decisions/ADR-0003-vercel-cron-over-inngest.md)) |
| Email | Resend (transactional) + Mailchimp (campaigns), Postgres source of truth ([ADR-0004](docs/decisions/ADR-0004-postgres-newsletter-with-mailchimp-campaigns.md)) |
| WhatsApp | Meta WhatsApp Business Cloud API |
| PDFs | @react-pdf/renderer (mortgage scenarios, valuation reports, analytics snapshots) |
| Observability | Sentry + PostHog + Vercel Analytics |
| Tests | vitest (units) + Playwright (e2e) + Lighthouse CI |
| Hosting | Vercel |

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` → http://localhost:3000 |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Type-check | `npm run typecheck` |
| Unit tests (vitest) | `npm run test:run` |
| Vitest watch / UI | `npm test` / `npm run test:ui` |
| E2E (Playwright) | `npm run test:e2e` |
| Lighthouse CI | `npx lhci autorun` |
| Regenerate Supabase types | `npm run db:types` |
| Seed local DB | `npm run db:seed` |

CI gate (run all four before requesting review):

```
npm run lint && npm run typecheck && npm run test:run && npm run build
```

## Where things live

```
app/
  layout.tsx               # fonts, theme, toaster, analytics, posthog
  globals.css              # design tokens + shadcn variables
  (public)/                # public marketplace + auth pages
    layout.tsx             # PublicNav + main + PublicFooter
    page.tsx               # home
    forgot-password/       # staff password recovery (Resend token link)
  staff-invite/            # accept an invite / set a new password
  _actions/auth.ts         # sign-in + sign-out, shared by both doors
  (admin)/                 # CMS — staff-only (auth-gated by middleware)
    layout.tsx             # CmsShell
    admin/page.tsx         # /admin dashboard
components/
  ui/                      # shadcn primitives — re-add via `npx shadcn add <name>`
  brand/                   # Bazar-specific composed components
lib/
  forms/                   # Forms Manager: registry of every public lead form,
                           #   resolver (DB over code defaults), validator,
                           #   submission mapping. See docs/FORMS.md.
  page-builder/            # Page Builder: catalogue of reusable public
                           #   sections, document parse/resolve, batched data
                           #   loader, values→props adapters, publish gate.
                           #   See docs/PAGE_BUILDER.md.
  content-assets/          # Content Assets: the token vocabulary and its
                           #   scoping rules, plus the SYSTEM email registry —
                           #   the four transactional emails a published
                           #   `content_assets` row can replace. Resolution is
                           #   published-row-wins, code-template-otherwise, so
                           #   a draft (or an unreadable row) sends the
                           #   built-in copy. See docs/CONTENT_ASSETS.md.
  master-pages/library.ts  # Section library: content owned by the SITE, not by
                           #   a page (testimonials today). One document, read by
                           #   the home page and by the Page Builder block.
                           #   Edited at /admin/pages/sub/section.
  master-pages/developer-page.ts
                           # Developer profile pages: the wording all 32
                           #   /developers/<slug> pages share — crumb, both
                           #   headings, both buttons, the empty state. One
                           #   document, `{name}` substituted per page.
                           #   Edited at /admin/pages/sub/developer/copy.
  master-pages/search-headers.ts
                           # Search-results headers: the eyebrow, headline and
                           #   sub-title above the filter bar plus the page's
                           #   own <title>/<meta description>, one document per
                           #   search facet (7 facets over 6 routes). Read by
                           #   SearchList and by each route's generateMetadata;
                           #   edited at /admin/pages/sub/search.
  env.ts                   # zod-validated env loader (use `env.X`, never raw process.env.X)
  utils.ts                 # cn() helper
  posthog.tsx              # client analytics provider (no-op without keys)
  supabase/
    server.ts              # server client (cookies-aware)
    browser.ts             # browser client
    proxy.ts               # session refresh + auth gating (Next.js 16 convention)
db/
  types.ts                 # generated from Supabase schema
supabase/
  migrations/              # versioned SQL files; apply via Supabase MCP
proxy.ts                   # session refresh + route gating (replaces middleware.ts in Next.js 16)
instrumentation.ts         # Sentry server init
instrumentation-client.ts  # Sentry browser init
docs/
  PROJECT_UNDERSTANDING.md
  decisions/               # ADRs — read these before assuming the spec is current
  INTEGRATIONS.md          # how Meilisearch / Mapbox / Mailchimp / Resend wire up
```

## Route groups

We use three route groups under `app/`:

- `(public)/` — the marketplace. No auth, no sign-in: **there are no customer accounts.**
- `(staff-auth)/` — the staff door (`/admin/login`), reachable while signed out.
- `(admin)/` — staff-only (`/admin/*`). Auth-gated **and** role-gated (`role ∈ {admin, editor, agent, marketing, support}` on the `staff` table).

Customer accounts were removed — see
[ADR-0005](docs/decisions/ADR-0005-remove-customer-accounts.md). Anything still
pointing at `/sign-in`, `/sign-up`, `/magic-link` or `/account/*` permanently
redirects to `/admin/login`; `app/(account)/` and `app/(public)/(auth)/` no
longer exist. Staff recover their password at `/forgot-password`, which issues
a Resend link — Supabase Auth sends no email at all.

## Component conventions

- **`components/ui/*`** — shadcn primitives (Button, Input, Dialog, etc.). Don't modify directly; re-add with `npx shadcn@latest add <name>` to upgrade.
- **`components/brand/*`** — Bazar composed components (Wordmark, ListingCard, PublicNav, PublicFooter, CmsShell, Eyebrow, PlaceholderImage). Use Tailwind utilities + brand tokens.
- Prefer **server components** by default. Only mark `"use client"` when you need hooks, browser APIs, or stateful interactivity.
- Forms: react-hook-form on the client + zod schema on the server (server action validates with the same schema).
- Icons: `lucide-react` — minimal stroke style matches the design language.

## Styling conventions

- Use the brand color utilities: `bg-bz-bg`, `text-bz-ink`, `border-bz-border`, etc. — these are mapped from OKLCH tokens in `globals.css`.
- shadcn's semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, etc.) are aliased to Bazar tokens, so shadcn primitives render in-brand automatically.
- Display type uses the `.serif` class (Instrument Serif). Use it for `h1`/`h2`, hero headlines, and pull quotes.
- Eyebrow labels: use the `<Eyebrow>` brand component or the `.eyebrow` class — 11px uppercase tracking-wide, muted color.
- Numbers and references use `.mono` (JetBrains Mono) for visual rhythm.
- Dark mode: `.dark` class on `<html>`. All tokens have dark-mode equivalents in `globals.css`.

## Env

All env vars are loaded via `lib/env.ts` (zod-validated). Don't read `process.env.X` directly outside of `lib/env.ts`.

- See `.env.example` for the full list.
- Required once Supabase is provisioned: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Optional: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`.

## Database (Supabase)

- All schema changes go through `supabase/migrations/` and are applied via the **Supabase MCP** `apply_migration` tool.
- Regenerate types with `npm run db:types` (calls `mcp__supabase__generate_typescript_types` and writes to `db/types.ts`).
- RLS is enabled on every table. Permission model lives in Postgres policies, not app code.
- For migrations affecting policy, also re-run the type generator.
- **A new public column on `site_settings` needs a `grant select (…) to anon` in the same migration.** That table is the only one with column-level grants (0096/0097), and an ungranted column fails the *whole* PostgREST select — so the symptom is every public page silently falling back to code defaults, not an error. Every other table uses table-wide grants plus RLS and needs nothing.
- **Public text columns need an Arabic twin** (`description` → `description_ar`) and an entry in `lib/i18n/domains.ts`. See [docs/I18N.md](docs/I18N.md).

## Deploy flow

- `main` branch auto-deploys to production: https://www.bazarrealestate.ae
- Pull requests get preview deployments.
- Once env vars are set in Vercel for production + preview, Supabase + Sentry + PostHog will activate automatically.

## Project status

**Sprint 13 complete.** What's live in production today:

- **Catalogue & search** — properties, developments, areas, developers, media assets (RLS on every table). Postgres FTS baseline; Meilisearch index synced daily for typo-tolerant search. pgvector + Voyage AI embeddings for semantic similarity.
- **Public marketplace** — `/buy`, `/rent`, `/off-plan`, `/commercial`, `/p/[slug]`, filter bar with bed/bath/type/area/price + Sprint 4b extensions (ft², year, tenure, furnishing, amenities, verified-only, advisor) via the MoreFiltersDrawer, three views (grid / list / map), pagination, MapLibre map with Mapbox isochrone commute-time overlay, draw-area-on-map tool.
- **Editorial & content** — `/insights` blog with category routing, `/pages/[slug]` block-based editor, `/about`, `/agents`, `/agents/[slug]`, `/services` + 5 sub-pages, `/areas/[slug]` guides, `/developers/[slug]` profiles, `/contact`.
- **AI Concierge** — `/concierge` route with Claude Haiku function-calling, streaming SSE, hand-off to human advisor.
- **Tools** — `/tools/valuation` (DLD-comparable model + PDF download), `/tools/mortgage` (Central-Bank-rate aware + PDF; six reorderable Pages & blocks sections), `/tools/compare`.
- **Admin CMS** — properties (publishability gates, agent assignment, bulk reassign/off-market/archive), developments, deals (Kanban stages, documents, KYC), enquiries (auto-reply + escalation crons, threads, assignment, admin-only archive with restore), valuations, audit log + bulk-operations view, users + roles, settings (integrations panel for Meilisearch / Mapbox / Mailchimp / Resend; **Mortgage** — the calculator's opening scenario, closing-cost percentages, Central Bank LTV tiers and DBR thresholds), pages, blog, analytics with PDF export, **Forms Manager** (every public lead form's visibility, copy, CTA, field list/types/order + its responses — `/admin/forms`; the home hero's search bar, tabs and all, at `/admin/forms/search-bar`), **Page Builder** (campaign landing pages assembled from pre-built sections, draft/preview/publish, served at `/lp/<slug>` — `/admin/page-builder`), **Footer** (the site footer's columns, links, socials, contact entries and legal line, each with an Arabic twin — `/admin/footer`), **Sections** (site-wide content edited once and rendered wherever it is placed — testimonials today, at `/admin/pages/sub/section`), **Search results** (the eyebrow, headline and sub-title above the filter bar on each of the six search routes, plus the title and description each publishes to a search engine, each with an Arabic twin — `/admin/pages/sub/search`), **Developer page copy** (the crumb, both section headings, both buttons and the empty state shared by every `/developers/<slug>` profile, with a `{name}` token and an Arabic twin — `/admin/pages/sub/developer/copy`), **Content assets** (`/admin/content-assets` — two tabs: *Outreach*, the email and WhatsApp copy an advisor sends by hand from the enquiry composer, and *System emails*, the four transactional emails the site sends on its own, each overriding a built-in template only while published).
- **Compliance** — PDPL DSR export + delete flows, cookie consent banner, all legal pages (`/legal/privacy|terms|cookies`).
- **Integrations** — Meilisearch sync, Voyage embeddings backfill, Mapbox geocoding + isochrones, Mailchimp two-way sync via webhook, Sentry, PostHog (consent-gated, with sign-in identify), Vercel Analytics, syndication push to portals, DLD weekly import, BRN validation, permit expiry alerts.
- **Infra** — 117 migrations, 80+ vitest specs, Playwright specs, 7 cron jobs, full CI gate.
  **Known gap**: the crons have never run in production — no Edge Function deployed, `app_settings` empty, `CRON_SECRET` unset. See docs/FOLLOWUPS.md.

See [docs/PROJECT_UNDERSTANDING.md](docs/PROJECT_UNDERSTANDING.md) for the full roadmap and what's next.

## Repo

- Code: https://github.com/ayushkbhatia/bazar-real-estate-cms (private)
- Production: https://www.bazarrealestate.ae
- Vercel project: `ayushkbhatia-7383s-projects/bazar-real-estate-cms`
