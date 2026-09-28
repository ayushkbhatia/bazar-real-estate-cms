# Mortgage module — implementation map

Phase 0 output, 28 Sep 2026. [SPEC.md](SPEC.md) and the two design handoffs
([frontend/](frontend/README.md) for W1–W8, [cms/](cms/README.md) for C1–C6)
were written against a generic platform stack. This file maps them onto this
repository. Both handoffs say "Phase 0's `IMPLEMENTATION.md` has the final say"
on locations, so where this file and a handoff's suggested file structure
disagree, this file wins.

Open decisions are referenced as **D-n** and tracked in
[DECISIONS.md](DECISIONS.md). Build history goes in [PROGRESS.md](PROGRESS.md).

---

## 0. What differs from what SPEC assumes

1. **No Drizzle, Better Auth, R2 or Inngest.** This repo is supabase-js over
   PostgREST with hand-applied SQL migrations, Supabase Auth plus the `staff`
   table, Supabase Storage, and Vercel Cron ([ADR-0003](../decisions/ADR-0003-vercel-cron-over-inngest.md)).
2. **Atomic writes are Postgres functions.** supabase-js has no client-side
   transactions, so "validate, write the status and a `mortgage_events` row in
   one transaction" (SPEC §2.4) is a `security definer` SQL function called
   with `.rpc()`. `lib/mortgage-requests/state.ts` is its pure TypeScript
   mirror for the UI and unit tests, and a parity test keeps the two in step.
   A trigger rejects any status change made outside that function.
3. **Mortgage team membership is its own column** (`staff.mortgage_role`:
   `head` | `adviser`), not two new `staff_role` values (D9). SPEC §3 allows
   either. Admins without it get a 404, as SPEC §7 requires.
4. **Route handlers live under `/api` here.** Anything else is rewritten into a
   locale segment (`lib/i18n/non-localised.ts`, enforced by
   `non-localised.test.ts`). So the logged file stream is
   `/api/admin/mortgages/files/[fileId]`, not `/admin/mortgages/files/[fileId]`.
5. **The website flow gets its own route group,** `app/[locale]/(mortgage)/`,
   because its shell (logo bar, permit line, Exit) replaces the public
   mega-nav and footer that `(public)/layout.tsx` renders.
6. **Public strings need Arabic in the catalogue.** `lib/i18n/messages.test.ts`
   (G-8) fails any key without an Arabic value, or with one identical to the
   English. SPEC says English only for v1, so the plan is machine-drafted Arabic
   in `messages/ar/mortgage.json` (ADR-0008) while the flow is served in English
   only until Bazar signs the Arabic off (D12). CMS strings stay out of
   `messages/`, because the admin is English by policy (ADR-0007 §6).
7. **There is no staging database.** Dev, CI, e2e and previews all use the one
   production Supabase project (`playwright.config.ts:31`,
   `scripts/vercel-ignore-build.sh`). Phases 1–2 run against a local Supabase
   stack in Docker (`npm run db:local:reset`, §1.14). Phases 3+ need a staging
   project for e2e, email/WhatsApp and UAT (D8). The mortgage seed must never
   reach production.
8. **Several things SPEC treats as available don't exist yet:** WhatsApp sending
   (only `wa.me` links, `lib/whatsapp.ts`), SMS, a code sent to a mobile (the
   valuation OTP is email-only), malware scanning, Turnstile, a PDF viewer, and
   live rate limiting (`lib/rate-limit.ts` is a no-op in production because no
   `UPSTASH_*` variable is set there — checked with `vercel env ls production`).
   Each is a build with an outside dependency (D1, D5, D6, D14).
9. **Supabase Storage has no lifecycle rules and no per-upload size
   condition.** Unclaimed drafts are purged by a cron, and size is enforced by
   the bucket cap, the presign check and a re-check on complete (§1.7).
10. **Two protected shared files have to change:** `components/brand/cms-shell.tsx`
    for the nav item, badge and role filtering (G1), and `lib/env.ts` for new
    environment variables (G3). Both need an explicit go-ahead
    (see the shared-files rule in project memory).

---

## 1. Where each part of SPEC goes

### 1.1 Stack mapping

| SPEC assumes | This repo | Notes |
|---|---|---|
| Postgres + Drizzle, UUID v7 | Supabase Postgres; SQL in `supabase/migrations/NNNN_name.sql`, applied by hand in filename order; `gen_random_uuid()` ids | Next free number today is `0138`. `npm run db:check` catches duplicate numbers after a rebase |
| Generated types | `npm run db:types` writes `db/types.ts` | Run after every migration |
| Better Auth, staff roles | Supabase Auth + `staff` + `lib/auth.ts` (`requireRole`, `getStaffRole`, `getCurrentStaffRow`) | Add `requireMortgageRole()` |
| Cloudflare R2 | Supabase Storage private bucket (default) or AWS S3 in `me-central-1` (if D4 requires UAE residency) | Behind one adapter, §1.7 |
| Inngest | Vercel Cron + queue columns and an outbox table | ADR-0003 pattern |
| Resend | `lib/email.ts` + the Content Assets system-email registry | §1.9 |
| WhatsApp Business Cloud API | Not built | New adapter + webhook, §1.9 |
| Turnstile | Not built | §1.12 |
| MSW mocks | Not installed | Not needed: Phases 1–2 ship the real API before the screens |
| Storybook "stories" | Not installed | A staff-only state gallery page per module instead, §1.14 |
| PostHog | `lib/posthog.tsx`, consent-gated | Keys unset in production, so events are dropped until set |
| Sentry | Installed, no `beforeSend` scrubbing | DSN unset in production |

### 1.2 Database

