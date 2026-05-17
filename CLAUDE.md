# bazar-real-estate-cms

A real-estate CMS scaffolded with Next.js 16 (App Router), TypeScript, and Tailwind v4.

## ⚠️ Read AGENTS.md first

Next.js 16 has breaking changes — APIs, conventions, and file structure may differ from training data. Consult `node_modules/next/dist/docs/` when in doubt, and heed deprecation notices.

## Stack

- **Framework**: Next.js 16.2.6 (App Router, Turbopack)
- **Language**: TypeScript 5
- **UI**: React 19.2.4
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/postcss`)
- **Linter**: ESLint 9 with `eslint-config-next`
- **Package manager**: npm
- **Node**: 18+ (developed on 24.x)

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (http://localhost:3000) |
| Production build | `npm run build` |
| Run production build locally | `npm run start` |
| Lint | `npm run lint` |

No test runner is configured yet.

## Folder layout

```
app/                  # App Router routes
  layout.tsx          # Root layout
  page.tsx            # Home route
  globals.css         # Tailwind entry + globals
  favicon.ico
public/               # Static assets served from /
next.config.ts        # Next.js config
postcss.config.mjs    # Tailwind/PostCSS config
eslint.config.mjs     # ESLint flat config
tsconfig.json         # `@/*` import alias → project root
```

Import alias: `@/*` resolves from the project root (e.g. `import { x } from "@/app/foo"`).

## Conventions

- App Router only — no `pages/` directory.
- No `src/` directory; code lives at the project root.
- Tailwind v4 — styles are configured via `app/globals.css`, not `tailwind.config.*`.
- Server Components by default; opt into Client Components with `"use client"`.

## Deploy flow

- **Hosting**: Vercel
- **Project**: `ayushkbhatia-7383s-projects/bazar-real-estate-cms`
- **Production URL**: https://bazar-real-estate-cms.vercel.app
- **GitHub**: https://github.com/ayushkbhatia/bazar-real-estate-cms (private)

Pushes to `main` auto-deploy to production. Pull requests get their own preview deployment. To trigger a manual deploy: `npx vercel@latest deploy --prod`.

## Environment

No environment variables are required yet. Use `.env.local` for secrets (already in `.gitignore` via `.env*`). Mirror any required vars to Vercel's Project Settings → Environment Variables when added.
