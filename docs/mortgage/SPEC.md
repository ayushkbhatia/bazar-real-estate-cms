# Mortgage requests — build spec

The contract for the mortgage module. Screens W1–W8 (website) and C1–C6 (CMS) are in `design-references/`. If this spec and a design disagree, raise it rather than guess.

**Stack assumed:** the Bazar platform stack in `design_handoff_bazar_website_cms/docs/09-architecture-and-stack.md` (Next.js App Router, TypeScript, Postgres + Drizzle, Better Auth, Cloudflare R2, Inngest, Resend, WhatsApp Business Cloud API). Phase 0 maps these names onto the real repo.

---

## 1. Scope

**In v1**
- Public flow at `/mortgages/apply`: choose service → personal details → (Consultancy) review & submit, or (Fast Pre-Approval) documents & submit → confirmation.
- Secure links with OTP: re-upload one document, and the Fast Pre-Approval invite sent from a consultancy request.
- CMS: queue, request file, document viewer with checks, re-upload requests, partner-bank packages and responses, decision and notification, consultancy contact log and booking.
- The 24-hour promise clock, alerts, append-only activity/audit log.

**Not in v1**
- Bank APIs. Staff record bank responses by hand.
- OCR / auto-extraction. Staff type the recorded fields and statement periods.
- Applicant accounts. Applicants never sign in; they use links + OTP.
- Calendar sync (Google/Microsoft). Adviser slots come from working hours minus bookings.
- Arabic. W1–W8 are English only; externalise every string so AR can follow.

---

## 2. Domain rules

### 2.1 Paths

| Path (internal only) | `service` | `employment_type` | Documents |
|---|---|---|---|
| A | `consultancy` | either | none |
| B | `pre_approval` | `salaried` | `emirates_id`, `passport`, `salary_certificate`, `bank_statements_3m` |
| C | `pre_approval` | `business_owner` | `emirates_id`, `passport`, `trade_license`, `bank_statements_12m` |

Path letters never appear in applicant-facing UI.

### 2.2 Document rules (enforced client-side and server-side)

| `kind` | Label (verbatim) | Files | Types | Limit |
|---|---|---|---|---|
| `emirates_id` | Emirates ID | 1–2 (front and back) | PDF, JPG, PNG | 10 MB per file |
| `passport` | Passport copy | 1 | PDF, JPG, PNG | 10 MB |
| `salary_certificate` | Salary certificate | 1 | PDF | 10 MB |
| `bank_statements_3m` | Last 3 months' bank statements | 1–12 | PDF | 25 MB total |
| `trade_license` | Business trade license | 1 | PDF, JPG, PNG | 10 MB |
| `bank_statements_12m` | Last 1 year's bank statements | 1–12 | PDF | 40 MB total |

- Detect type by magic bytes, not extension. `.jpg` and `.jpeg` are both JPEG.
- Reject password-protected PDFs at upload. UAE e-statements are often password-protected. Error copy is not designed yet (§9).
- **Required statement months** = the last N complete calendar months before the submission date (N = 3 or 12). W5 shows "Jun, Jul and Aug 2026"; W6 shows "Sep 2025 to Aug 2026".
- Oversize error (W6, verbatim pattern): "This file is {size} MB and the limit is {limit} MB. Save it at a lower resolution, or upload a photo of the {document} instead." PDF-only kinds need a variant without the photo sentence (§9).
- W5/W6 CTA "Get Fast Pre-Approval" stays disabled until all four documents have at least one clean file, no row is in error, and consent is ticked. Footer note pattern: "2 of 4 ready · 1 file needs attention", "0 of 4 documents added".

### 2.3 Review checks (C3/C4) — config, not code

Store as data (`checklists.ts`) so the mortgage team can change them without a schema change.

Designed:
- `salary_certificate`: Name matches the application · Addressed to a bank · Issued within the last 30 days · Signed and stamped by the employer · Monthly salary stated. **Record for pricing:** Monthly gross salary (AED), Employed since (month), Employer.
- `bank_statements_12m`: Account holder matches the trade licence · Issued by the bank (Original PDFs, not scans) · Covers the last 12 months.

Not designed — proposed, confirm with the Head of mortgages (§9):
- `emirates_id`: Name matches · Front and back included · Not expired
- `passport`: Name matches · Photo page legible · Not expired
- `trade_license`: Valid / current · Applicant named on the licence
- `bank_statements_3m`: Account holder matches the applicant · Issued by the bank · Covers the last 3 months

