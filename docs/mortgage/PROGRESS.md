# Mortgage module — progress log

One entry per phase, newest last: what was built, deviations from SPEC, open
TODOs. This file carries context from one session to the next (PLAN.md, "How
to run each phase").

---

## Phase 0 — Recon, decisions, setup · 28 Sep 2026

**Built (documentation only, no feature code)**
- `docs/mortgage/`:
  - `PLAN.md` and `SPEC.md`, verbatim;
  - `frontend/` (W1–W8) and `cms/` (C1–C6), unzipped from the two design
    handoffs. The duplicate `SPEC.md` inside each `00-foundations/` was dropped
    so there is one SPEC to keep current.
- `IMPLEMENTATION.md`: where every part of SPEC goes in this repo, what to
  reuse, conflicts, missing prerequisites, files per phase, risks and pushback.
- `DECISIONS.md`: every open question in one register, with owner,
  needed-by date and recommendation.
- `CLAUDE.md`:
  - added the "Mortgage module" block from PLAN, adapted to this repo;
  - removed "deals (Kanban stages, documents, KYC)" from the status list, since
    that module was removed in #214.

**Deviations from SPEC and the handoffs** (details in IMPLEMENTATION.md §0)
- The transition function lives in SQL, mirrored in `lib/mortgage-requests/state.ts`.
- `staff.mortgage_role` replaces new `staff_role` values. Proposed as D9;
  SPEC allows it.
- The file stream moves to `/api/admin/mortgages/files/[fileId]`.
- The website flow is its own route group, `app/[locale]/(mortgage)/`.
- The domain module is `lib/mortgage-requests/`, not `lib/mortgage/`.
- CMS strings live in `lib/mortgage-requests/cms-strings.ts`, not `messages/`.
- Drafts are purged by a cron, and scans run inline with a cron retry.
- There is no MSW or Storybook; a staff-only state gallery takes their place.

**Open before Phase 1**
- D9, D10, D11 and D26 (with G2) are needed by 29 Sep.
- D1–D7 need owners and dates for Phase 0 to close.

**Not verified from here**
- The live database (the Supabase connectors failed to authenticate):
  - the row count of `mortgage_inquiries`;
  - whether the leftover `documents` bucket still exists;
  - whether a fresh migrate from `0001` succeeds locally (answered in Phase 1: it doesn't, cleanly).
- The master-page and megamenu entry-point rows as edited live.

---

## Phase 1 — Data model & domain logic · 28 Sep 2026

Decisions taken first:

- D9: mortgage roles are a `staff.mortgage_role` column.
- D10: admins without a mortgage role are locked out.
- D11: the 24-hour promise runs on working hours.

**Built**
- **Migrations:**
  - `0138_mortgage_requests.sql`: every enum and table in SPEC §3, plus settings, holidays, adviser hours and the reference counter; RLS on all 16 tables, and nothing for `anon`.
  - `0139_mortgage_functions.sql`:
    - `mortgage_create_request()` (— → new);
    - `mortgage_transition()` (every later move in SPEC §2.4);
    - `mortgage_allocate_reference()` and `mortgage_next_owner()` (round-robin, or unassigned in claim mode);
    - `mortgage_log_event()`;
    - a trigger that rejects any other write to status, clock or decision columns, the service role's included;
    - append-only triggers on `mortgage_events`, UPDATE/DELETE/TRUNCATE included.
- **Domain module, `lib/mortgage-requests/`:**
  - `documents.ts`, `checklists.ts`, `state.ts`, `sla.ts`, `reference.ts`, `payments.ts`;
  - plus `dubai-time.ts`, since Dubai has a fixed +04:00 offset and no DST (checked against Intl).
- **The clock (`sla.ts`):**
  - a working calendar from `mortgage_settings.working_hours` (default: the office hours published on /contact) minus `mortgage_holidays`;
  - `slaStatus()`;
  - the start, pause and resume payloads the SQL functions take;
  - `formatDuration()`.
- **Local stack:** `scripts/db-local/` (`npm run db:local:reset`, `npm run db:local:stop`).
- **Seed:** `scripts/db-local/seed-mortgage.ts` reproduces the eleven C1 rows, Priya's, Karim's and Ahmed's files, the team (Yasmin head; Rashid, Leena advisers), Mariam as an admin with no mortgage role, and FAB/ADCB/Mashreq.
- **Types:** `db/types.ts` gained the mortgage tables, functions and enums, spliced from the local schema with no other line changed. Production doesn't have them yet, so `npm run db:types` can't produce them.
- **Registry:** the 16 tables are registered in `lib/i18n/domains.ts` (G-9).

**Verified**
- **Unit tests:** 106 in `lib/mortgage-requests`. They include:
  - every allowed transition and a sample of illegal ones;
  - the clock's start, pause, resume, stop, at-risk at 4h, breach and met;
  - statement months across a year boundary and in Dubai time;
  - per-kind limits with multi-file totals;
  - AED 2,150,000 at 3.99% over 25 years = AED 11,337;
  - every clock in C1 reproduced from the design data on wall-clock time.
- **Database tests:** 21 in `lib/mortgage-requests/database.db.test.ts`, run with `npm run test:db`. They cover:
  - the transition function agreeing with `state.ts` on all 400 status × event × actor combinations;
  - the status guard and the append-only log (service role and superuser);
  - 40 concurrent reference allocations (unique, consecutive), and 10 racing retries of one submit (one request);
  - the clock's columns;
  - RLS and roles.
- **Mutation-tested:** each of these was broken on purpose and a test went red:
  - the SQL transition table (allowing a decline from in review);
  - the status guard and the append-only trigger;
  - the TypeScript transition table;
  - a document set;
  - the at-risk threshold.
- **Gate:**
  - full `npm run test:run`: 328 files, 4,366 tests;
  - `npm run typecheck`;
  - `npm run lint`: 0 errors, 3 old warnings elsewhere;
  - `npm run db:check`.
- **Not run:** `npm run build` and `check:routes`. No page, route or app import changed, typecheck covers compilation, and a build prerenders against the production database.

**Deviations from SPEC** (IMPLEMENTATION.md has the reasons)
- Team membership is a column, and the transition function is SQL (mirrored in `state.ts`).
- The clock has a budget of working time. `sla_remaining_seconds` freezes it while paused, and `sla_due_at` is fixed when the clock starts or resumes, so calendar edits don't move a promise already shown to the applicant.
- A pause after a breach keeps a negative remainder, so resuming stays breached.
- One `reupload_requested` is allowed while already awaiting the applicant (a second flagged document). Leaving awaiting only resumes the clock when no other re-upload is open.
- `mortgage_consultations.ends_at` exists for the double-booking exclusion constraint.
- Several columns SPEC leaves out: `submission_key`, `property_ref`, `locale`, `mortgage_files.kind`, `package_token_hash`, `otp_sent_at`.
- The seed's C5 bank responses sit on Arjun Mehta (With banks), not Priya, whom C2 needs in review.
- Seeded emails are @example.com.

**Found on the way**
- **The migration history doesn't replay into an empty database.** `0009` and `0028` both create `property_embeddings`; `0034`/`0040` seed rows whose parents don't exist; `0038` hardens a function no migration creates. The local reset tolerates those four and lists them. From `0138` on, zero errors are allowed.
- **Newer Supabase images don't grant API roles table access by default.** Production still does, so the local reset restores production's defaults, and the mortgage migrations grant the service role explicitly. A project created fresh (at handover, say) would break every older table's API access. Worth knowing before any migration to a new project.

**Open**
- `0138` and `0139` are **not applied to production**. Apply them at the batch merge (the flag stays off, so nothing public changes), then check `db/types.ts` against `npm run db:types`.
- D11a: what the promise says to applicants, now that it means working hours.
- D30: public holidays.
- D26: the `mortgage_inquiries` row count (needs G2).
- The secure-link token hashing in the seed (sha256) is a placeholder until Phase 5 settles the scheme.
- Phase 2 next: private storage, uploads, completion checks and the logged file route. It needs D4, D6 and D14.

---

## Phase 2 — Secure document storage · 28 Sep 2026

Decisions first:

- D11a: keep 24 working hours, and the copy says so. Design rewords W1, W5–W7 before Phase 3 ships them.
- G3: `lib/env.ts` may be edited for this epic.

Outside choices still open, built around:

- D4 (region): Supabase Storage now, behind an adapter that S3 can replace.
- D6 (scanner): ClamAV `clamd` adapter, plus a dev stand-in.
- D14 (accounts): Turnstile and Upstash are wired but unset.

**Built**
- **`0140_mortgage_storage.sql`:**
  - private bucket `mortgage-files` (40 MiB cap, PDF/JPEG/PNG only) with **no storage policies**, so only the service role can touch it;
  - `mortgage_attach_draft()`, which moves a draft's files onto a request's documents by kind. It refuses while any file is unscanned or unclean (`files_not_ready`) or a document has no file (`documents_incomplete`), and marks files of kinds the request doesn't need as removed and returns them.
- **Public API**, SPEC §4.2 plus one addition:

  | Endpoint | Does |
  |---|---|
  | `POST /api/mortgage/drafts` | Turnstile, 10 per hour per IP |
  | `POST …/drafts/:id/files` | Presign: the rules on the declared size and type, counting files still uploading |
  | `POST …/files/:fileId/complete` | Real type from magic bytes; real size and totals; password-protected PDF (pdf.js); page count; SHA-256; malware scan |
  | `GET …/files/:fileId` | Status, for polling while a scan finishes (the addition) |
  | `DELETE …/files/:fileId` | Remove a file |

  - Draft tokens are 256-bit, stored hashed, sent as Bearer.
  - A wrong token and a missing draft get the same 404.
  - All of it sits behind the `mortgage_requests` flag: off gives 404, staff means signed-in staff only.
- **`GET /api/admin/mortgages/files/:fileId[?download=1]`:**
  - mortgage team only: anyone else, admins included, gets 403 (D10);
  - writes `document.viewed` / `document.downloaded` **through the caller's own session** before any byte is read, so the database re-checks their role;
  - serves only files that are on a request and clean;
  - headers: no-store, nosniff, CSP sandbox;
  - the owner's first open moves New → In review.
- **`/api/cron/mortgage-worker`** every 5 minutes: retries scans, and purges expired unclaimed drafts with their objects (Supabase Storage has no lifecycle rules).
- **Scanners:**
  - `clamdScanner` (ClamAV INSTREAM over TCP);
  - `devScanner`: flags only EICAR, local/preview/staging only, refused on the production deployment;
  - no scanner in production means files stay pending and can't be opened, so launch can't happen without D6.
- **Config:**
  - `lib/env.ts`: `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `MORTGAGE_SCANNER`, `MORTGAGE_CLAMD_HOST`/`PORT`, `VERCEL_ENV`, documented in `.env.example`;
  - `pdfjs-dist` ~5.6: 5.7 and 6.x need Node 22.13, and CI runs Node 20;
  - `serverExternalPackages: ["pdfjs-dist"]`.

**Verified**
- **Unit:** 28 new tests. They cover:
  - sniffing;
  - pdf.js on hand-built PDFs (plain, user-password, owner-only), which pypdf independently confirms are valid;
  - the clamd protocol against a fake daemon (clean, found, error, hung);
  - tokens, Turnstile, and which scanner runs.
- **Database:** 22 new tests in `storage.db.test.ts`, against the local stack's real storage. They cover:
  - uploads through signed URLs;
  - every refusal (oversize, wrong type, disguised type, too many, over the total, password-protected, infected);
  - the bucket's 40 MB cap against a small declared size;
  - scan-later via the worker;
  - cancel freeing the total;
  - token isolation;
  - expiry and purge;
  - attach;
  - staff access: 403 for an admin and an agent, 401 signed out, no bytes if the log write fails, and the log written before every read.
- **Mutation-tested:** each of these was broken on purpose and a test went red:
  - reading before logging;
  - letting staff without a mortgage role through;
  - skipping the encrypted-PDF and size re-checks;
  - attaching unscanned files;
  - opening the bucket to signed-in users.

  The first run exposed a weak ordering test (it only checked the last read), since fixed.
- **Runtime:** the real route handlers on `next dev` against the local stack.
  - Curl ran the whole draft flow, plus `encrypted_pdf`, `too_large`, 404 and the flag being off.
  - In the browser, Yasmin (Head of mortgages) signed in and opened a document: 200, and her open was logged as hers through the cookie session, which moved the request to In review.
  - Mariam (admin, no mortgage role) got 403, and nothing was logged.
- **Gate:**
  - `npm run test:run`: 333 files, 4,396 tests;
  - typecheck;
  - lint: 0 errors;
  - `db:check`;
  - `npm run build`: the six new routes compile as dynamic;
  - `check:routes`: 78 baseline routes unchanged.

**Deviations from SPEC and PLAN**
- The file stream is at `/api/admin/…`.
- There is no bucket lifecycle rule (the worker purges), and no bucket CORS rule (Supabase Storage allows none; the signed token is the control).
- Scans run inline, and the worker retries.
- One worker cron runs every 5 minutes rather than a separate hourly housekeeping job.
- The integration tests run against the local Supabase stack's own storage rather than a separate S3 emulator.

**Open**
- `0138`–`0140` are **not applied to production**. Apply them at the batch merge.
- D4, D6, D14 still need answers. Staging needs `MORTGAGE_SCANNER=dev` and Cloudflare's Turnstile test keys until then.
- The leftover `documents` bucket should be dropped once G2 lets someone check it's empty in production.
- **Found on the way:**
  - Two production deploys of `main` (13:55, ~2h before this entry) failed on a Supabase 522 during prerender. The site still serves the previous deployment, so `main`'s latest commits aren't live. A redeploy is the fix. Not done from here.
  - The valuation OTP's weaknesses (`lib/otp.ts`) are still to fix when Phase 5 builds link codes.