**Migrations.** Phase 1 built two:

1. `0138_mortgage_requests.sql`: enums, tables, indexes, RLS, grants,
   `staff.mortgage_role` and `mortgage_role()`.
2. `0139_mortgage_functions.sql`: the transition function, request creation,
   reference allocation, owner assignment, the event log writer, the status
   guard and the append-only guard.

The new `notification_kind` values for in-app alerts come in Phase 4, in a
migration of their own, because `alter type … add value` can't be used in the
transaction that adds it (precedent: `0119_media_folder_fonts.sql`).

Both migrations grant the service role explicitly. Newer Supabase images no
longer grant API roles table access by default, though production (an older
project) still does, so the module doesn't depend on which kind of project it
lands in.

**Tables.** Everything in SPEC §3, plus what the designs need and SPEC leaves out:

| Addition | Why |
|---|---|
| `staff.mortgage_role` (enum `mortgage_team_role`: `head`, `adviser`; nullable) | D9. Keeps the single `staff_role` model and the ~60 `*_ROLES` lists untouched |
| `mortgage_requests.submission_key uuid unique` | The `Idempotency-Key` the frontend sends on submit (frontend foundations §8 asks for it) |
| `mortgage_requests.property_ref text` next to `property_id` | `?property=<ref>` arrives as `properties.reference` (e.g. `BAZ-AD-04891`). Unknown refs are kept as text and `property_id` stays null |
| `mortgage_requests.locale text default 'en'` | Same as `enquiries.locale` (0100), so Arabic emails can follow later |
| `mortgage_settings` (single row) | Feature flag state, assignment mode (D18), link expiry days, retention months (D7), consultation length (20 min), slot grid (30 min), round-robin cursor |
| `mortgage_adviser_hours` (`staff_id`, `weekday`, `starts`, `ends`) | C6 slots are "working hours minus bookings", and SPEC has no table for working hours |
| `mortgage_notifications` (outbox), Phase 3 | "Enqueue notifications" with retries and a visible failure state, §1.8 |
| `mortgage_reference_counters` (`yy`, `last_number`) | `BZM-YY-NNNN` allocation with `insert … on conflict do update … returning`, which is safe under concurrent submits |
| `mortgage_holidays` (`day`, `name`) | Dates the clock skips (D30) |
| `mortgage_requests.sla_remaining_seconds` | The clock runs on working hours (D11). A pause freezes the working time left, and a resume counts it forward from then. SPEC's `due = start + 24h + paused` only holds on wall-clock time |
| `mortgage_files.kind` | Draft uploads have no document row until submit |
| `mortgage_bank_submissions.package_token_hash` | The expiring package link (Phase 6) |
| `mortgage_access_links.otp_sent_at` | The resend cooldown (SPEC §8) |
| `mortgage_consultations.ends_at` | The double-booking exclusion constraint needs an immutable range |

Email is stored trimmed and lower-cased as `text` with an index, instead of
enabling `citext`. `mortgage_documents.recorded` (jsonb) also holds the
reviewer-typed values CMS-3 asks for (issue date, addressee).

**RLS.** Enabled on every mortgage table, with **no policies for `anon`**.
`authenticated` gets `select` only where `public.mortgage_role()` is not null
(a new helper modelled on `is_staff()`, `0001_core.sql:304-330`). There are no
direct `insert`/`update`/`delete` policies. Every write goes through a
`security definer` function that checks role and ownership (SPEC §7). Public
route handlers and crons use the service-role client (`lib/supabase/admin.ts`)
only after their own checks: Turnstile, rate limit, and draft or link token.

**Invariants in the database, not just the app:**

- *Only the transition function writes `status` and the `sla_*` columns.* A
  `before update` trigger raises unless the function set a transaction-local
  flag (`set_config('mortgage.transition', 'on', true)`).
- *`mortgage_events` is append-only.* A `before update or delete` trigger raises
  (pattern: `0117_content_assets_system_keys.sql:178-219`). Only the retention
  and DSR-erasure functions may delete, through the same flag mechanism.
- *Reference numbers are never reused.* The counter only moves forward.

**Registries every new table must join:** `lib/i18n/domains.ts` (G-9,
`domains.test.ts`), registered with `columns: []` and an `excluded` reason, like
`otp_codes` at `domains.ts:967-970`. The DSR export and erasure are covered in §1.15.

**Name check.** SPEC's enum names (`mortgage_service`, `mortgage_status`, …) don't
collide with the three already in the database from `0008_tools.sql`
(`mortgage_inquiry_status`, `mortgage_loan_type`, `mortgage_buyer_status`).

### 1.3 Domain module — `lib/mortgage-requests/`