Rules:
- **Accept document** is enabled only when every check is ticked.
- Each statement file carries a period (from month, to month) entered by staff. Coverage = union of periods against the required months. The coverage grid in C4 and W8 renders from this.

### 2.4 Statuses and transitions

Fast Pre-Approval: `new → in_review → with_banks → pre_approved | declined`, with `in_review ⇄ awaiting_applicant` while a re-upload is outstanding.
Mortgage Consultancy: `new → contacted → consultation_booked → completed`.

| From | To | Trigger | Actor | Side effects |
|---|---|---|---|---|
| — | `new` | Applicant submits | applicant | Reference allocated; SLA starts (pre-approval); document rows created; consent stored; confirmation email; owner assignment; team notified |
| `new` | `in_review` | Owner opens the first document | system | — |
| `in_review` | `awaiting_applicant` | Re-upload request sent | owner, head | SLA pauses; access link created; WhatsApp + email |
| `awaiting_applicant` | `in_review` | Applicant sends the re-upload | applicant | SLA resumes; that document → `to_review`; owner notified |
| `in_review` | `with_banks` | Accept application (4 of 4 accepted) and send to ≥1 bank | owner, head | Packages sent |
| `with_banks` | `pre_approved` | Confirm pre-approval & notify | owner, head | SLA stops; email + bank letter; WhatsApp |
| `with_banks` | `declined` | Decline & notify | owner, head | SLA stops; notify |
| `new` | `contacted` | First contact attempt logged (any outcome) | staff | `first_contact_at` set |
| `contacted` | `consultation_booked` | Consultation booked | staff | Invite by email (.ics) + WhatsApp |
| `consultation_booked` | `completed` | Consultation marked held | staff | — |

- **Send pre-approval link** (C6, any open consultancy status) creates an invite link. When the applicant submits through it, a new `pre_approval` request is created with `parent_request_id` → the consultancy request. Details carry over; the applicant sees only the set for their employment type. The parent's status is unchanged.
- Every status change goes through one function, `transition(request, event, actor)`. It validates the move, writes the status and a `mortgage_events` row in one DB transaction, and throws on illegal moves. Nothing else writes `status`.

### 2.5 The 24-hour promise (Fast Pre-Approval only)

- **Starts** at submission ("when the applicant presses Get Fast Pre-Approval").
- **Pauses** on entering `awaiting_applicant`; **resumes** on leaving it.
- **Stops** on `pre_approved` or `declined`. `met` = stopped before due.
- **Due** = start + 24h + total paused time.
- **At risk** = running with ≤ 4h left (C1 banner and red bar). **Breached** = running and past due.
- Wall-clock hours, nights and weekends included — W7 shows the applicant an exact time. Confirm (§9).
- Consultancy has no clock. C1 shows how long a request has waited until first contact, then the last contact or the booking time.
- Time zone for all display: Asia/Dubai.

Columns: `sla_started_at`, `sla_due_at` (null while paused), `sla_paused_at`, `sla_paused_seconds`, `sla_stopped_at`, `sla_risk_notified_at`, `sla_breach_notified_at`.

One pure function drives every display: `slaStatus(request, now) → { state: none | running | at_risk | paused | met | breached, remainingSeconds, elapsedSeconds, dueAt, pct }`. UI never computes deadlines.

Display formats from the designs: "17h 42m left" · "Paused · 9h 13m left" · "Due Wed 23 Sep, 10:14" · C5 button note "stops the clock at 8h 41m" (elapsed time) · W7 "Wed 23 Sep, 10:14".

### 2.6 Reference numbers

`BZM-{YY}-{NNNN}` (e.g. BZM-26-0412). One series shared by both services, allocated at submit, concurrency-safe (Postgres sequence per year, or a counter row locked with `SELECT … FOR UPDATE`). Never reused.

### 2.7 Owner assignment

Designs show both round-robin ("Assigned to Yasmin · Round-robin · mortgage team") and new requests left unassigned. Build round-robin across active advisers behind a setting; default decided in §9. Head of mortgages can reassign. An adviser can claim an unassigned request.

---

## 3. Data model

Conventions from `docs/06-data-model.md`: UUID v7 ids, `timestamptz`, snake_case, Postgres enums, forward-only migrations.

