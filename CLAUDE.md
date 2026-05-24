# bazar-real-estate-cms

A luxury real-estate marketplace **and** full operations CMS for [bazar.ae](https://bazar.ae) — a boutique advisory firm in Abu Dhabi.

## Read first

- **[docs/PROJECT_UNDERSTANDING.md](docs/PROJECT_UNDERSTANDING.md)** — what we're building, who Bazar is, IA, data model, compliance, roadmap. Required reading for any new contributor (human or AI).
- **[docs/FOLLOWUPS.md](docs/FOLLOWUPS.md)** — cross-session backlog of small "noticed during a PR, not worth bloating it" items. Pick from here when you have a slot; add to it when you finish a PR and spot something.
- **[AGENTS.md](AGENTS.md)** — Next.js 16 has breaking changes from earlier versions; consult `node_modules/next/dist/docs/` when in doubt.
- **Design handoff** (not in repo): `/Users/ayushkbhatia/Downloads/design_handoff_bazar_website_cms/` — 13 docs + 15 JSX screen mockups + tokens. The source of truth for screens, copy, and entity shapes.

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
| Maps (Phase 1+) | Mapbox GL JS |
| Search (Phase 1+) | Meilisearch |
| Vectors (Phase 5) | pgvector inside Supabase Postgres |
| LLM (Phase 5) | Anthropic Claude (Haiku for tool calls, Sonnet for synthesis) |
| Background jobs (Phase 1+) | Inngest |
| Email | Resend (transactional) + Mailchimp (newsletters) |
| WhatsApp (Phase 2) | Meta WhatsApp Business Cloud API |
| Observability | Sentry + PostHog + Vercel Analytics |
| Hosting | Vercel |

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` → http://localhost:3000 |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Type-check | `npm run typecheck` |
| Regenerate Supabase types | `npm run db:types` (Phase 1+) |

No test runner is configured yet. We'll add **vitest** for units + **Playwright** for E2E in Phase 1.

## Where things live

```
app/
  layout.tsx               # fonts, theme, toaster, analytics, posthog
  globals.css              # design tokens + shadcn variables
  (public)/                # public marketplace + auth pages
    layout.tsx             # PublicNav + main + PublicFooter
    page.tsx               # home
    (auth)/                # sign-in, sign-up, verify-otp, forgot-password
      _actions.ts          # server actions for auth
  (account)/               # signed-in marketplace user routes
    layout.tsx
    account/page.tsx       # /account
    account/saved/page.tsx # /account/saved
  (admin)/                 # CMS — staff-only (auth-gated by middleware)
    layout.tsx             # CmsShell
    admin/page.tsx         # /admin dashboard
components/
  ui/                      # shadcn primitives — re-add via `npx shadcn add <name>`
  brand/                   # Bazar-specific composed components
lib/
  env.ts                   # zod-validated env loader (use `env.X`, never raw process.env.X)
  utils.ts                 # cn() helper
  posthog.tsx              # client analytics provider (no-op without keys)
  supabase/
    server.ts              # server client (cookies-aware) + getSessionUser
    browser.ts             # browser client
    proxy.ts               # session refresh + auth gating (Next.js 16 convention)
db/
  types.ts                 # generated from Supabase schema (Phase 1+)
supabase/
  migrations/              # versioned SQL files; apply via Supabase MCP
proxy.ts                   # session refresh + route gating (replaces middleware.ts in Next.js 16)
instrumentation.ts         # Sentry server init
instrumentation-client.ts  # Sentry browser init
docs/
  PROJECT_UNDERSTANDING.md
  decisions/               # ADRs (Phase 1+)
```

## Route groups

We use three route groups under `app/`:

- `(public)/` — marketplace pages + auth, no auth required.
- `(account)/` — signed-in marketplace users (`/account/*`). Auth-gated in `middleware.ts`.
- `(admin)/` — staff-only (`/admin/*`). Auth-gated **and** role-gated (once `staff` table lands in Phase 1).

Inside `(public)/`, nested route group `(auth)/` groups the sign-in/sign-up/etc. pages without affecting URLs.

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

## Deploy flow

- `main` branch auto-deploys to production: https://bazar-real-estate-cms.vercel.app
- Pull requests get preview deployments.
- Once env vars are set in Vercel for production + preview, Supabase + Sentry + PostHog will activate automatically.

## Project status

**Phase 0 complete** — foundations only. No real catalogue, no search, no concierge, no tools. See [docs/PROJECT_UNDERSTANDING.md](docs/PROJECT_UNDERSTANDING.md) for the 21-week roadmap.

## Repo

- Code: https://github.com/ayushkbhatia/bazar-real-estate-cms (private)
- Production: https://bazar-real-estate-cms.vercel.app
- Vercel project: `ayushkbhatia-7383s-projects/bazar-real-estate-cms`
