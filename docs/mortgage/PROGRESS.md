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