### Enums

```
mortgage_service           consultancy | pre_approval
mortgage_status            new | in_review | awaiting_applicant | with_banks | pre_approved | declined
                           | contacted | consultation_booked | completed
mortgage_residency         uae_national | uae_resident_expat
mortgage_employment        salaried | business_owner
mortgage_entry_point       home | calculator_preapproval | calculator_advisor | property_detail
                           | services_menu | consult_invite | direct
mortgage_doc_kind          emirates_id | passport | salary_certificate | bank_statements_3m
                           | trade_license | bank_statements_12m
mortgage_doc_state         to_review | accepted | reupload_requested
mortgage_file_state        pending | active | removed
mortgage_scan_status       pending | clean | infected | failed
mortgage_reupload_reason   unreadable | wrong_document | expired | period_incomplete | pages_missing | other
mortgage_link_purpose      reupload | preapproval_invite
mortgage_contact_channel   call | whatsapp | email
mortgage_contact_outcome   reached | no_answer | left_message | sent | received
mortgage_consult_format    phone | video | office
mortgage_consult_status    booked | held | no_show | cancelled
mortgage_bank_sub_status   sent | pre_approved | declined | withdrawn
mortgage_decision          pre_approved | declined
mortgage_actor             applicant | staff | system | bank
```

Staff roles: add `mortgage_head` and `mortgage_adviser` to the existing staff role model (or a team membership, whichever the repo uses).

### Tables

**`mortgage_requests`**
`id`, `reference` (unique), `service`, `status`,
`full_name`, `date_of_birth` (date), `mobile_e164`, `email` (citext), `residency`, `employment_type`,
`entry_point`, `property_id` (fk, null), `parent_request_id` (fk self, null),
`owner_staff_id` (fk, null), `assigned_at`, `submitted_at`, `first_contact_at`,
`sla_started_at`, `sla_due_at`, `sla_paused_at`, `sla_paused_seconds` (int, default 0), `sla_stopped_at`, `sla_risk_notified_at`, `sla_breach_notified_at`,
`decision`, `decided_at`, `decided_by`, `lead_bank_submission_id` (fk, null), `decision_message`,
`closed_at`, `created_at`, `updated_at`.
Indexes: `(service, status)`, `(owner_staff_id)`, `(sla_due_at) WHERE sla_stopped_at IS NULL`, `(mobile_e164)`, `(email)`.
Applicant details are a snapshot of what was submitted. `employment_type` is read-only once a pre-approval is submitted.

**`mortgage_consents`** — `id`, `request_id`, `kind` ('partner_bank_sharing'), `wording_version` (e.g. 'v0.1'), `wording_text`, `given_at`, `ip` (inet), `user_agent`, `withdrawn_at`.
C2 shows it as "Given Tue 22 Sep, 10:14 · 94.203.•.• · Chrome, macOS" with a "Wording v0.1 · pending compliance" pill.

**`mortgage_documents`** — one row per required kind, created at submit.
`id`, `request_id`, `kind`, `state`, `checks` (jsonb `{ key: boolean }`), `recorded` (jsonb, e.g. `{ monthly_gross_aed, employed_since, employer }`), `accepted_by`, `accepted_at`, `updated_at`. Unique `(request_id, kind)`.

**`mortgage_files`** — applicant uploads and bank letters. Never overwritten; replacing = new row + old row `removed`.
`id`, `draft_id` (null), `document_id` (null), `bank_submission_id` (null), `state`, `storage_key`, `original_name`, `mime`, `size_bytes`, `page_count`, `sha256`, `scan_status`, `period_from` (date, statements), `period_to`, `upload_round` (0 = with the application, n = nth re-upload), `uploaded_at`.

**`mortgage_upload_drafts`** — upload sessions before submit.
`id`, `token_hash`, `ip`, `created_at`, `expires_at` (24h), `claimed_request_id`.

**`mortgage_access_links`**
`id`, `request_id`, `purpose`, `document_id` (reupload only), `token_hash`, `expires_at`, `otp_hash`, `otp_expires_at`, `otp_attempts`, `verified_at`, `used_at`, `revoked_at`, `created_by`, `created_at`.