This is not `lib/mortgage/` as the handoffs suggest, because `lib/mortgage.ts`
already exists (the calculator's maths). A same-named directory beside it
resolves correctly but reads ambiguously.

| File | Contents | Phase |
|---|---|---|
| `documents.ts` | Document sets per path, per-kind file rules (SPEC §2.2), `requiredStatementMonths(kind, submittedAt)` | 1 |
| `checklists.ts` | Review checks per kind, as data (SPEC §2.3) | 1 |
| `state.ts` | The transition table and `canTransition()`, mirroring the SQL function; parity test | 1 |
| `sla.ts` | The working calendar, `slaStatus(request, now, policy)`, the pause/resume/start payloads for the SQL functions, duration formatting ("17h 42m") | 1 |
| `dubai-time.ts` | Asia/Dubai as a fixed +04:00 offset (no DST), checked against Intl | 1 |
| `reference.ts` | Format, parse, and search normalisation (with or without "BZM-") | 1 |
| `payments.ts` | Re-exports `monthlyPayment` from `lib/mortgage.ts:70` | 1 |
| `coverage.ts` | Union of statement periods against the required months | 5 |
| `slots.ts` | Adviser slots: working hours minus bookings, 20-minute meetings on a 30-minute grid | 4 |
| `format.ts` | Asia/Dubai formatters from both foundations §9 | 3 |
| `schemas.ts` | zod schemas shared by W2 and the submit endpoint | 3 |
| `testing/local-stack.ts` | The local stack's address and keys for the database tests, read from the CLI | 1 |
| `cms-strings.ts` | CMS copy, verbatim from `cms/**/strings.en.json` | 4 |
| `server/queries.ts`, `server/actions.ts` | Page loaders and the server-action wrapper (authorise → validate → RPC → outbox) | 4 |
| `server/storage.ts`, `server/verify.ts`, `server/scan.ts` | Storage adapter; magic bytes, encrypted-PDF detection, page count, sha256; scanner adapter | 2 |
| `server/links.ts`, `server/otp.ts` | Secure links and codes (SPEC §8) | 5 |
| `server/notify.ts` | Email, WhatsApp and in-app delivery for the outbox | 3–6 |
| `client/apply-store.ts`, `client/upload-queue.ts`, `client/api.ts` | Wizard state, upload engine, API client (frontend foundations §6–8) | 3 |

**Verified:** `monthlyPayment(2_150_000, 3.99, 25)` = 11,336.62, which rounds
to **AED 11,337**, matching SPEC §3 and C5.

### 1.4 Website routes

```
app/[locale]/(mortgage)/layout.tsx                    flag gate, noindex, flow shell
app/[locale]/(mortgage)/_components/                  FlowLayout, FlowStepper, ServiceCard, DocumentUploadRow, …
app/[locale]/(mortgage)/mortgages/apply/layout.tsx    wizard store provider, step guards
app/[locale]/(mortgage)/mortgages/apply/page.tsx               W1
app/[locale]/(mortgage)/mortgages/apply/details/page.tsx       W2
app/[locale]/(mortgage)/mortgages/apply/review/page.tsx        W3
app/[locale]/(mortgage)/mortgages/apply/documents/page.tsx     W5 / W6
app/[locale]/(mortgage)/mortgages/apply/received/page.tsx      W4 / W7
app/[locale]/(mortgage)/mortgages/r/[token]/page.tsx           W8 + invite landing (server-rendered)
```

- The root `app/[locale]/layout.tsx` still supplies html/body, fonts, consent and
  analytics. The group adds only the flow shell.
- Every page is `force-dynamic`, because it reads the flag and the session.
  Force-dynamic routes never enter the `check:routes` baseline.
- **Guards to extend to the new group**, so the flow gets the same protection
  as `(public)`. Each currently globs only `(public)`:
  - `no-unextracted-literals.test.ts:178` (G-13)
  - `no-hand-rolled-plurals.test.ts:104-105` (G-14)
  - `no-hardcoded-locale-tags.test.ts:147-148` (G-19)
  - `no-bare-link.test.ts:55`
- `ROUTE_NAMESPACES.mortgage = ["app/[locale]/(mortgage)/"]` in
  `lib/i18n/namespaces.ts`, so the flow's strings reach the browser only on
  these routes.
- `/ar/mortgages/*` redirects to the English path while D12 is open. This goes
  in `proxy.ts`, next to the existing `/ar/admin` redirect.
- Headers: `noindex` on the whole group. `/mortgages/r/*` also sends
  `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
- The mobile-geometry, a11y and Lighthouse route lists are hard-coded. Add W1
  (and whichever steps can render without state) by hand in Phases 3 and 7.

### 1.5 Public API

Route handlers under `app/api/mortgage/…`, exactly as SPEC §4.2. These paths are
already non-localised. Additions:

| Path | Why |
|---|---|
| `GET /api/mortgage/drafts/:id/files/:fileId` | Poll a file that is still `pending` a scan (§1.8). Returns `{ status }` only |
| `GET /api/mortgage/packages/:token` | The expiring, logged bank-package link (Phase 6) |
| `POST /api/webhooks/whatsapp` | Inbound replies (C6 "replied on WhatsApp") and delivery status, once D1 lands |

- The draft token is 256-bit random, stored hashed, and sent as
  `Authorization: Bearer`, never in a URL. The same applies to link tokens,
  except that the link token *is* the URL. It is stored hashed, and never logged.
- File bytes never pass through our functions on upload (Vercel's 4.5 MB body
  cap). The browser PUTs straight to storage. `…/complete` reads the object
  server-side (at most 40 MB) to verify it. Set `maxDuration` on that handler.

### 1.6 CMS routes

```
app/[locale]/(admin)/admin/mortgages/layout.tsx                        requireMortgageRole(); 404 for everyone else, admins included
app/[locale]/(admin)/admin/mortgages/page.tsx                          C1
app/[locale]/(admin)/admin/mortgages/[reference]/page.tsx              C2 or C6, by service
app/[locale]/(admin)/admin/mortgages/[reference]/documents/[kind]/page.tsx   C3 / C4
app/[locale]/(admin)/admin/mortgages/[reference]/decision/page.tsx     C5
app/[locale]/(admin)/admin/mortgages/banks/page.tsx                    partner banks (not designed; CMS table pattern; head + admin)
app/[locale]/(admin)/admin/mortgages/settings/page.tsx                 flag, assignment mode, adviser hours (not designed; proposal)
app/[locale]/(admin)/admin/mortgages/_components/, _actions.ts
app/api/admin/mortgages/files/[fileId]/route.ts                        logged file stream (SPEC path moved under /api)
```

- **Gate.** The admin layout already requires an active staff row
  (`(admin)/layout.tsx:18-24`, `66-84`). The mortgages layout adds
  `requireMortgageRole()`. `/api/admin/*` is not covered by the proxy's sign-in
  redirect, so the file route checks the session and role itself, as
  `api/admin/audit-log/export/route.ts:15` does.
- **Nav (G1).** Add "Mortgage requests" to `NAV_GROUPS` in
  `components/brand/cms-shell.tsx:43`, in the Inbox group after Enquiries, with
  a count badge showing `new` requests. `NavItem` has no badge or role field
  today, and nothing in the shell filters by role. The count is seeded in the
  admin layout with a count-only query, as the notifications bell is
  (`(admin)/layout.tsx:73-76`), and only for mortgage roles.
- **Refresh.** C1 polls with `router.refresh()` every 30 seconds (SPEC §4.3).
  No Realtime, which also avoids the dual-mount channel issue.

### 1.7 File storage

One adapter, `lib/mortgage-requests/server/storage.ts`:
`presignUpload(key, { contentType, size })`, `head(key)`, `read(key)` and
`remove(keys)`.

**Default (D4 = Tokyo acceptable): Supabase Storage**

- A new bucket, `mortgage-files`, with `public = false`,
  `file_size_limit = 41943040` (40 MiB, the largest single file SPEC allows) and
  `allowed_mime_types = application/pdf, image/jpeg, image/png`.
- **No `storage.objects` policies at all,** so only the service role can touch
  it. Compare `media`, where anyone can read and any staff member can write
  (`0002_storage.sql:12-37`).
- Presign with `createSignedUploadUrl`. Its validity is fixed at 2 hours. It
  takes no size condition, so per-kind limits and running totals are enforced
  in three places:
  - at presign, on the declared size;
  - by the bucket cap;
  - on complete, against the stored object's real size.

  An object that breaks its kind's rule is deleted and the file row marked
  `removed` with `too_large` or `total_exceeded`.
- Keys are flat: `f/{fileId}`. No draft, request or reference goes in the path,
  so no PII is in keys, and nothing moves on submit. Drafts are purged by
  database state (expired and unclaimed), not by prefix.
- Reads never hand a signed URL to the browser. The file route streams through
  the service role after the role check and the event insert, with
  `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and
  `Content-Disposition` `inline` (view) or `attachment` (download).

**If D4 requires UAE residency: AWS S3 in `me-central-1`**

- Presigned PUT with a signed `Content-Length`, SSE, a `drafts/` lifecycle rule
  and CORS limited to `https://www.bazarrealestate.ae`.
- Same adapter; env `MORTGAGE_S3_*` (G3). Database rows would still be in
  Tokyo unless D4 says otherwise.

The private `documents` bucket left over from the Deal Room (`0012`, policies
dropped in `0069`) is not reused. Check that it's empty and drop it in Phase 2
(needs G2 for the live check).

### 1.8 Background jobs

The repo's pattern: a Vercel Cron route with a Bearer `CRON_SECRET` check
(copied per route, e.g. `api/cron/enquiry-auto-reply/route.ts:37-49`),
`recordHeartbeat`, `reportError` (without PII), and bounded batches from day
one. A job's first run is unbounded otherwise; see the 23 Sept cron activation
in project memory.

| SPEC job | Here | Schedule |
|---|---|---|
| `request.submitted` | Owner assignment inside the submit function; emails and team alerts go to the outbox | — |
| `file.scan` | **Inline on `…/complete`** when the scanner answers in time. `/api/cron/mortgage-worker` retries `scan_status = pending` | every minute |
| `reupload.requested`, `reupload.fulfilled`, `bank.package`, `decision.sent`, `consultation.booked` | Outbox rows written in the same database function as the change; first send attempted inline, retries in `mortgage-worker` | every minute |
| `sla.tick` | `/api/cron/mortgage-sla-tick`, idempotent through `sla_*_notified_at` | every 5 minutes |
| Drafts lifecycle rule | `/api/cron/mortgage-housekeeping`: expired unclaimed drafts (objects + rows), expired links | hourly |
| `retention.purge` | `/api/cron/mortgage-retention` | daily |

Each new cron needs:

- an entry in `vercel.json` (`lib/cron-routes.test.ts` requires the two to match one to one);
- its interval in `lib/queries/health.ts:42-58`, so `/admin/settings/health` shows it when it's late.

Scanning inline keeps the upload row's "Uploading" state from waiting for a
cron tick. The file answers `pending` until it's clean, and the client polls.

### 1.9 Notifications

**Email.** Every mortgage email becomes a Content Assets system email, so the
admin gallery previews it and an editor can rewrite it without a deploy. The
steps are in `docs/CONTENT_ASSETS.md:360-374`:

- a migration that rewrites the key constraint and inserts a draft row;
- English and Arabic defaults, byte-matched to code;
- a template function;
- a binding with a sample.

Proposed keys:

| Audience | Keys |
|---|---|
| Applicant | `mortgage_consultancy_received`, `mortgage_preapproval_received`, `mortgage_reupload_request`, `mortgage_preapproval_invite`, `mortgage_consultation_booked` (with `.ics`), `mortgage_decision_approved` (with the letter), `mortgage_decision_declined`, `mortgage_code` (only if D5 falls back to email) |
| Team | `mortgage_team_new_request`, `mortgage_team_at_risk`, `mortgage_team_breached`, `mortgage_team_reupload_received` |
| Banks | `mortgage_bank_package`, `mortgage_bank_reminder` |

- None of their copy is designed. SPEC §6 only summarises them (D29).
- The existing `mortgage_enquiry_ack` stays until the calculator's old form is
  retired (D25).
- `lib/email.ts:136-143` converts attachments from UTF-8 strings. The letter
  PDF needs binary support; the `.ics` is text and works today.

**WhatsApp (D1).** A new `lib/whatsapp-cloud.ts` (Graph API template sends,
plus a check for the 24-hour customer-service window from the last inbound
message) and `app/api/webhooks/whatsapp/route.ts`, verified with
`X-Hub-Signature-256`.

- Env: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_VERIFY_TOKEN` (G3).
- When these aren't set, the channel is skipped and recorded as skipped in the
  outbox, and email still goes. This follows the handover rule to degrade
  gracefully without a key.
- C4 and C5 show the WhatsApp checkbox disabled, with a note (CMS-17).

**Codes (D5).** SPEC keeps the code on `mortgage_access_links` (`otp_hash`,
`otp_expires_at`, `otp_attempts`), separate from `otp_codes`.

- Reuse `lib/otp.ts`'s HMAC approach but not its code. Its verify checks only
  the newest code, so asking for a new code resets the attempt count. Its
  attempt counter isn't atomic, and nothing limits sends.
- Here the attempt count moves in an RPC, the link locks at 5 failed attempts,
  there is a 60-second resend cooldown, and sends are rate-limited per link and
  per IP.

**In-app.** Uses the existing `notifications` table and bell
(`emitNotification`, `lib/notifications.ts:41`), with new `notification_kind`
values (migration 3 in §1.2).

### 1.10 Feature flag and entry points

There is no flag system in the repo, so Phase 1 builds one: a `mortgage_settings.flag`
column set to `off` | `staff` | `public` (default `off`), editable at
`/admin/mortgages/settings` by the Head of mortgages and admins. Flipping it
needs no deploy, which matters here: every production deploy empties the ISR
cache.

| Flag | Website flow | Public API | Entry points |
|---|---|---|---|
| `off` | 404 | 404, except secure links already issued | hidden |
| `staff` | Signed-in active staff only | Same rule | hidden (staff use the URL) |
| `public` | Everyone | Everyone | shown |

Entry points (SPEC §4.1):

| Entry | Today | Change |
|---|---|---|
| Home · Get pre-approval today | `mortgage-calculator-section.tsx:148-153` links to `/tools/mortgage` (also the `mortgage_calculator` Page Builder block) | Code reads the flag |
| Calculator · Start pre-approval | The master-page copy `lib/master-pages/sections/mortgage.ts:226-250` and the `mortgage_preapproval` form | Code default reads the flag; retire the form (D25) |
| Property detail · Get mortgage pre-approval | Doesn't exist. Only a "Mortgage eligible" badge, `p/[slug]/page.tsx:582-586` | New button |
| Calculator · Talk to advisor | Master-page copy links to `/contact` | Code default reads the flag |
| Services menu · Mortgage assistance | Megamenu database row "Mortgage Support", linking to `/tools/mortgage` (`0047`) | A content edit at launch (no deploy) |

Master-page copy is editable, so the live rows may already differ from the code
defaults. Check the live values at launch rather than trusting the seed.

### 1.11 Strings and i18n

- **Website:**
  - `messages/en/mortgage.json`, merged from `frontend/00-foundations/strings.shared.en.json`
    and each screen's `strings.en.json`, in ICU. The `<b>`, `<ink>` and `<link>`
    tags go through `t.rich`.
  - `messages/ar/mortgage.json` is a machine first draft (`npm run i18n:translate`),
    because G-8 requires one. The consent wording is legal text: keep its Arabic
    out of any live page until a person approves it (D2, D12).
  - Add `mortgage` to `NAMESPACES` and `ROUTE_NAMESPACES`.
- **CMS:** `lib/mortgage-requests/cms-strings.ts`, verbatim from
  `cms/**/strings.en.json`, formatted with next-intl's `createTranslator({ locale: "en" })`.
  These strings are not in `messages/`, which would make G-8 demand Arabic for a
  screen that never shows it.
- **Plurals** use ICU only (G-14 bans hand-rolled plurals on public routes).
- **Dates** are formatted in `lib/mortgage-requests/format.ts` with `Asia/Dubai`
  and the request locale. Don't write `toLocaleString("en-GB")` in page files
  (G-19).

### 1.12 Bot protection and rate limits

- **Turnstile** (invisible) on draft creation and on submit (SPEC §4.2).
  - A new `lib/turnstile.ts` does the server-side verify, and the widget script
    loads only on flow pages.
  - Env: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (G3, D14).
  - `next.config.ts` sets no Content-Security-Policy today, so the script needs
    no CSP change.
- **Rate limits** go through `lib/rate-limit.ts` (Upstash sliding window). There
  are buckets for:
  - drafts per IP;
  - presigns per draft;
  - code sends per link and per IP;
  - verifies per link;
  - submits per IP.

  They do nothing until `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set in production
  (D14). Setting them also switches on the existing limits on every other form.

### 1.13 Analytics and observability

- **PostHog events** exactly as both handoffs list them, through a wrapper that:
  - drops PII keys;
  - reports route patterns (`/mortgages/r/[token]`) rather than URLs.
- **`reportError`:** `error_events` is readable by every staff member
  (`0134:73-74`), so mortgage error context carries ids and codes only.
  No names, emails, mobiles, file names or tokens.
- **Sentry:** add a `beforeSend` scrubber in Phase 7 (`instrumentation.ts`,
  `instrumentation-client.ts`). Error reporting only exists once a DSN is set.

### 1.14 Tests, environments and seed

**Unit tests (vitest, jsdom)** cover:

- every transition, allowed and illegal
- the SLA: pause, resume, at-risk at 4 hours, breach, met
- statement months across a year boundary
- per-kind limits, including multi-file totals
- reference formatting
- the AED 11,337 payment
- every clock in C1, reproduced from the design data on wall-clock time
- later phases add coverage unions, slots, formatters, the upload queue and the zod schemas

**Database tests** (`*.db.test.ts`) run against the local Supabase stack:

- `npm run db:local:reset` starts the stack (Docker; config in
  `scripts/db-local/supabase/config.toml`, ports 55321–55329 so it doesn't
  collide with other projects), empties the database, and applies every file
  in `supabase/migrations` in filename order.
  - The CLI's own migration runner is switched off because it skips lettered
    files like `0055a_`.
  - Production's default privileges are restored first, because newer Supabase
    images grant API roles almost nothing.
  - The history before `0138` doesn't replay cleanly (production was partly
    shaped by hand). Four old files error and are listed, then tolerated. From
    `0138` on, one error fails the reset.
