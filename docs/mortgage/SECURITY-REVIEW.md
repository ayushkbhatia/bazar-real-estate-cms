# Mortgage module — security review

Phase 7, step 1 of [PLAN.md](PLAN.md): every mortgage route, action and job
checked against [SPEC.md](SPEC.md) §7 (permissions) and §8 (what backs the
website's security copy). Each control is listed with where it lives and how
it was checked, and each gap is numbered **SR-n** for the fix list.

- **Reviewed:** 30 Sep 2026, at commit `27165051` (Phases 0–6 and D19) on
  `claude/mortgage-application-flow-106c86`.
- **Method:** reading the code; introspecting the local database built from
  every migration (functions, grants, RLS policies, the bucket); the test
  suites (unit, database and end-to-end); and the live production headers.
  Migrations `0138`–`0150` are not in production yet, so production checks
  of the database and bucket wait for them (§6).
- **Legend:** ✓ in place and tested · ◐ in place, with a gap noted ·
  ✗ missing · ◻ a production or human check, not code.
- **Since the review** (same day, Phase 7 steps 3–5): SR-4, SR-5, SR-6, SR-8
  and SR-9 are fixed and tested (§5 says how).
- **Step 2** (same day, the list approved): SR-7, SR-10 to SR-17 and SR-22 to
  SR-25 are fixed and tested, in migration `0152` and the code (§5 says how).
  What's left is ops (SR-1 to SR-3), decisions (SR-18, SR-19, SR-21, SR-26)
  and the production checks (§6).

Paths: `M/` = `app/[locale]/(mortgage)/`, `A/` =
`app/[locale]/(admin)/admin/mortgages/`, `L/` = `lib/mortgage-requests/`.

---

## 1. The website's security copy (SPEC §8)

W5–W7 say: "Encrypted in transit and at rest. Only Bazar's mortgage team can
open them, and every view is recorded." C2 says: "Every open and download is
recorded in the activity log."

| Claim | Control | Where | Status |
|---|---|---|---|
| Encrypted in transit | HTTPS only, with HSTS | Vercel serves `strict-transport-security: max-age=63072000` on `www.bazarrealestate.ae`, and plain HTTP answers 308 to HTTPS (checked live, 30 Sep) | ✓ |
| | Uploads presigned over TLS | `L/server/storage.ts`: Supabase's signed upload URL, `https://…supabase.co` | ✓ |
| Encrypted at rest | Private bucket, server-side encryption; database encrypted at rest | Supabase encrypts Storage and Postgres at rest by default. Not visible from code | ◻ confirm in the Supabase dashboard (§6) |
| Only the mortgage team can open them | A dedicated private bucket, no public URLs | `0140`: `mortgage-files`, `public = false`, 40 MB cap, PDF/JPEG/PNG only, **no `storage.objects` policies** (only the service role can read). Keys are `f/{fileId}`, with nothing personal in them | ✓ locally; ◻ in production once `0140` is applied |
| | Every read goes through a role check | `app/api/admin/mortgages/files/[fileId]` → `L/server/files.ts` `openStaffFile`: signed-in, active staff with a mortgage role; admins without one get 403 (D10). The viewer (C3/C4) loads bytes only through this route; the browser is never handed a signed read URL | ✓ `storage.db.test.ts` |
| | Signed URLs ≤ 60 s if used | No signed **read** URLs. Uploads use Supabase's signed **upload** URL, single-use, whose 2-hour validity Supabase fixes (IMPLEMENTATION §1.7) | ✓ (deviation noted) |
| | No caching | File responses: `Cache-Control: no-store, private`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`. CMS and flow pages render dynamically | ✓ |
| Every view is recorded | The event is written before any byte | `openStaffFile` writes `document.viewed` / `document.downloaded` through the caller's own session (`mortgage_log_event`) and returns an error, not bytes, if it fails. Bank downloads: `openPackageFile` writes `document.downloaded` as the bank first; opening the package page writes `bank.package_opened` before rendering | ✓ `storage.db.test.ts`, `banks.db.test.ts` |
| | The log is append-only in the database | `0139`: triggers reject UPDATE, DELETE and TRUNCATE on `mortgage_events` for every role, and UPDATE/DELETE/TRUNCATE are revoked from the service role. Deletion is possible only inside a function that sets `mortgage.purge` (reserved for retention and erasure, §3 below) | ✓ `database.db.test.ts` |

**Copy caveat (for D17, SR-19):** with the applicant's consent, the accepted
documents also go to the partner banks the file is sent to (Phase 6). The
consent step says so; the security line doesn't.

---

## 2. SPEC §8's other controls

| Control | Where | Status |
|---|---|---|
| **Links:** 256-bit random tokens | `L/server/tokens.ts` `newToken()`: 32 random bytes, base64url | ✓ |
| Stored hashed | `mortgage_access_links.token_hash`, `mortgage_bank_submissions.package_token_hash`: SHA-256 only | ✓ |
| One purpose and one request each | `mortgage_access_links.purpose` (reupload, invite), `request_id`; a re-upload link is also scoped to one document (check constraint). A package link belongs to one bank's submission | ✓ `links.db.test.ts` |
| Expiry, revocable | `link_expiry_days` = 7 (D7). Cancel revokes; a decision withdraws banks still deciding; a reminder replaces a package link | ✓ |
| **Codes:** 6 digits, 10-minute expiry, 5 attempts | `L/server/links.ts` (`CODE_TTL_MS`, `MAX_CODE_ATTEMPTS`), `0145` `mortgage_link_verify`: the fifth wrong code locks the link for good; a minute between codes; salted hash | ✓ `links.db.test.ts` |
| Rate-limited per link and per IP | `/api/mortgage/links/[token]/otp` (per IP and per link), `…/verify` (per IP; per link the database's lock) | ◐ no-op until Upstash is configured (**SR-1**) |
| Masked destination on W8 | W8 shows "…code sent to k•••@example.com": codes go by email until WhatsApp (D5 → D1), so the mask is of the email, not the mobile | ✓ (deviation, D5) |
| Session after the code | `L/server/link-http.ts`: two hours, httpOnly, SameSite=Strict, Secure in production; its hash stored; one link's session opens no other | ✓ |
| **Public endpoints:** Turnstile + rate limits | Turnstile on draft create and submit (`lib/turnstile.ts`): **fails closed in production** without keys (503). Rate limits on every public route (`L/server/http.ts` `rateLimit`) | ◐ keys and Upstash not set (**SR-1**, **SR-2**) |
| Size enforced at presign and on complete | `L/server/drafts.ts`: declared size at presign; the bucket cap; the stored object's real size on complete (running totals too). Type sniffed, encrypted PDFs refused, pages counted, SHA-256 kept | ✓ `storage.db.test.ts`, `verify.test.ts` |
| **Malware scan** before staff can open a file | `L/server/scan.ts`; inline on complete, retried by `mortgage-worker`; the file route answers 409 `not_scanned` until clean. In production with no scanner, files wait and can't be opened (fail closed) | ◐ scanner not chosen (**SR-3**, D6) |
| **Bank packages:** expiring, logged links, not attachments | `L/server/banks.ts`, `M/mortgages/p/[token]`, `app/api/mortgage/packages/…`: one link per bank, 7 days, hash only, every open and download logged as the bank, downloads rate-limited, `no-referrer`, not indexed | ✓ `banks.db.test.ts`; bearer link with no second factor (D3, **SR-18**) |
| **No PII in logs, Sentry or PostHog** | Mortgage code has no `console.*` calls; `reportError` contexts carry ids and codes only; the flow's PostHog events are an allow-list of enums and counts (`L/client/analytics.ts`, tested); secure-link tokens are redacted from PostHog and Vercel Analytics URLs (`lib/secure-link-redaction.ts`); team and bank emails carry no applicant details. Since step 4: Sentry scrubs every event (`lib/sentry-scrub.ts`), `reportError` scrubs messages, stacks and contexts (`lib/pii-scrub.ts`), and email logs mask the recipient | ◐ CMS autocapture (**SR-7**) |
| **DSR:** export and delete by email/mobile across the mortgage tables, in the PDPL flow | `/admin/dsr` finds a subject's requests by email and, optionally, UAE mobile (`L/server/dsr.ts`); the archive lists them; erasure deletes them — objects first, then the rows through `mortgage_erase_requests()` (`0151`) — and names the banks that already hold a copy | ✓ `dsr.db.test.ts` (step 3) |
| **Retention** purge | `/api/cron/mortgage-retention` (daily): closed requests' files, `retention_months` after closing (`L/server/retention.ts`, `0151`); nothing while the months are unset (D7) | ✓ `dsr.db.test.ts` (step 3); ◻ D7 sets the months |
| **Data residency** | Supabase and the functions are in Tokyo (ap-northeast-1 / hnd1) | ◻ D4 open (**SR-21**) |

---

## 3. Permissions (SPEC §7)

Every CMS page sits under `A/layout.tsx` (`requireMortgageRole()`: anyone
without a mortgage role, admins included, gets a 404). Every CMS action calls
a SQL function through the adviser's **own** session, so the database decides
again: `mortgage_authorise()` (`0143`) allows an adviser on files they own and
the Head on any file, and refuses everyone else, whatever the page showed.
RLS on every mortgage table lets only the team read (`mortgage_role() is not
null`); nothing is granted to `anon`, and signed-in users have no direct
writes.

| Action (SPEC §7) | Adviser | Head | Other staff | Enforced by | Status |
|---|---|---|---|---|---|
| See queue and files | ✓ | ✓ | — | RLS select policies (`0138`); `A/layout.tsx` | ✓ `database.db.test.ts` |
| Open / download documents, always logged | ✓ | ✓ | — | `openStaffFile` role check; `mortgage_log_event` first | ✓ |
| Claim an unassigned request | ✓ | ✓ | — | `mortgage_claim` (a second claim answers 409) | ✓ `cms.db.test.ts` |
| Review, request re-upload, contact, book | owner | ✓ | — | `mortgage_set_check`, `…_set_recorded`, `…_set_statement_period`, `…_accept_document`, `…_request_reupload`, `…_cancel_reupload`, `…_log_contact`, `…_book_consultation`, `…_consultation_held`, `…_create_invite` | ✓ `links.db.test.ts`, `cms.db.test.ts` |
| Send to banks, record responses, decide | owner | ✓ | — | `mortgage_send_to_banks`, `…_bank_reminder`, `…_letter_presign`, `…_record_bank_response`, `…_pre_approve`, `…_decline` | ✓ `banks.db.test.ts`, `decline.db.test.ts` |
| Reassign | — | ✓ | — | `mortgage_reassign` | ✓ |
| Settings and holidays | — | ✓ | — | `mortgage_update_settings`, `mortgage_set_holiday` | ✓ |
| Record a consent withdrawal | owner | ✓ | — | `mortgage_withdraw_consent` (`0152`): the banks still deciding withdrawn, every package link stopped | ✓ `banks.db.test.ts`, `mortgage-decision.spec.ts` |
| Manage partner banks | — | ✓ | admin ✓ | `mortgage_save_bank` (Head or `is_admin()`); the Head at `A/banks`, an admin at `/admin/settings/partner-banks` | ✓ `banks.db.test.ts`, `mortgage-security.spec.ts` (SR-13) |
| Break-glass access, logged and reviewed | | | | D10: grant a mortgage role for the duration, in SQL (RUNBOOK §6); a trigger on `staff` audits every change (`0152`) | ✓ `database.db.test.ts` (SR-14); the review is a person's |

**Server actions** (`A/_actions.ts`, `_review-actions.ts`,
`_decision-actions.ts`, `_banks-actions.ts`): each one checks the session
(`teamSession()`: active staff with a mortgage role), validates with zod, and
makes its change in one SQL function, which writes the event and queues the
notifications in the same transaction. Status only moves through
`mortgage_transition()`; the `mortgage_requests_guard` trigger rejects any
other write to status, clock or decision columns. Next.js checks server
actions' Origin. Since step 2 (`0152`), signed-in staff can't call
`mortgage_transition()` itself — only the actions' functions do, as their
owner (SR-10) — and `mortgage_log_event()` takes from them only an open or a
download of that request's own file (SR-11); `requestReupload` checks the
caller before it moves anything (SR-12).

**Functions:** all 47 `mortgage_*` functions set `search_path`. The
SECURITY DEFINER ones callable by signed-in users begin with
`mortgage_authorise()` or an equivalent role check; the rest are service-role
only (creating requests, the link functions, the outbox, the SLA flag).
Trigger functions show as executable by `PUBLIC`, which is harmless: Postgres
refuses to call a trigger function directly.

---

## 4. Routes, actions and jobs

| Surface | Who | Checks | Status |
|---|---|---|---|
| `M/mortgages/apply/*` (W1–W7) | public, behind the flag | the flag (`isMortgageFlowPublic`); answers stay in sessionStorage until submit; W4/W7 carry no reference or PII in the URL; PII regions are `ph-no-capture` | ✓ |
| `M/mortgages/apply/gallery` | staff in production | fixtures only; 404 for anyone else on the production deployment | ✓ |
| `M/mortgages/r/[token]` (W8, invite) | link holder | code, then session; `no-referrer`, noindex; states that show nothing of the application | ✓ |
| `M/mortgages/p/[token]` (package) | the bank | token; a standing consent (SR-22); opening logged first; `no-referrer`, noindex, rendered every time; not framed (SR-15); `ph-no-capture` (SR-7) | ✓ |
| `POST /api/mortgage/drafts` | public | Turnstile, rate limit per IP, flag | ◐ SR-1, SR-2 |
| `…/drafts/[id]/files` (+ `/complete`, DELETE, GET) | draft holder (Bearer token) | token hash, per-draft limits, the §2.2 rules, scan | ◐ SR-1 |
| `POST /api/mortgage/requests` | public | Turnstile, rate limit, flag, zod, consent, Idempotency-Key | ◐ SR-1, SR-2 |
| `…/links/[token]/{otp,verify,files,…,submit}` | link holder | as §2; not behind the flag, so switching intake off strands nobody | ◐ SR-1 |
| `GET /api/mortgage/packages/[token]/files/[fileId]` | the bank | open link and a standing consent; accepted document's clean file on this request only; logged first; rate limit | ◐ SR-1 |
| `GET /api/admin/mortgages/files/[fileId]` | team | role, logged first, scanned | ✓ |
| `POST /api/admin/mortgages/letters` (+ `/[fileId]/complete`) | owner or Head (DB); team (complete) | session; `mortgage_letter_presign`; PDF checks and scan; JSON only (SR-16) | ✓ |
| `A/*` pages and server actions | team | §3; not framed (SR-15); `ph-no-capture` (SR-7) | ✓ |
| `/admin/settings/partner-banks` | admins | the settings area's admin-only layout; `mortgage_save_bank` again | ✓ |
| `/api/cron/mortgage-worker` | Vercel cron | Bearer `CRON_SECRET`; scans, draft purge, SLA tick, outbox; heartbeat on `/admin/settings/health` | ✓ |
| Emails | applicant, team, banks | links are sent by the action and never stored (the outbox can't hold a token); team and bank emails carry no applicant details; the pre-approval letter is read from the private bucket at send time; the adviser is told when one didn't go (SR-25) | ✓ |

---

## 5. Gaps

Severity is about exposure if the flag were public today. "Step" says where
the fix belongs: **3** and **4** are Phase 7 steps already asked for
(retention and DSR; PII scrubbing), so they went ahead without waiting;
**2** is step 2, the fixes made once this list was approved (30 Sep);
**ops** means a setting or account, not code; **decision** is someone's
call, not code.

| ID | Severity | Gap | Proposed fix | Step |
|---|---|---|---|---|
| SR-1 | High | **Rate limits are off in production.** `rateLimit()` does nothing until `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set (D14). Code guessing is still capped by the database (five wrong codes lock a link, a minute between codes), but drafts, presigns, submits and package downloads are unthrottled | Open Upstash and set the two variables in Production and Preview | ops (D14) |
| SR-2 | High | **Turnstile keys aren't set** (D14). Production refuses drafts and submits, so this fails closed | Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | ops (D14) |
| SR-3 | High | **No malware scanner in production** (D6). Files wait and can't be opened (fails closed) | Choose and deploy a scanner (clamd), then `MORTGAGE_SCANNER=clamd` | ops (D6, D4) |
| SR-4 | Medium | ~~**Sentry has no scrubber.**~~ **Fixed (step 4):** `beforeSend`, `beforeSendTransaction` and `beforeBreadcrumb` on the server, edge and browser (`lib/sentry-scrub.ts`); request bodies, query strings, cookies and user details never leave; tokens in `/api/mortgage/links/…` and `/api/mortgage/packages/…` paths are redacted too. Was: Once a DSN is set, `onRequestError` and `captureException` would send secure-link URLs (their tokens) and any personal data an error message quotes | A `beforeSend` (server and browser) that redacts tokens in URLs, emails, phone numbers and Bearer values in messages, breadcrumbs and request data | 4 |
| SR-5 | Medium | ~~**`error_events` stores raw messages**~~ **Fixed (step 4):** `reportError` scrubs the message, the stack and the context before storing, logging or forwarding (`lib/pii-scrub.ts`). Was: and every staff member can read them (`0134`). A database or provider error can quote an email or a phone number | Scrub messages and contexts in `reportError` before they're stored or forwarded | 4 |
| SR-6 | Medium | ~~**`lib/email.ts` logs the recipient's address**~~ **Fixed (step 4):** masked ("p•••@example.com"); provider errors scrubbed. Was: on a dry run and when no Resend key is set, for every email on the site | Log a masked address | 4 |
| SR-7 | Medium | ~~**PostHog autocapture on the CMS's mortgage pages and the bank's package page.**~~ **Fixed (step 2):** the section's layout (`A/layout.tsx`) wraps every CMS page in `ph-no-capture`, and the package page's `<main>` carries it. Was: With analytics accepted, a click can send an element's text (an applicant's name, a salary) to PostHog. The applicant flow already marks its personal regions `ph-no-capture` | `ph-no-capture` on the mortgage CMS section and the package page | 2 |
| SR-8 | Medium | ~~**DSR misses mortgage requests.**~~ **Fixed (step 3).** Was: `/admin/dsr` exports and erases the old `mortgage_inquiries` only | Find a subject's requests by email (and mobile); export them; erase them — files deleted from the bucket first, then the rows, events included, through the `mortgage.purge` path; record which banks already received a package, since those copies can't be recalled | 3 |
| SR-9 | Medium | ~~**No retention purge.**~~ **Built (step 3)**, off until D7 sets the months. Was: `retention_months` is null until compliance answers D7 | A daily job that deletes closed requests' files after N months, off while N is unset | 3 (D7) |
| SR-10 | Medium | ~~**Team members can call `mortgage_transition()` directly**~~ **Fixed (step 2, `0152`):** EXECUTE revoked from `authenticated`; a direct call as the owner or the Head is refused (`42501`), and the actions' functions still call it as their owner. Was: (it is granted to `authenticated`), so an owner or the Head could pre-approve or decline without the action-level rules: a lead offer with a letter, a reason and message, the applicant's email. It's still logged as them | Revoke EXECUTE from `authenticated`. Every staff path already goes through the specific functions, which call it as their owner | 2 |
| SR-11 | Low | ~~**`mortgage_log_event()` lets any team member write any event type on any request**~~ **Fixed (step 2, `0152`):** a signed-in caller may log `document.viewed` or `document.downloaded` only, naming a file of that request (a document's or a bank's letter), as themselves at the database's time. Was: as themselves. The file route only needs `document.viewed` and `document.downloaded` | Allow signed-in callers those two types only | 2 |
| SR-12 | Low | ~~**`requestReupload` moves a New file to In review before the database checks the caller may act**~~ **Fixed (step 2):** it asks `mayActOn()` (`L/permissions.ts`: the owner or the Head) first. Was: so an adviser who doesn't own a file can move it on (the re-upload itself is then refused) | Check the caller may act first | 2 |
| SR-13 | Medium | ~~**Admins without a mortgage role can't manage partner banks.**~~ **Fixed (step 2):** admins keep the same list at `/admin/settings/partner-banks`, behind the settings area's admin-only layout (a "Partner banks" tab); `saveBank` takes the Head or an admin (`bankEditorSession()`), and the database decides again. The Head's page is unchanged. Was: SPEC §7 and `mortgage_save_bank()` allow them, but the whole `/admin/mortgages` section 404s without a role (D10) | Serve the banks page outside the section's gate, admins and the Head only; or decide admins need a role | 2 |
| SR-14 | Medium | ~~**Break-glass isn't logged.**~~ **Fixed (step 2, `0152`):** a trigger on `staff` writes `staff.mortgage_role_change` to `audit_log` for every change to `mortgage_role`, from the app or SQL: before, after, `via`, and the actor and reason when the SQL sets `mortgage.audit_actor` and `mortgage.audit_note` (RUNBOOK §6); without them it's recorded as the system's. Was: Granting or removing a mortgage role is SQL only and writes no audit row; SPEC §7 requires break-glass access to be logged and reviewed | An audit row for every change to `staff.mortgage_role` (a trigger), and the procedure in the runbook | 2 |
| SR-15 | Low | ~~**No `frame-ancestors` or `X-Frame-Options`** on `/admin` or `/mortgages`.~~ **Fixed (step 2):** `frame-ancestors 'none'` and `X-Frame-Options: DENY` on both, in both locales (`next.config.ts`). Was: SameSite cookies (Lax for staff, Strict for links) already leave a framed page signed out | `Content-Security-Policy: frame-ancestors 'none'` for those paths | 2 |
| SR-16 | Low | ~~**JSON routes don't check the content type.**~~ **Fixed (step 2):** `readJson` answers 415 unless the request says `application/json`, which a cross-site form can't send without a preflight. Was: The staff letter routes rely on SameSite=Lax to stop a cross-site form POST | Require `application/json` in `readJson` | 2 |
| SR-17 | Low | ~~**No way to record a consent withdrawal.**~~ **Fixed (step 2):** "Record a withdrawal" on C2's Consent card (the owner or the Head; `mortgage_withdraw_consent`, `0152`), available after a decision too; the card loses its tick and says when, and the activity log has a line. Was: `withdrawn_at` exists, but only SQL can set it, and C2's Consent card still shows the tick afterwards (see SR-22 for what it doesn't stop) | Runbook procedure now; a CMS action that records it, shows it on C2, and does SR-22's cut-off | 2 |
| SR-22 | Medium | ~~**A withdrawn consent doesn't reach the banks.**~~ **Fixed (step 2):** recording the withdrawal withdraws the banks still deciding and stops every package link on the file at once; the reminder refuses a file without consent (`0152`), and the package page and its downloads show nothing without one, however it went (`findPackage` reads it). Was: Sending to banks and pre-approving check it, but a package link already sent keeps working until it expires, its downloads too, and "Send a reminder" (`mortgage_bank_reminder`, `0149`) issues a fresh link without checking | Withdrawing consent withdraws the banks' submissions (their links stop), and the reminder, the package page and its downloads refuse a request without consent | 2 |
| SR-23 | Low | ~~**A notification claimed on its fifth attempt can stick in `sending`**~~ **Fixed (step 2):** each delivery run first gives up a fifth attempt claimed over ten minutes ago: `failed`, a `notification.failed` event, and a report on `/admin/settings/health`. Was: if the sender dies mid-send: the reclaim (`mortgage_claim_notifications`, `0141`) only takes rows with fewer than five attempts, and nothing reports it | Reclaim a stale fifth attempt as failed (and report it), or report `sending` rows older than an hour on the health page | 2 |
| SR-24 | Low | ~~**The dev scanner is allowed on Preview deployments**~~ **Fixed (step 2):** refused on Production and Preview (`VERCEL_ENV`); clamd is allowed on both, and local development keeps the dev scanner. Was: which read the production database (D8): with `MORTGAGE_SCANNER=dev` set for Preview, a file uploaded through a preview would be marked clean without a real scan | Refuse the dev scanner on any Vercel deployment (`VERCEL_ENV` set), not just Production, until D8 gives Preview its own database | 2 |
| SR-25 | Low | ~~**Some results say sent when an email wasn't.**~~ **Fixed (step 2):** a bank counts as reached only when every inbox was (`L/sends.ts`); sending to banks, the reminder, the invite and the re-upload each say, as a warning, when an email failed, reached only some inboxes, or wasn't sent because email is off. Was: "Send a reminder" reports success whatever the send did; a bank counts as reached when any one of its inboxes was; a skipped send (dry run, no key) reads as sent | Report the send's outcome, per inbox | 2 |
| SR-18 | Info | **Tokens appear in request paths**, so Vercel's request logs hold them for their retention period. Applicant links still need a code; bank package links don't (D3: a bearer link to the bank's inbox) | Accept, or ask banks for a code too (D3) | decision |
| SR-19 | Info | **The security line and bank sharing** (§1): "Only Bazar's mortgage team can open them" leaves out the partner banks the applicant consents to | Word it for D17 (design and compliance) | decision |
| SR-20 | — | **Production checks** (§6) | — | ops |
| SR-21 | — | **Data residency** (D4): documents and rows are in Tokyo | Decide D4; S3 in `me-central-1` is the prepared alternative (IMPLEMENTATION §1.7) | decision |
| SR-26 | Info | **Disputes the copy may cause, not a control:** W1 and W7 promise an answer in "24 hours", and the clock counts 24 *working* hours (D11, D11a); an invite link lets someone submit a Fast Pre-Approval while the flag is off (by design: the team sent it); the flag is the Head's alone in the code, where IMPLEMENTATION §1.10 mentions admins | Word the promise (D11a); confirm the other two stand | decision |

**Accessibility (step 5, not a security gap):** axe (WCAG 2.1 A/AA) now runs
on every mortgage screen (`e2e/mortgage-a11y.spec.ts`) and passes, after
fixing small muted text on tinted backgrounds and breadcrumb links told apart
by colour alone. The shared CMS sidebar's group labels fail contrast on every
admin page; that file is shared, so it's a separate task.

Nothing here lets someone outside the mortgage team read an applicant's
documents or details. SR-22 did (a bank that already had a link kept it for
up to seven days after the applicant withdrew consent) and is fixed. SR-10 to
SR-12 concerned team members bypassing rules, not access, and are fixed. The
High items are production settings that the code already fails closed on
(SR-2, SR-3) or that the database backs up (SR-1). SR-22 to SR-26 were found
while writing the runbook.

---

## 6. Production checks before switching the flag on

For D17's sign-off, after `0138`–`0152` are applied:

| Check | How | Status |
|---|---|---|
| HSTS on the live domain | `curl -sI https://www.bazarrealestate.ae` → `strict-transport-security: max-age=63072000` | ✓ 30 Sep |
| HTTP redirects to HTTPS | `curl -sI http://www.bazarrealestate.ae` → 308 | ✓ 30 Sep |
| Bucket private, capped, typed, no policies | `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'mortgage-files'`; no `storage.objects` policy mentions it | ◻ |
| Encryption at rest (Storage and Postgres) | Supabase dashboard → project settings | ◻ |
| Region (D4) | Supabase project region; Vercel `hnd1` | ◻ |
| Turnstile, Upstash, scanner, Resend, `EMAIL_DRY_RUN` unset, `CRON_SECRET` | `vercel env ls` (Production) | ◻ |
| An admin without a mortgage role gets 404 at `/admin/mortgages` and 403 from the file route, and can open `/admin/settings/partner-banks` | sign in as one | ◻ |
| Nobody else can frame the CMS or the mortgage flow | `curl -sI https://www.bazarrealestate.ae/admin/login` and `/mortgages/apply` → `content-security-policy: frame-ancestors 'none'`, `x-frame-options: DENY` | ◻ |
| Break-glass grants are audited | grant and remove a test role as RUNBOOK §6 says; two `staff.mortgage_role_change` rows in `audit_log`, the first naming you and why | ◻ |
| Staff file route headers | open a file, check `cache-control`, `x-content-type-options`, `content-security-policy` | ◻ |
| Package page headers | open a package link, check `referrer-policy: no-referrer` and `x-robots-tag`/meta noindex | ◻ |
| `/mortgages/apply/gallery` 404s when signed out | curl | ◻ |
| PostHog session recording is off (it's a project setting, and nothing in the code turns it on) | PostHog → project settings → Session replay | ◻ |
| Sentry, if a DSN is set: a test error from a secure link arrives with `[token]` in its URL and no request body | trigger one on a preview | ◻ |
| The flag stays `off` until UAT passes | `/admin/mortgages/settings` | ◻ |

A human review of this document, and a penetration test if the budget
allows, follow the fixes (PLAN Phase 7).