**`mortgage_reupload_requests`**
`id`, `request_id`, `document_id`, `reason`, `message`, `channels` (text[]: whatsapp, email), `requested_by`, `requested_at`, `access_link_id`, `fulfilled_at`, `cancelled_at`.

**`mortgage_contact_attempts`**
`id`, `request_id`, `staff_id` (null for inbound), `channel`, `outcome`, `body`, `duration_seconds`, `occurred_at`.

**`mortgage_consultations`**
`id`, `request_id`, `adviser_staff_id`, `format`, `starts_at`, `duration_minutes` (default 20, from the C6 message), `invite_channels`, `status`, `created_by`, `created_at`.

**`mortgage_partner_banks`**
`id`, `code` (FAB), `name`, `brand_color`, `active`, `package_emails` (text[]), `sort_order`, `created_at`.

**`mortgage_bank_submissions`**
`id`, `request_id`, `bank_id`, `status`, `sent_at`, `sent_by`, `package_manifest` (jsonb), `package_expires_at`, `responded_at`, `recorded_by`, `max_amount_aed` numeric(14,2), `rate_pct` numeric(5,3), `rate_type` (fixed | variable), `fixed_years`, `valid_until` (date), `reminder_sent_at`, `notes`.
The 25-year monthly payment is computed, not stored — use the mortgage calculator's formula `M = P·r(1+r)^n / ((1+r)^n − 1)`. Check: AED 2,150,000 at 3.99% over 25 years = AED 11,337 (C5).

**`mortgage_events`** — append-only activity and access log.
`id`, `request_id`, `actor_kind`, `actor_id`, `type`, `data` (jsonb), `ip`, `created_at`.
Types include: `request.submitted`, `status.changed`, `owner.assigned`, `document.viewed`, `document.downloaded`, `document.accepted`, `reupload.requested`, `reupload.fulfilled`, `link.otp_sent`, `link.verified`, `file.scan_failed`, `bank.package_sent`, `bank.package_opened`, `bank.response_recorded`, `bank.reminder_sent`, `decision.sent`, `contact.logged`, `consultation.booked`.
Revoke UPDATE/DELETE from the app's DB role and add a trigger that rejects them. Only the retention job's role may delete.

---

## 4. Routes

### 4.1 Website

| Route | Screen | Notes |
|---|---|---|
| `/mortgages/apply` | W1 | `?service=pre_approval\|consultancy` preselects; `?from=<entry_point>`; `?property=<ref>` |
| `/mortgages/apply/details` | W2 | |
| `/mortgages/apply/review` | W3 | Consultancy only |
| `/mortgages/apply/documents` | W5 / W6 | Pre-approval only; set chosen by employment type |
| `/mortgages/apply/received` | W4 / W7 | Session-bound. No reference or PII in the URL |
| `/mortgages/r/[token]` | W8, invite | OTP gate, then the scoped upload (reupload) or the documents step with details carried over (invite) |

- W1–W2 answers stay in the browser (sessionStorage) until submit — W2 says "Your answers stay in your browser until you submit."
- Stepper: "Choose service · Your details · Documents" (pre-approval) or "… · Submit" (consultancy).
- Validation on W2: all fields required; UAE mobile after the fixed +971 prefix; valid email; date of birth a real past date. Age limits are not designed (§9).
- Entry points, all behind the feature flag. Pre-approval buttons open W1 with Fast Pre-Approval selected; advisor links open it on Mortgage Consultancy:
  - Home · Get pre-approval today → `service=pre_approval&from=home`
  - Mortgage calculator · Start pre-approval → `service=pre_approval&from=calculator_preapproval`
  - Property detail · Get mortgage pre-approval → `service=pre_approval&from=property_detail&property=<ref>`
  - Mortgage calculator · Talk to advisor → `service=consultancy&from=calculator_advisor`
  - Services menu · Mortgage assistance → `service=consultancy&from=services_menu`