- `npm run test:db` runs them (`vitest.db.config.ts`). They skip with a warning
  when the stack isn't up, and the default `npm run test:run` excludes them.
- They cover:
  - the transition function against `state.ts` on every status × event × actor;
  - the status and append-only triggers, for the service role and the superuser;
  - reference allocation under 40 parallel calls, and racing retries of one submit;
  - the clock columns through start, pause, resume and stop;
  - RLS and roles: an admin without a mortgage role reads nothing, and an
    adviser can act only on their own requests.

**End-to-end (Playwright):**

- Mortgage specs are skipped unless `MORTGAGE_E2E_BASE_URL` points at staging.
  CI's e2e job runs against the production database, and must never submit an
  application or send an email.
- Admin flows also need a staging staff login. CI can't sign in as staff today.

**Seed:**

- `scripts/db-local/seed-mortgage.ts`, which prints SQL that `db:local:reset` loads. It reproduces:
  - C1's 11 rows;
  - Priya Raman (BZM-26-0412), Karim Haddad (BZM-26-0409) and Ahmed (BZM-26-0415, the C6 consultancy);
  - Yasmin Abdalla (head), Rashid Khan and Leena Varghese (advisers);
  - FAB, ADCB and Mashreq.
- Times are relative to now through `sla.ts`, so the queue shows the designed
  remaining times (17h 42m, Paused · 9h 13m…) whenever it runs.
