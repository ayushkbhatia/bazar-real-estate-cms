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
