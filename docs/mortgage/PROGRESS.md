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

---

## Phase 3 — Website intake W1–W7 · 28 Sep 2026

Built on the defaults the user accepted ("go ahead with Phase 3 on your
defaults"):

- **D12:** the Arabic catalogue is a machine first draft; the flow serves
  English only, and `/ar/mortgages/*` redirects to English.
- **D13:** no lead in Enquiries or Salesforce.
- **D23:** W2's LTV figures are settings (`mortgage_settings.ltv_national_pct` /
  `ltv_expat_pct`, 85/80).
- **D24:** non-residents aren't offered, as designed.
- **D25:** the calculator's old pre-approval form stops drawing while the flag
  is `public`.
- **D27:** the permit number and phone numbers as designed, flagged.
- **D28:** "licence" everywhere, so the row reads "Business trade licence".
- **D11a:** the designed "24 hours" wording ships flagged until design rewords
  it. The emails, which weren't designed, already say "24 working hours".
- **FE-3:** nothing is selected without a `service` parameter.
- **FE-5:** the Emirates ID offers "Add more files" for its second side, and
  "Replace" once both are in, which is W6's state.
- **FE-1, FE-9, D29:** undesigned copy is written and flagged; the responsive
  layouts are the READMEs' proposals.
- **FE-4:** switching employment type drops the documents the new set doesn't
  need, with no warning (none designed); the server retires them.
- **FE-13:** Exit has no confirmation and returns to the page the applicant
  came from, or `/`.
- **FE-14:** each screen keeps its designed chip order.

**Built**
- **`0141_mortgage_submit.sql`:**
  - `mortgage_create_request()` gains `p_draft_id` and `p_locale`, and attaches
    the draft's files in the same transaction. A refused attach (a file still
    scanning, a document with no file, an expired draft) rolls back the
    request, reference, consent and email;
  - `mortgage_notifications`, the outbox, and `mortgage_claim_notifications()`:
    `for update skip locked`, an abandoned claim taken back after 10 minutes,
    no more tries after 5;
  - the two LTV settings;
  - `mortgage_flow_public()`: the one bit visitors may read;
  - `mortgage_files.replaces`, so Replace keeps the old file until the new one
    is clean.
- **`0142_mortgage_system_emails.sql`** (a subagent, following
  docs/CONTENT_ASSETS.md): `mortgage_consultancy_received` and
  `mortgage_preapproval_received` as Content Assets system emails, with
  built-in templates, English and Arabic starting wording, tokens
  (`mortgage_reference`, `mortgage_due`, `mortgage_submitted`, the
  `mortgage_documents` panel), and a gallery sample each. Seeded as drafts,
  so the built-ins send.
- **Server:**
  - `L/server/submit.ts` and `POST /api/mortgage/requests`: flag, 10 per hour
    per IP, Turnstile, `Idempotency-Key`, and the draft token as Bearer. A
    repeated key answers with the request it already made (200), even though
    its draft is now claimed;
  - the consent's text is looked up by version (`L/consent.ts`), never taken
    from the request;
  - the submit sends `fileIds`, the files the applicant sees. Anything else in
    the draft is retired before the attach;
  - `L/server/notify.ts` sends the outbox right after the response (`after()`),
    and the mortgage-worker cron retries it (1, 2, 4, 8 minutes). Rows and
    events carry the kind and a reason with any address scrubbed out;
  - presign accepts `replaces`.
- **Domain:**
  - `L/details.ts`: W2's rules, used by the browser and as the server's zod
    schema, with rule codes rather than messages;
  - `L/format.ts`: English dates built from fixed names, because ICU's en-GB
    prints "Sept";
  - `L/copy-status.ts`: every string that isn't final, and the gap that closes
    it.
- **Client (`L/client/`):**
  - `api.ts`;
  - `apply-state.ts` (pure: entry links, guards) and `apply-store.ts`
    (sessionStorage and the hook);
  - `upload-queue.ts`, framework-free: three uploads at once, client checks
    that count files still uploading, Replace, cancel, and removal that waits
    for the server;
  - `turnstile.ts` (loaded on first use);
  - `analytics.ts`: an allow-list per event, gated on the consent cookie
    before the SDK loads.