- File rows are metadata only. Phase 2 adds placeholder objects.
- It connects to nothing itself; only the local reset pipes it into the Docker
  database.
- `npm run db:seed` posts to the remote project, which is production, so it is
  never used for this.

**Design comparison.** A staff-only state gallery
(`/admin/mortgages/_gallery`, plus one in the flow group behind `staff` mode)
renders each component in each designed state from fixtures. It stands in for
the Storybook stories the handoffs ask for, and for W6's "fixture that
reproduces the PNG".

### 1.15 DSR and retention

**DSR export and erasure,** keyed on email and `mobile_e164`:

- extend `lib/queries/dsr-subject.ts` and the archive in `lib/dsr.ts`;
- re-issue `anonymise_by_email` with a mortgage block, re-applying its
  revoke/grant (`0083:116-117`). Function bodies aren't dependency-tracked, and
  that has already broken erasure once (`0069:22-28`);
- delete storage objects from app code, since SQL can't;
- remove events through the same flag-gated path as retention.

**Retention:**

- drafts are purged after 24 hours;
- links expire after 7 days (D7);
- files are purged N months after `closed_at` (D7).

Bank packages already sent can't be recalled, so erasure should record that
fact rather than imply it.

---

## 2. Reuse, and conflicts with SPEC

### 2.1 Reuse