### 4.2 Public API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/mortgage/drafts` | Create upload draft → `{ draftId, draftToken }`. Bot check (Turnstile) + rate limit |
| POST | `/api/mortgage/drafts/:id/files` | Presign: `{ kind, name, size, mime }` → `{ fileId, uploadUrl }`. Enforces §2.2 incl. running totals |
| POST | `/api/mortgage/drafts/:id/files/:fileId/complete` | Verify object, sniff type, reject encrypted PDF, count pages, hash, queue scan |
| DELETE | `/api/mortgage/drafts/:id/files/:fileId` | Remove before submit |
| POST | `/api/mortgage/requests` | Submit. Consultancy: details. Pre-approval: details + `draftId` + consent → `{ reference, submittedAt, dueAt }` |
| POST | `/api/mortgage/links/:token/otp` | Send a 6-digit code to the mobile on file |
| POST | `/api/mortgage/links/:token/verify` | Verify code → short-lived httpOnly cookie scoped to this link |
| POST | `/api/mortgage/links/:token/files` (+ `/complete`, DELETE) | Same as drafts, scoped to the link's one document |
| POST | `/api/mortgage/links/:token/submit` | Send the re-upload, or submit the invite application |

### 4.3 CMS

| Route | Screen |
|---|---|
| `/admin/mortgages` | C1 queue |
| `/admin/mortgages/[reference]` | C2 (pre-approval) or C6 (consultancy) |
| `/admin/mortgages/[reference]/documents/[kind]` | C3 / C4 viewer |
| `/admin/mortgages/[reference]/decision` | C5 |
| `/admin/mortgages/banks` | Partner banks (not designed — use the CMS table pattern) |
| `/admin/mortgages/files/[fileId]` | Authorised file stream. Writes `document.viewed` / `document.downloaded` first |

**C1 behaviour**
- Nav: "Mortgages" item in the CMS shell; breadcrumb "Inbox · 31 open · 5 new".
- Tabs: Open · New · In review · Awaiting applicant · With banks · Contacted & booked · Closed (= pre_approved, declined, completed). Counts on each.
- Service filter: All · Fast Pre-Approval · Mortgage Consultancy, with counts. Search "Name, reference or mobile". Owner filter. Sort default "promise due".
- Promise-due order: pre-approvals by time remaining (paused ones by their frozen remaining time), then consultancy — New by longest waiting, then Contacted, then Booked by appointment time.
- Mobile numbers masked in the list (+971 50 ••• 3321). Full number on the file page.
- At-risk banner when ≥1 running file has ≤ 4h left, naming each one; "Show only these" filters to them.
- Pagination 25 per page. Poll every 15–30s; no realtime needed in v1.