- **UI:**
  - `app/[locale]/(mortgage)/`, its own group: a shell with no marketplace
    chrome, the flag gate, noindex, and the `mortgage` namespace mounted by
    `RouteMessages`;
  - W1–W7 at `/mortgages/apply{,/details,/review,/documents,/received}`;
  - components in `_components/`: the design's own glyphs, and the state tones
    scoped in `mortgage.css`;
  - `/mortgages/apply/gallery` renders W6's designed state from fixtures, off
    the production deployment unless the visitor is staff.
- **i18n:**
  - `messages/{en,ar}/mortgage.json`, 210 keys, merged from the handoff's
    strings, with Arabic provenance recorded;
  - `mortgage` in `NAMESPACES` and `ROUTE_NAMESPACES`;
  - the four guards (G-13, G-14, G-19, bare links) now scan the group;
  - `lib/i18n/english-only.ts` keeps the proxy, `localiseHref` and the redirect
    twins in agreement, so an Arabic-preferring visitor can't loop.
- **Entry points** (`lib/queries/mortgage-flow.ts`):
  - the home band's "Get pre-approval today";
  - the calculator's "Start pre-approval" and "Talk to advisor" (an editor's
    own link still wins);
  - a new "Get mortgage pre-approval" on sale listings.

  Each shows only while the flag is `public`. The megamenu row is a content
  edit at launch.

**Verified**
- **Unit:**
  - `npm run test:run`: 340 files, 4,478 tests;
  - new tests cover formatting, details, the upload queue (19), the store and
    guards, the copy registry, the English-only routing and the emails (15).
- **Database:** 16 new tests in `submit.db.test.ts` (59 in total), against the
  local stack. They cover:
  - an atomic create-and-attach, with the reference counter unchanged after a
    refusal;
  - idempotent retries;
  - unlisted files retired;
  - Replace kept and retired;
  - the outbox: once, backoff, give-up, one claim among six racing,
    abandoned-claim recovery;
  - what anon can see.
- **Mutation-tested:** each of these was broken on purpose and a test went red:
  - skipping the unlisted-file retirement;
  - never retiring replaced files;
  - leaving the address in a provider error;
  - storing any other consent text;
  - dropping the old file at once on Replace;
  - not counting files from the same pick against the total;
  - leaving a failed upload pending on the server;
  - the guard forgetting a submit;
  - the create function without its attach;
  - a claim that ignores status.

  The first run exposed a missing test: a total broken within one multi-file
  pick. It is added.
- **End to end:** `e2e/mortgage-apply.spec.ts`, run against the local stack
  with `playwright.mortgage.config.ts`. All 4 pass:
  - Path A (consultancy), including reload, Back and a fresh tab;
  - Path B (salaried);
  - Path C (business owner), with the oversize licence and "Choose another
    file";
  - W2's validation.
- **Runtime:**
  - BZM-26-0583 (consultancy) and BZM-26-0584 (pre-approval) were submitted in
    the browser: 7 files attached, the locked PDF retired, consent with IP and
    user agent, and the due time = 24 working hours. The dry-run email was
    logged as `notification.skipped`;
  - flag off: every route and API returns 404, and the entry points revert;
  - `/ar/mortgages/apply?…`: 307 to English, keeping the query.
- **Visual:**
  - 1440px full-page captures compared with the PNGs: page heights within
    3–11px, and W6 matches row for row;
  - 390px: no horizontal overflow on any screen. The stepper now names only
    the current step on a phone.
- **Gate:** migrations, lint, typecheck, `test:run`, `build` (the flow's routes
  compile dynamic; `/tools/mortgage` still prerenders) and `check:routes` (78
  baseline routes unchanged).

**Deviations from the handoffs and PLAN**
- There is no `apply/layout.tsx`: each page runs its own guard
  (`useGuardedState`).
- After a submit, every step redirects to the confirmation. The handoff says
  W1, but the step that submitted would then race the navigation and win; the
  confirmation is also the better place for Back to land.
- "2 of 4 ready · 1 file needs attention" is two messages joined with " · ":
  the catalogue forbids a plural inside a sentence.
- The confirmation emails go through an outbox and `after()`, not a queue
  service.
- `fileIds` and `replaces` are additions to SPEC §4.2's contract.
- The Turnstile widget isn't hidden: with a "Managed" key it may need a click.
- A gallery route stands in for Storybook (IMPLEMENTATION §1.14).
- `app/globals.css` gained two Arabic heading overrides (25px, and 54px at
  `md`), which the RTL scale guard requires for any public display size.