| Need | Existing code | Note |
|---|---|---|
| 25-year payment | `monthlyPayment`, `lib/mortgage.ts:70-87` | Verified at 11,337 |
| LTV tiers | `site_settings.mortgage` (`0107`), edited at `/admin/settings/mortgage` | See conflict 8 |
| File page layout | Enquiry detail, `enquiries/[id]/page.tsx:336` (`lg:grid-cols-[1fr_320px]`, sticky rail) | C2/C6 use 340px |
| Queue table, tabs, pagination | `properties/_table.tsx:75`, `_status-tabs.tsx:21`, `_pagination.tsx:9` (built, never mounted) | |
| Search input and filters | `audit-log/_filters.tsx:7` with `escapeIlike` (`lib/queries/audit.ts:99-105`) | |
| Reassign select | `properties/[id]/_components/assigned-agent-card.tsx:25` (optimistic, rolls back) | |
| Contact buttons | `buildWhatsAppLink`, `lib/whatsapp.ts:37`; the enquiry detail's call/email/WhatsApp buttons | |
| Server action result and toast | `{ status, message }` in `enquiries/_actions.ts:34-36`, then `sonner` | |
| Direct-to-storage upload | `admin/media/_upload-actions.ts:73,113` and `_upload-client.ts:95-98` | |
| Deleted Deal Room | `git show 33043146^:app/(admin)/admin/deals/[id]/_timeline.tsx` (stage rail), `_documents.tsx` (document pane); `git show 633f18fa:lib/documents-storage.ts` (signed-URL surface) | Prior art only |
| Multi-step UX | Sell wizard `services/sell/_components/list-property-form.tsx` (step header, sessionStorage draft, screen-reader step announcements); valuation wizard `ProgressStrip` | Don't copy its pre-ticked consent (`:333`) |
| Image zoom and pan | `developments/[slug]/_components/floor-plan-lightbox.tsx:101` | Public side; the viewer needs rotate too |
| Crons and health | `api/cron/*`, `lib/observability.ts`, `lib/queries/health.ts` | |
| Append-only trigger | `0117_content_assets_system_keys.sql:178-219` | |
| In-app alerts | `lib/notifications.ts:41`, `components/brand/notifications-bell.tsx` | |
| Rate limiting | `lib/rate-limit.ts:100` | Needs Upstash in production |
| Time in render | `serverNow()` (`enquiries/[id]/page.tsx:88-90`) | Keeps `Date.now()` out of render |