**CMS server actions** — each one: authorise → validate (zod) → write in one transaction (via `transition()` if status changes) → event → enqueue notifications.
`claimRequest`, `reassignOwner`, `editApplicant`, `setCheck`, `setRecordedFields`, `setStatementPeriod`, `acceptDocument`, `requestReupload` (also behind C2's "Request documents", starting with a document picker), `cancelReupload`, `acceptApplicationAndSend(bankIds)`, `recordBankResponse`, `sendBankReminder`, `decide`, `logContactAttempt`, `bookConsultation`, `markConsultationHeld`, `sendPreapprovalInvite`.

---

## 5. Background jobs

| Job | Trigger | Does |
|---|---|---|
| `request.submitted` | submit | Assign owner (§2.7); applicant confirmation email; notify team |
| `file.scan` | file complete | Malware scan → `scan_status`. Infected: delete object, show row error. Staff can't open unscanned files |
| `sla.tick` | cron, every 5 min | At-risk and breach notifications to owner + head. Idempotent via `*_notified_at`; reset on resume |
| `reupload.requested` | action | WhatsApp + email with the secure link |
| `reupload.fulfilled` | link submit | Notify owner |
| `bank.package` | accept & send | Email each bank's package address one expiring, logged link (no attachments) |
| `decision.sent` | decide | Email with bank letter PDF + WhatsApp |
| `consultation.booked` | booking | Email with .ics + WhatsApp |
| `retention.purge` | daily | Delete files N months after `closed_at` (N in §9) |

Unclaimed drafts: a bucket lifecycle rule deletes `drafts/` objects after 24h. No job needed.

---

## 6. Notifications

| When | To | Channel |
|---|---|---|
| Consultancy submitted | applicant | Email — reference, "A member of our mortgage team will contact you shortly." |
| Pre-approval submitted | applicant | Email — reference, due time, documents received |
| Re-upload requested | applicant | WhatsApp + email — adviser's message + secure link |
| Pre-approval invite | applicant | WhatsApp + email — secure link |
| OTP | applicant | WhatsApp authentication template or SMS |
| Consultation booked | applicant | Email (.ics) + WhatsApp |
| Decision | applicant | Email (with letter) + WhatsApp |
| New request · at risk · breached · re-upload received | owner, head | In-app + email |

**WhatsApp constraint.** Business-initiated messages outside WhatsApp's 24-hour customer-service window must use pre-approved templates. The free-text messages staff write in C4 and C5 therefore go out as a template carrying a short notice and the link (full text in the email and on the secure page), and as free text only when the applicant has messaged within 24 hours. Submit templates to Meta in Phase 0 — approval takes time.

---

## 7. Permissions

| Action | Mortgage adviser | Head of mortgages | Other staff (incl. admin) |
|---|---|---|---|
| See queue and files | ✓ | ✓ | — |
| Open / download documents (always logged) | ✓ | ✓ | — |
| Claim an unassigned request | ✓ | ✓ | — |
| Review, request re-upload, contact, book | owner | ✓ | — |
| Send to banks, record responses, decide | owner | ✓ | — |
| Reassign | — | ✓ | — |
| Manage partner banks | — | ✓ | admin ✓ |

The website says only the mortgage team can open documents, so admins without a mortgage role get no document access. Any break-glass access must be logged and reviewed.

---

## 8. Security — what backs the website copy

W5–W7 tell applicants: "Encrypted in transit and at rest. Only Bazar's mortgage team can open them, and every view is recorded." C2 says: "Every open and download is recorded in the activity log." Each clause needs a control before launch:

| Claim | Control |
|---|---|
| Encrypted in transit | HTTPS only (HSTS); presigned uploads over TLS |
| Encrypted at rest | Private bucket with server-side encryption verified in provider settings; DB encrypted at rest |
| Only the mortgage team can open them | Dedicated private bucket; no public URLs; all reads through `/admin/mortgages/files/[id]` after a role check; signed URLs ≤ 60s if used; `Cache-Control: no-store` |
| Every view is recorded | `document.viewed` / `document.downloaded` written before bytes are returned; `mortgage_events` append-only at DB level |

Also:
- **Data residency** for financial PII — bucket and DB region decided in Phase 0 (§9).
- **Links:** 256-bit random tokens, stored hashed, one purpose and one request each, expiry (proposed 7 days), revocable. OTP: 6 digits, 10-minute expiry, 5 attempts, rate-limited per link and per IP. W8 shows the masked mobile ("verified with a code sent to +971 55 ••• 2290").
- **Public endpoints:** Turnstile + rate limits; size enforced in the presign conditions and re-checked on complete.
- **Malware scan** before any staff member can open a file.
- **Bank packages:** expiring, logged download links per bank — not email attachments.
- **No PII** in logs, Sentry or PostHog.
- **DSR:** export and delete by email/mobile across all mortgage tables, hooked into the platform's PDPL flow.

---

## 9. Open questions

| # | Question | Owner | Blocks |
|---|---|---|---|
| 1 | Region for mortgage documents and DB (UAE data residency for financial data) | Bazar + engineering | Phase 2 |
| 2 | Consent wording (currently v0.1, "to be confirmed by compliance") | Compliance | Launch |
| 3 | Sign-off on the security copy, once §8 is built | Engineering | Launch |
| 4 | Partner-bank list, package contacts, delivery method | Head of mortgages | Phase 6 |
| 5 | 24-hour clock: wall-clock (as designed) or working hours? | Bazar | Phase 1 |
| 6 | Assignment: round-robin on submit, or claim from the queue? | Head of mortgages | Phase 4 |
| 7 | Checks for Emirates ID, passport, trade licence, 3-month statements | Head of mortgages | Phase 5 |
| 8 | Decline: reason list, message template; can a file be declined before banks? | Head of mortgages | Phase 6 |
| 9 | End state for unreachable or withdrawn requests (not designed) | Head of mortgages | Phase 4 |
| 10 | Copy: password-protected PDF error; PDF-only oversize message | Design | Phase 3 |
| 11 | Link expiry (proposed 7 days) and document retention after closure | Compliance | Phase 5 / 7 |
| 12 | "licence" vs "license" — the designs use both | Design | Phase 3 |
| 13 | Minimum age / date-of-birth rules | Head of mortgages | Phase 3 |
| 14 | Also create a lead in the main Enquiries pipeline (`source = mortgage`)? | Bazar | Phase 3 |
| 15 | Arabic versions of W1–W8 | Bazar | After launch |