**Open**
- **Not applied to production:** `0138`–`0142`. Apply them at the batch
  merge; the flag stays `off`.
- **Blocks launch:**
  - D6: with no scanner in production, uploads never become ready;
  - D14: without `TURNSTILE_SECRET_KEY`, production answers 503 to drafts and
    submits;
  - D11a, D2, D17, D27, D29 and FE-1 copy (all in `copy-status.ts`).
- **Found on the way:**
  - on a dry run or with no key, `lib/email.ts` logs each recipient, for every
    email on the site (Phase 7);
  - PostHog's pageview autocapture will record W8's token URL, so Phase 5 must
    sanitise it.
- **Next phases:**
  - Phase 4 adds the team's notifications to the outbox (the `kind` check
    widens);
  - Phase 7 adds W1 to the a11y, mobile-geometry and Lighthouse lists;
  - staging (D8): until it exists, the e2e specs run locally only.
- **Local stack state:** the flag is `off`. BZM-26-0583/0584 and the DB tests'
  requests remain; `npm run db:local:reset` clears them.

---

## Phase 4 — The team's CMS: C1, C2, C6 · 28 Sep 2026

G1 granted ("G1 granted, go ahead with Phase 4"). The undesigned parts
(CMS-2 and friends) are built on the defaults listed under "Defaults built in
Phase 4" in DECISIONS.md, every string of them in `PENDING_CMS_COPY`.

**Built**
- **`0143_mortgage_cms.sql`:**
  - one function per action, each called through the adviser's own session:
    `mortgage_claim`, `mortgage_reassign` (Head only, to the team only),
    `mortgage_edit_applicant` (never employment), `mortgage_log_contact`
    (New → Contacted on a consultancy's first attempt),
    `mortgage_book_consultation` (Contacted → Consultation booked; a taken
    slot answers `slot_taken`), `mortgage_consultation_held` (→ Completed),
    `mortgage_create_invite` (one live invite per request; only the hash is
    stored), `mortgage_update_settings` and `mortgage_set_holiday` (Head only).
    Each checks the role in the database (`mortgage_authorise`: an adviser
    acts on what they own, the Head on anything, an admin without a role on
    nothing), takes the `updated_at` check (`mortgage_lock`, 409), moves status
    only through `mortgage_transition()`, and writes its event;
  - the outbox learns recipients (`recipient_staff_id`) and a `dedupe` key; a
    trigger queues "new request" for the owner and every active Head, in the
    submit's own transaction;
  - `mortgage_flag_sla()`: the SLA tick's one write — flags at-risk or missed
    once per promise and queues the alerts;
  - three bell kinds (`mortgage_request`, `mortgage_at_risk`,
    `mortgage_breached`).
- **`0144_mortgage_cms_emails.sql`** (a subagent): five Content Assets system
  emails — the team's new-request, at-risk and missed alerts (reference only,
  no applicant details), the applicant's booking confirmation (the `.ics`
  rides along) and the pre-approval invite. Seeded as drafts.
- **Server (`L/server/`):**
  - `cms-auth.ts`: `requireMortgageRole()` (404 off the team, D10) and the
    nav's role and new-request count, asked of `mortgage_role()` and never
    throwing — a deployment ahead of its migration loses the nav item, not
    the CMS;
  - `cms-queries.ts`: C1's queue (every filter, counts per tab and service,
    the at-risk list, search by name, reference or the mobile's last digits —
    on the server, so C1 never receives a full mobile) and the file for
    C2/C6;
  - `settings.ts`: the settings, holidays and SLA policy, shared with the
    submit;
  - `sla-tick.ts`, run inside the mortgage-worker cron;
  - `notify.ts`: team alerts (a bell row plus an email per recipient), the
    booking confirmation with its calendar invite and the adviser as
    reply-to, WhatsApp recorded as skipped (D1). The invite is sent by its
    action, since the outbox can't hold a token.