### 2.2 Conflicts

1. **Stack names** throughout SPEC and the handoff prompts (Drizzle, R2, Inngest,
   MSW, Storybook). §1.1 maps each one.
2. **Staff roles.** SPEC adds two enum values. This repo has one role per
   person, and RLS knows only "any staff" and "admin". New enum values would
   inherit write access on every `is_staff()` table and need the admin layout's
   hard-coded list (`(admin)/layout.tsx:18-24`) plus the users screen changed.
   The recommendation is `staff.mortgage_role` (D9).
3. **File route path** (`/admin/mortgages/files/…` becomes `/api/admin/mortgages/files/…`).
4. **"English only"** against G-8 (D12).
5. **Storage capabilities.** Supabase Storage has no lifecycle rule, no size
   condition on a presigned upload, and no bucket CORS setting (§1.7).
6. **The calculator already files mortgage leads.** `mortgage_preapproval`
   (`lib/forms/registry.ts:1098-1149`) creates an enquiry with source
   `mortgage`, which syncs to Salesforce `Lead__c` as "Buy". What happens to it,
   and whether new requests also reach Enquiries or Salesforce, are D25 and D13.
7. **`mortgage_inquiries`** (`0008_tools.sql:156-187`) is dormant: nothing
   writes to it. Leave it, and count its production rows before deciding (D26, G2).
8. **Three loan-to-value answers on one site.**
   - W2 and C2 say UAE National up to 85% and expat up to 80%, matching the
     Central Bank caps for a first home under AED 5M.
   - The calculator's defaults compute 75% for residents under AED 5M.
   - The property FAQ (`lib/master-pages/property-page.ts:337-340`) says 80% and 60%.

   The recommendation is to fill `{ltv}` from settings, with the design's values
   as defaults, and align the calculator (D23).
9. **Non-residents.** W2 offers only UAE National or UAE Resident/Expat, and
   its mobile field accepts only UAE mobiles. The calculator supports
   non-residents (D24).
10. **Protected files.** `components/brand/cms-shell.tsx` (G1) and `lib/env.ts` (G3).
11. **Admin end-to-end tests** aren't possible in CI today (§1.14).
12. **Binary email attachments** aren't supported yet (§1.9).
13. **CLAUDE.md said the CMS has "deals (Kanban stages, documents, KYC)".** That
    module was removed in #214 (`33043146`). Corrected in this PR.

---

## 3. Missing platform prerequisites

| Prerequisite | State today | Needed by | Decision |
|---|---|---|---|
| A non-production database | None; everything uses production | Phase 1 (local stack), Phase 3 (staging) | D8 |
| Private file storage in the agreed region | Only the public `media` bucket in use; Tokyo region | Phase 2 | D4 |
| Malware scanning | None | Phase 2 | D6 |
| Turnstile | None | Phase 2 | D14 |
| Rate limiting in production | Code exists; `UPSTASH_*` unset | Phase 2 | D14 |
| WhatsApp Cloud API, templates, webhook | `wa.me` links only | Phase 4 (invites), Phase 5 (re-upload, codes) | D1 |
| A code sent to a mobile | Email-only OTP | Phase 5 | D5 |
| PDF tooling | None; add `pdfjs-dist` for the server checks and the viewer | Phase 2 / 5 | — |
| Feature flag | None | Phase 1 | Built here, §1.10 |
| Staff login for e2e | None | Phase 4 | D8 |
| Error tracking and analytics in production | Sentry DSN and PostHog keys unset | Phase 7 | — |

---

## 4. Files per phase

Paths abbreviated: `M/` = `app/[locale]/(mortgage)/`, `A/` =
`app/[locale]/(admin)/admin/mortgages/`, `L/` = `lib/mortgage-requests/`.

| Phase | Creates | Changes |
|---|---|---|
| **1** Data model & domain (built) | `0138`, `0139`; `L/{documents,checklists,state,sla,reference,payments,dubai-time}.ts` + tests; `L/database.db.test.ts`, `L/testing/local-stack.ts`; `scripts/db-local/{reset.sh,seed-mortgage.ts,supabase/config.toml}`; `vitest.db.config.ts` | `db/types.ts` (mortgage parts spliced from the local schema); `lib/i18n/domains.ts`; `vitest.config.ts`; `package.json` scripts |
| **2** Storage | Bucket migration (or S3 setup); `L/server/{storage,verify,scan}.ts`; `app/api/mortgage/drafts/**`; `app/api/admin/mortgages/files/[fileId]/route.ts`; `app/api/cron/mortgage-{worker,housekeeping}`; `lib/turnstile.ts`; integration tests | `vercel.json`; `lib/queries/health.ts`; `lib/env.ts` (G3); `.env.example`; `package.json` (`pdfjs-dist`) |
| **3** Website W1–W7 | `M/**` (layouts, pages, `_components`); `L/client/*`; `app/api/mortgage/requests/route.ts`; `messages/{en,ar}/mortgage.json`; system-email migration + templates; `e2e/mortgage-*.spec.ts` (staging-gated) | `lib/i18n/namespaces.ts`; the four guard globs; `proxy.ts`; `lib/content-assets/*`; `lib/email-templates.ts`; entry points (home band, property page, calculator defaults) |
| **4** CMS C1, C2, C6 | `lib/auth.ts` (`requireMortgageRole`); `L/slots.ts`; `A/{layout,page,[reference]/page,settings/page}.tsx`, `A/_components`, `A/_actions.ts`; `L/server/{queries,actions,notify}.ts`; `L/cms-strings.ts`; `app/api/cron/mortgage-sla-tick`; `.ics` builder; `lib/whatsapp-cloud.ts` + webhook (if D1 has landed) | `components/brand/cms-shell.tsx` (G1); `(admin)/layout.tsx` (nav count); `vercel.json`; `lib/queries/health.ts` |
| **5** Review loop C3, C4, W8 | `A/[reference]/documents/[kind]/page.tsx` + viewer; `M/mortgages/r/[token]/page.tsx` + invite landing; `app/api/mortgage/links/**`; `L/server/{links,otp}.ts` | `L/server/notify.ts` |
| **6** Banks & decision C5 | `A/banks/page.tsx`; `A/[reference]/decision/page.tsx`; `app/api/mortgage/packages/[token]/route.ts` | `lib/email.ts` (binary attachments) |
| **7** Hardening | `docs/mortgage/SECURITY-REVIEW.md`, `RUNBOOK.md`; `app/api/cron/mortgage-retention`; DSR migration | `lib/queries/dsr-subject.ts`; `lib/dsr.ts`; `instrumentation*.ts`; the e2e a11y and mobile-geometry route lists |

**Indicative schedule,** using PLAN's sizes, starting Tue 29 Sep, on UAE
working days (Mon–Fri). This assumes each decision lands by its phase:

| Phase | Days | Dates |
|---|---|---|
| 1 | 2 | 29–30 Sep |
| 2 | 2 | 1–2 Oct |
| 3 | 3 | 5–7 Oct |
| 4 | 3 | 8–12 Oct |
| 5 | 4 | 13–16 Oct |
| 6 | 3 | 19–21 Oct |
| 7 | 3 | 22–26 Oct |

PLAN assumes the platform prerequisites exist; here they don't (§3). Budget
about a week more, mostly waiting on outside parties, not code.

**PRs are held and merged in batches.** Every merge to `main` is a production
deploy, and the Vercel ignore script only skips previews, so even a docs-only
merge empties the ISR cache. Merge phases in batches behind the flag, per the
batch rule in the global CLAUDE.md.

---

## 5. Risks, and SPEC decisions to push back on

### Pushback

1. **Mortgage role as a column, not two enum values (D9).** See conflict 2.
   SPEC already allows "a team membership".
2. **`transition()` lives in SQL, mirrored in TypeScript.** There is no other
   way to get SPEC's "one DB transaction" through supabase-js. The trigger turns
   "nothing else writes status" from a convention into a guarantee.
3. **The 24-hour clock ran on wall-clock time, nights and weekends included**
   (SPEC §2.5, §9 #5). A Friday 18:00 submission would have been due Saturday
   18:00. Decided 28 Sep: working hours (D11), built in Phase 1. What the promise
   now says to applicants is D11a.
4. **Arabic.** Serve English only (as SPEC says), but ship the machine-drafted
   Arabic catalogue now, because CI requires it and it makes Arabic a sign-off
   later rather than a rebuild (D12).
5. **Codes by email as the launch fallback (D5).** SPEC lists WhatsApp or SMS,
   and both have outside lead times. W8's "verified with a code sent to
   {maskedMobile}" needs a variant if email is used.
6. **Scan inline, retry by cron.** This deviates from SPEC's purely background
   `file.scan`, so the applicant isn't left watching "Uploading" for a minute
   waiting on a cron tick.
7. **No Storybook, no MSW.** A staff-only state gallery covers the visual
   comparison, and the backend-first phase order makes mocks unnecessary.
8. **Bank packages as links only (SPEC §8).** This is right for security, but
   banks may insist on attachments or their own portals. Confirm with at least
   one bank before Phase 6 (D3).

### Risks

| Risk | Mitigation |
|---|---|
| D4 forces UAE storage after Phase 2 | The storage adapter isolates the choice; decide before Phase 2 |
| Outside lead times: Meta business verification and template approval (days to weeks), UAE SMS sender ID (weeks), compliance sign-off, bank confirmations | These block launch, not the build. Build email-first; each channel switches on by env |
| A fresh `supabase db reset` fails, because production was partly shaped by hand (the `meta_*` tables have no migration; `0056a–d` were repairs) | Baseline the local stack from `supabase db dump --schema-only` of production (needs G2) |
| The mortgage seed or e2e reaches production | The seed refuses the production ref; e2e is skipped without a staging URL |
| Preview builds email real people: they run with `NODE_ENV=production`, so the dry-run default doesn't apply | Set `EMAIL_DRY_RUN` (or a staging Resend key) in the Preview/staging environment. Unverified; check in Phase 3 |
| PII leaks into `error_events` (readable by all staff), Sentry or PostHog | Ids and codes only; a PII-dropping analytics wrapper; `beforeSend` in Phase 7 |
| Migration number collisions with parallel sessions | Renumber on rebase; `npm run db:check` |
| Consent withdrawal or erasure after packages have gone to banks | Can't be undone at the bank; record it, and have compliance word the policy (D2, D7) |
| WhatsApp's 24-hour window limits free text | Templates carry a short notice plus the link; the full message goes by email and on W8 (SPEC §6, CMS-17) |
| Running costs: four new crons (one every minute), a staging project, a scanner, WhatsApp conversations, SMS | Listed for Bazar with D8, D6, D1 and D5 |
| Deploy cost | Hold PRs; merge in batches; ship dark behind the flag |