- **Domain (`L/`):** `queue.ts` (tabs, the promise-due order, search, the URL
  state), `slots.ts` (working hours minus holidays and bookings, on the
  settings' grid), `ics.ts`, `cms-format.ts`, `activity.ts` (events and
  contact attempts as one timeline, worded from the deck),
  `cms-strings.ts` (the CMS's English copy through `createTranslator`).
- **UI (`A/`):**
  - the nav item with its count (G1), from `AdminSession.mortgage`;
  - C1 at `/admin/mortgages`: banner, service filter, search (debounced,
    kept out of the URL), owner filter, tabs, the table, pagination, a 30s
    refresh and the highlight on return;
  - C2 and C6 at `/admin/mortgages/[reference]`: header, clock, stage rail,
    the document set with logged file links, applicant (Edit), owner (Claim,
    Reassign), consent, activity ("View all"), the contact log and its three
    outcomes, the booking card with free slots, "Mark consultation held",
    and the pre-approval link. File pages re-read on focus and every minute;
  - the settings page, Head only.

**Verified**
- **Unit:** `L/cms.test.ts` (21): formatting, the promise-due order (paused
  files by frozen time, breached first), search, tabs, the URL, slots, the
  `.ics` (escaping, folding, CRLF), the copy, and the activity lines against
  the designs' own examples.
- **Database:** `L/cms.db.test.ts` (15) on the local stack: new-request
  recipients; claim once; reassign Head-only and team-only; an admin refused
  every action; owner-or-Head; New → Contacted → Booked → Completed with one
  event per step; a double-booked and a past slot refused; 409 on a stale
  page; one live invite; applicant edits that name fields, never values; the
  bell and team email carry no applicant name; the booking email with its
  `.ics` and WhatsApp skipped; and the SLA tick on a fake clock — at risk
  once, missed once, missed-between-runs reported as missed, not callable by
  the team. `submit.db.test.ts` now scopes its outbox checks to the
  applicant's email. All 74 database tests pass.
- **Found by the tests:** `mortgage_edit_applicant` built its field list with
  `text[] || 'literal'`, which Postgres reads as two arrays. Fixed with
  `array_append` (0143 isn't in production yet).
- **End to end:** `e2e/mortgage-cms.spec.ts` (local only): the highlight on
  return, "Show only these" leaving the two at-risk files, and a consultancy
  from New to Completed. With the Phase 3 specs, all 7 pass.
- **In the browser** (local stack, 1440): C1, C2 (Priya) and C6 (Ahmed)
  against the PNGs; Omar taken New → Contacted → Booked → Completed; the
  invite; the bell; an admin gets a 404 and no nav item; an adviser sees no
  Reassign or Edit on a file they don't own and a 404 on settings; a holiday
  added and removed, with its audit row.

**Deviations from the handoffs and PLAN**
- The SLA tick runs inside `mortgage-worker`, not its own cron (one invocation
  every five minutes, not two; the alerts go out in the same run).
- C1's promise-due order puts a paused 9h 13m before a running 9h 15m, as
  SPEC §4.3 says; the PNG shows them the other way round.
- The booking card preselects no time: the adviser picks one, and the button
  reads "Book consultation" until they do.
- C6's contact log shows the whole history (assignment, booking, invite), not
  only contacts.
- Until the viewer (Phase 5), Review, Open and each file tag open the logged
  file route in a new tab. "Request documents" and "Accept application" are
  disabled with a reason.
- The audit target for settings is the nil UUID: `audit_log.target_id` is a
  uuid. The site-settings audits' `"1"` fails the same way today, silently —
  a follow-up task is filed.

**Open**
- **Not applied to production:** `0138`–`0144`. Apply them at the batch merge;
  the flag stays `off`.
- D15: no editor for advisers' own hours or video links yet.
- D1: WhatsApp rows are recorded as skipped until the Business API lands.
- The office's address isn't in the booking email or the `.ics` (not given).
- Phase 5 builds the invite landing (`/mortgages/r/[token]`): until then an
  invite link leads nowhere.

## Phase 5 — The review loop: C3, C4, W8 and the invite · 28 Sep 2026

Decided before starting: "D5 WhatsApp, D7 7 days, D21 your recommendation".
Codes and link messages go by email until the WhatsApp Business API (D1) is
connected; links last seven days; every kind has SPEC's proposed checks, and
the salary certificate's three recorded figures are required before Accept.
The undesigned parts are built on the defaults under "Defaults built in Phase
5" in DECISIONS.md, every string in `PENDING_CMS_COPY` or `copy-status.ts`.

**Built**
- **`0145_mortgage_review.sql`:**
  - review, through the reviewer's own session: `mortgage_set_check`,
    `mortgage_set_recorded`, `mortgage_set_statement_period` (whole months,
    at most two years) and `mortgage_accept_document` (every required check,
    a clean file). Only while the document is in review, only by its owner or
    the Head of mortgages, each with its event;
  - `mortgage_request_reupload` and `mortgage_cancel_reupload`: the link (its
    hash, seven days), the request, the document to "re-upload requested",
    the promise paused with the working time left (from `sla.ts`) and resumed
    on cancel; one open request per document; a cancel revokes the link and
    expires its draft, so unsent uploads go at the worker's next sweep;
  - the link, service role only: `mortgage_link_issue_code` (a minute between
    codes), `mortgage_link_verify` (five wrong codes lock the link for good;
    a right one starts a two-hour session, its hash stored),
    `mortgage_fulfil_reupload` (only this link's finished, clean files of the
    document's kind, added or replacing; back to review with the checks
    cleared; the promise resumes; the team is told) and
    `mortgage_submit_invite` (the applicant's own Fast Pre-Approval, from the
    consultation's details, linked to it);
  - the links' draft, session and code-channel columns; three outbox kinds;
    the "Re-upload received" bell.
- **`0141` changed in place** (not in production): an invite's application is
  created with the inviting adviser as owner, so the round robin isn't moved
  and one "assigned" line is logged.
- **`0146_mortgage_review_emails.sql`** (a subagent): three emails — the
  re-upload request (the adviser's message quoted, the link), the code, and
  the team's "re-upload received" (no applicant details). Drafts, with
  Arabic machine drafts.
- **Server (`L/server/`):** `links.ts` (lookup and state, the code, the
  session, uploads into the link's own draft through the W5/W6 pipeline,
  sending, the invite, and a retried invite answered with the application it
  already made), `link-http.ts`, `review.ts` (the viewer's data), `cms-kit.ts`
  (what every CMS action shares). `drafts.ts` presigns, completes, checks and
  deletes inside a draft the caller has already authorised, scoped to kinds
  and counting a document's existing files.
- **API:** `/api/mortgage/links/[token]/{otp,verify,files,…/complete,submit}`,
  rate-limited per IP and per link (by the token's hash), not behind the flag.
- **CMS (`A/`):** C3 and C4 at `[reference]/documents/[kind]` — tabs with
  their state, file chips ordered by period, zoom (`+` `-`), rotate (`R`),
  `[` `]` between files, the logged download, the page pill; pdf.js loads in
  the browser only. The review panel: checks with sub-lines, "Record for
  pricing", statement periods (they tick "Covers the last N months"),
  Accept, the accepted and awaiting states, "Next: …". C4's form: reason
  chips, the message prefilled when months are missing, channels, the pause
  note. C2: Review and Open lead to the viewer; "Requested {when} ·
  {reason} · Cancel request" (confirmed first); "Request documents" (a
  picker); "Accept application" enabled at 4 of 4 (the banks are Phase 6).
- **Website (`M/mortgages/r/[token]`):** the server picks the state
  (unavailable, expired, locked, used or applied, code, verified); the code
  gate; W8 as designed; the invite landing (W5/W6 under the secure pill, then
  W7 without the stepper). The flag gate moved to `apply/layout.tsx`. The
  page sends no referrer; PostHog strips the token from every URL.
- **Local:** the seed opens the flow (`flag = 'public'`) and
  `seed-mortgage-files.ts` uploads a labelled placeholder for every seeded
  file, so the viewer opens them.

**Verified**
- **Unit:** `L/review.test.ts` (14): coverage and its wording, the link's
  states, replace or add, masking, salted codes, cookie names. `cms.test.ts`
  words the Phase 5 activity lines; `verify.test.ts` opens the labelled
  placeholders. The full suite: 4,565 pass.
- **Database:** `L/links.db.test.ts` (9): who may review, and when; statement
  periods; a re-upload answered three days later resumes with exactly the
  working time left at the pause, the accepted documents and their files
  unchanged; add or replace; one open request per document; cancel revokes,
  resumes and clears unsent uploads; five wrong codes lock the link for good,
  a code expires, a minute between codes; an expired link opens nothing; one
  link's session opens no other; another link's file refused; the invite
  makes one linked pre-approval owned by the inviter without moving the round
  robin, and a retry gets it back. All 83 database tests pass.
- **End to end:** `e2e/mortgage-review.spec.ts` (local only): C4, the code,
  W8's upload and Send, "You've already sent this", and C2 back in review
  with the clock running. With the Phase 3 and 4 specs, all 8 pass.
- **In the browser** (local stack, 1440 and 375): W8 against the PNG
  (Karim); C3 against the PNG (Priya's salary certificate); C4 → C2 on
  Priya's statements, and Cancel; an invite from C6 to W7 (Ahmed →
  BZM-26-0419, due Thu 1 Oct 13:00); pdf.js under Turbopack.
- **Done when:** Karim's seeded file completed the loop in the browser, and
  the time left after the resume (9h 13m, due Tue 18:13) is the time left at
  the pause.

**Found and fixed**
- `0145`'s review functions read `t.req.id` inside SQL, which Postgres parses
  as a table: every check, period, accept and re-upload failed. Now
  `(t.req).id`.
- W5/W6 dropped files picked before the page's draft existed (Phase 3's
  "flaky when cold" spec): they now wait and go in once it exists.
- W8 said "3 months missing" for statements asked for again for another
  reason (a replaced file has no period yet). The coverage now shows only for
  "Period incomplete".
- An invite's application was round-robin assigned, then reassigned.
- The viewer's panel remounted on every save, losing keyboard focus. It stays
  mounted and takes the server's state field by field.

**Deviations**
- W8's adviser line shows the job title on their staff record (D16): Yasmin
  reads "Head of mortgages" where the PNG says "Mortgage adviser".
- Codes go by email (D5, until D1); the secure pill reads "…code sent to
  k•••@example.com".
- No `otp.ts`: a code only exists for a link, so it lives in `links.ts`.
- Replaced files are removed from storage when the re-upload is sent; their
  rows stay, marked removed.
- The session cookie is SameSite=Strict (SPEC §8), so a link opened from an
  email app asks for a code again, even in a browser that verified earlier.

**Open**
- **Not applied to production:** `0138`–`0146`. Apply them at the batch
  merge; the flag stays `off`.
- D1: WhatsApp rows are recorded as skipped; email carries the codes and
  links.
- D16: who the team is. D29: the three new emails are drafts.
- Design: the defaults for FE-2, W8's other kinds and CMS-2, 3, 5 and 17
  (DECISIONS.md).

## D19 — Declining a Fast Pre-Approval (ahead of Phase 6) · 29 Sep 2026

Ayush left D19 to us: "Come up with the decline reasons and decline message
yourself and program it in." The answer is in DECISIONS.md (D19, and
"Defaults built for D19"); the build is the decline half of C5's decision,
reached from C2 because a file can now be declined before it goes to the
banks.

**Built**
- **`0147_mortgage_decline.sql`:**
  - the reasons (`mortgage_decline_reason`, eight) and
    `mortgage_requests.decline_reason`, set only with a declined decision;
  - `mortgage_transition()` redefined from 0139: `declined` from New, In
    review, Awaiting applicant and With banks; a file declined while paused
    keeps the working time frozen at the pause, which is what `slaStatus()`
    reads (the pause's shape constraint holds); the reason rides in with the
    message. The guard now keeps the decision's message and reason to the
    function too;
  - `mortgage_decline()`, through the adviser's session (owner or Head): an
    open Fast Pre-Approval only; a message and email required; "no bank made
    an offer" only with the banks; cancels an open re-upload (its link
    revoked, its unsent uploads expired, the document back to review);
    withdraws the banks still deciding; writes `decision.declined`; queues
    the applicant's email (and WhatsApp, recorded until D1).
- **`0148_mortgage_decline_email.sql`** (a subagent): the applicant's email,
  `mortgage_decision_declined`, a Content Assets draft with an Arabic machine
  draft. The subject never says "declined" (it shows on a lock screen: "An
  update on your Fast Pre-Approval application — {reference}"); the body
  quotes the adviser's message as written, and replies go to whoever decided.
- **Domain:** `L/decline.ts` (the reasons, their labels, the template);
  `state.ts` mirrors the new moves; `activity.ts` words the decline and keeps
  its status change quiet; `cms-queries.ts` carries the decision to C2.
- **CMS:** `A/_decision-actions.ts` (`declineApplication`, email after the
  answer); C2's "Decline" dialog and, once decided, the Decision card;
  `notify.ts` delivers `decision_declined` with replies to whoever decided.

**Verified**
- **Unit:** `L/decline.test.ts` (9): a label per reason; "no bank made an
  offer" only once the banks were asked; declinable exactly where the state
  machine allows; the message's parts, words of its own for every reason but
  "Other", no signature without a name; the activity line. `state.test.ts`
  covers the new moves.
- **Database:** `L/decline.db.test.ts` (8): from New, In review, Awaiting
  applicant (the re-upload cancelled, its link revoked, the clock stopped
  with the time left at the pause) and With banks (the banks withdrawn); only
  the owner or the Head, only a Fast Pre-Approval, once, on a fresh page; a
  reason, a message (not just blank lines) and email; the reason and message
  kept to the function; the enum matches `decline.ts`.
- **End to end:** `e2e/mortgage-decline.spec.ts`: C2's dialog, "Other" held
  until the adviser writes, the Decision card, C1's Closed tab.

**Deviations**
- A decline is reached from C2 as well as C5, because a file can be declined
  before it goes to the banks (D19).

## Phase 6 — Partner banks and the decision: C5 · 29 Sep 2026

Ayush: "go ahead with Phase 6". Nothing about the banks is designed except
C5 itself, so the bank list, the bank step after "Accept application",
"Record response", the package the bank opens and the emails are built on
the defaults under "Defaults built in Phase 6" in DECISIONS.md (D3, CMS-2,
CMS-6), every string in `PENDING_CMS_COPY`.

**Built**
- **`0149_mortgage_banks_decision.sql`:** three outbox kinds; the banks'
  constraints and `mortgage_bank_label()`; and, through the adviser's own
  session:
  - `mortgage_save_bank` (the Head or an admin);
  - `mortgage_send_to_banks`: one submission per chosen bank with its own
    expiring package link (the hash only), the file to With banks through
    the transition (every document accepted, consent on file), and
    `bank.package_sent` naming the banks as the designs do;
  - `mortgage_bank_reminder`: a fresh link, one per ten minutes;
  - `mortgage_letter_presign` and `mortgage_record_bank_response`: an offer
    needs its figures, a validity from today and a clean letter; a decline
    needs neither; a new letter replaces the old;
  - `mortgage_pre_approve`: a pre-approved lead offer still in date, with its
    letter, and consent on file; the banks still deciding withdrawn; the
    clock stopped; `decision.pre_approved`; the email and WhatsApp queued.
- **`0150_mortgage_bank_emails.sql`** (a subagent): the bank package, the
  reminder and the pre-approval, as Content Assets drafts with Arabic
  machine drafts. `lib/email.ts` sends bytes as they are, so the letter goes
  as a PDF.
- **Server (`L/server/`):** `banks.ts` (the list, package links, the package
  page's lookup, state and view, the logged download), `letters.ts` (the
  letter's row, then the same checks as an applicant's PDF and the scan),
  `decision.ts` (C5's data: each bank's response, the 25-year payment from
  `payments.ts`, the tiles, the pricing basis). `notify.ts` delivers the
  pre-approval with the letter read from the private bucket as it's sent.
- **Domain:** `L/pre-approval.ts` (the message the adviser starts from);
  `activity.ts` words the bank steps and keeps their status changes quiet.
- **CMS (`A/`):** C5 at `[reference]/decision` — the tiles, the banks with
  the lead radio, "Record response", "Edit" and "Send a reminder", the
  pricing line, the activity, and the decision card (lead offer, rate,
  validity, the letter, the message, Send by, Confirm, and the Decline tab
  with C2's form); read-only once decided; anything not with the banks is
  sent back to C2. C2's "Accept application" now chooses the banks and
  sends, and a file with the banks shows "Open decision". The partner banks
  page at `/admin/mortgages/banks`, linked from C1 for the Head and admins.
- **API:** `/api/admin/mortgages/letters` (presign through the session) and
  `…/:fileId/complete`; `/api/mortgage/packages/:token/files/:fileId` (rate
  limited, logged as the bank first, no-store).
- **Website (`M/mortgages/p/[token]`):** the bank's package page. Opening it
  is logged before anything renders; no referrer, not indexed.
- **Local:** every seeded offer has a letter; each DB test file now switches
  off the banks it made and takes its staff off the team when it's done.

**Verified**
- **Unit:** `L/pre-approval.test.ts` (5) reproduces the design's sample
  message word for word, mentions no other bank when only one pre-approved,
  says a variable rate plainly, prices the design's offers over 25 years and
  formats C5's money, rates, dates and days;
  `cms.test.ts` words the bank activity lines (and a bank named before 0149
  by its code); `lib/secure-link-redaction.test.ts` keeps tokens out of
  analytics. The full suite: 4,638 pass.
- **Database:** `L/banks.db.test.ts` (10): sending (every document accepted,
  consent, the owner or the Head, a bank that can take it, a fresh page);
  the package (accepted documents only; a download logged as the bank before
  its bytes are read; expired says so; withdrawn shows nothing); the reminder
  (the old link dies, the new one opens, ten minutes between); responses
  (the figures, the letter, a replacement letter, a decline); pre-approving
  (the clock stops, the other bank is withdrawn, the email carries the
  letter's exact bytes, WhatsApp is recorded as skipped; refused for a lead
  that isn't pre-approved or has expired, without consent, for someone else,
  twice or on a stale page); the bank list (the Head or an admin); the label
  matches the database's. All 101 database tests pass (7 files). Removing
  the attachment makes the pre-approval test fail.
- **End to end:** `e2e/mortgage-decision.spec.ts` takes Priya from In review
  to Pre-approved: her last two documents accepted in C3, the file sent to
  FAB, ADCB and Mashreq, two offers recorded with their letters uploaded,
  AED 11,337 a month for FAB, the lead switched and back, Confirm, C2
  decided, the email handed to the mailer (a dry run locally) and WhatsApp
  skipped, Mashreq withdrawn, C5 read-only and C1's Closed tab. It makes its
  own Priya each run. With the other specs, all 10 pass, in either order.
- **In the browser** (local stack, 1440 and 375): C5 against the PNG on
  Arjun (BZM-26-0398, whose seeded banks carry the PNG's figures), the lead
  switch, Record response with a real upload, the Decline tab, Confirm to
  C2 and C1's Closed tab; the package page and a logged download; the banks
  page and adding a bank (with its audit row).
- **Done when:** Priya's file runs end to end in the spec, the applicant's
  email is built with the letter attached and handed to the mailer,
  WhatsApp is recorded as skipped, and C1 shows the file under Closed.

**Found and fixed**
- C3 drew statements' "Covers the last N months" from the months but only
  saved it when the reviewer changed a period, so statements whose months
  came from the upload showed every box ticked and couldn't be accepted.
  Accept now saves it from the files' months first, and the button counts it
  as the box shows it.
- The database tests left their banks active and their staff on the team:
  after a few runs the send dialog ticked 30 banks (past the 20 a file can
  go to), and each new request alerted 30 people, filling the outbox's batch
  before a test's own email. Each file now tidies up after itself.
- C5 listed the banks in the order the packages went; it now follows the
  team's order of banks, as the design does.
- Staff opening a bank's letter read "opened bank_letter" in the activity.
- Secure links' tokens could reach analytics: Phase 5 redacted
  `/mortgages/r/<token>` for PostHog only, and Vercel Analytics recorded
  every path whole. `lib/secure-link-redaction.ts` now swaps the token for
  `[token]` in applicant links and bank packages, for both.

**Deviations**
- "Record response" is a dialog, not the side panel C5's README proposes:
  the other undesigned CMS steps are dialogs too.
- The seeded ADCB offer has a letter (the PNG's activity shows none): an
  offer can't be recorded without one.
- The pre-approval email's subject is the decline's, so the two can't be told
  apart on a lock screen.
- Priya's C5 figures in the PNG are on Arjun in the seed; Priya is in review,
  as C2's PNG has her. The pricing line reads Arjun's salary (AED 41,000).

**Open**
- **Not applied to production:** `0138`–`0150`. Apply them at the batch
  merge; the flag stays `off`, and the bank list starts empty.
- D3: confirm the link approach with at least one bank; the Head enters the
  banks and their inboxes.
- D29: the three new emails are drafts. D1: WhatsApp is recorded as skipped.
- D6: with no scanner configured in production, a letter waits unusable
  (fail closed), like the applicant's files.
