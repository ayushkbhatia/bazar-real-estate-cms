# Build plan — mortgage requests (website + CMS)

## Where to begin

Begin with **Phase 0** today. It's one Claude Code session that maps this spec onto your repo without writing feature code. Also today, start the decisions that depend on other people: WhatsApp templates (Meta approval), consent wording (compliance), partner-bank contacts, and the storage region. These are more likely to delay launch than the code is.

Then **Phase 1**: schema and domain rules. Every screen depends on them, and they're cheapest to get right before any UI exists.

## Phases

| # | Phase | Screens | Size* |
|---|---|---|---|
| 0 | Recon, decisions, setup | — | ½–1 day |
| 1 | Data model & domain logic | — | 2 days |
| 2 | Secure document storage | — | 2 days |
| 3 | Website intake | W1–W7 | 3 days |
| 4 | CMS queue, file & consultancy | C1, C2, C6 | 3 days |
| 5 | Document review & re-upload loop | C3, C4, W8 | 3–4 days |
| 6 | Partner banks & decision | C5 | 3 days |
| 7 | Hardening & launch | all | 2–3 days |

\*One developer working with Claude Code. About 4–5 weeks in total, if the platform foundations below already exist.

**Prerequisites from the platform build** (`design_handoff_bazar_website_cms/docs/11`, Phase 0): auth with staff roles, Postgres + migrations, object storage, a job runner, an email sender, and the CMS shell. If any are missing, Phase 0 will list them. Build them first.

## How to run each phase in Claude Code

1. Start a fresh session (`/clear`) for each phase.
2. Paste the phase prompt. Stay in plan mode (Shift+Tab) until you've read and approved the plan.
3. Let it implement, then run tests, type-check and lint.
4. Check the diff against **Done when**, then open one PR per phase.
5. Claude updates `docs/mortgage/PROGRESS.md` at the end of every phase. That file carries context into the next session.

---

## Phase 0 — Recon, decisions, setup

**Goal:** Claude Code understands the repo and the spec. External decisions have started. No feature code.

**You do**
- Copy this folder into the repo as `docs/mortgage/`.
- Add the block below to the repo's `CLAUDE.md`.
- Create a `mortgage_requests` feature flag, off in production.
- Send SPEC §9 items 1–5 to their owners with dates. Submit the WhatsApp templates in SPEC §6.

**Add to CLAUDE.md**
```
## Mortgage module
- Spec: docs/mortgage/SPEC.md · Plan: docs/mortgage/PLAN.md · Log: docs/mortgage/PROGRESS.md
- Designs: docs/mortgage/design-references/ (open the HTML; screen source in screens/mreq-*.jsx).
  They are references. Rebuild them with this repo's components and tokens; don't copy the JSX.
- Copy in the designs is final. Use it verbatim.
- Status changes only through transition() in the mortgage domain module. Never write status directly.
- Deadline maths only in the SLA module. UI never computes deadlines.
- Mortgage files live only in the private mortgage bucket. Never return a public or long-lived URL.
  Every open or download writes a mortgage_events row first.
- mortgage_events is append-only.
- No PII in logs, Sentry or analytics.
- Migrations are forward-only.
- End every phase by updating PROGRESS.md: what was built, deviations from SPEC, open TODOs.
```

**Prompt**
```
Read @docs/mortgage/README.md, @docs/mortgage/SPEC.md and @docs/mortgage/PLAN.md, then explore this repo. Don't write feature code.

Write docs/mortgage/IMPLEMENTATION.md with:
1. Where each part of SPEC goes in this repo: public and admin route folders, ORM and migration tooling, auth and staff roles, file storage, background jobs, email and WhatsApp adapters, feature flags, test setup.
2. Existing code to reuse (CMS shell and nav, form components, the mortgage calculator's payment function, the enquiries/WhatsApp integration, audit logging) and anything in the repo that conflicts with SPEC.
3. Any platform prerequisites that are missing.
4. The files you expect to create or change in each phase.
5. Risks, and any SPEC decisions you would push back on, with reasons.

Create docs/mortgage/PROGRESS.md with an empty log.
```

**Done when:** you've reviewed and corrected IMPLEMENTATION.md, and SPEC §9 items 1–5 have owners and dates.

---

## Phase 1 — Data model & domain logic

**Goal:** migrations, types and every business rule, fully unit-tested, with no UI.

**Builds**
- Migration for all enums and tables in SPEC §3, plus the `mortgage_head` and `mortgage_adviser` roles.
- Append-only protection on `mortgage_events`.
- Domain module:
  - `documents.ts` — document sets per path, per-kind file rules, `requiredStatementMonths(kind, submittedAt)`
  - `checklists.ts` — review checks per kind, as data
  - `state.ts` — `transition(request, event, actor)` implementing SPEC §2.4
  - `sla.ts` — `slaStatus()`, start/pause/resume/stop, duration formatting
  - `reference.ts` — BZM-YY-NNNN allocation
  - `payments.ts` — the calculator's payment formula (reuse it if the calculator exists)
- Dev/staging seed matching the designs: the 11 queue rows in C1; the files for Priya Raman (BZM-26-0412) and Karim Haddad (BZM-26-0409); team Yasmin Abdalla (Head of mortgages), Rashid Khan and Leena Varghese (Mortgage advisers); banks FAB, ADCB, Mashreq.

**Prompt**
```
Phase 1 of @docs/mortgage/PLAN.md. Follow @docs/mortgage/IMPLEMENTATION.md for locations and conventions. Plan first, then build.

Write the tests first, then implement:
- One migration for every enum and table in SPEC §3, plus the two mortgage staff roles.
- Database-level append-only protection on mortgage_events.
- documents.ts, checklists.ts, state.ts, sla.ts, reference.ts and payments.ts as listed in PLAN Phase 1.
- A dev seed reproducing the data in C1, C2, C4 and C5 (names, references, statuses, document states), with clock values set relative to now.

Tests must cover:
- every allowed transition in SPEC §2.4 and a sample of illegal ones
- SLA start, pause, resume, stop, at-risk at 4h, breach, met
- required statement months across a year boundary
- per-kind file limits, including multi-file totals
- reference allocation under concurrent submits
- AED 2,150,000 at 3.99% over 25 years = AED 11,337 a month

Migrate a fresh database, run the seed and run the tests. Update PROGRESS.md.
```

**Done when:** a fresh database migrates and seeds, all domain tests pass, and `transition()` is the only code that writes `status`.

---

## Phase 2 — Secure document storage

**Goal:** files can be uploaded to a draft, validated, scanned, attached to a request, and opened only by the mortgage team, with every open logged.

**Builds**
- Private bucket in the agreed region. `drafts/` prefix with a 24h lifecycle rule. CORS limited to the website origin.
- Draft and file endpoints from SPEC §4.2, with bot protection and rate limits.
- Completion checks: magic-byte type, password-protected PDF detection, page count, sha256, size re-check.
- Malware-scan job. Files can't be attached or opened until clean.
- `/admin/mortgages/files/[fileId]`: role check → event → stream with `no-store`.

**Prompt**
```
Phase 2 of @docs/mortgage/PLAN.md. Plan first.

Build the storage layer from SPEC §4.2 and §8:
- Draft creation with bot protection and rate limiting.
- Presigned uploads that enforce the per-kind rules in documents.ts, including running totals for statement sets.
- Completion checks: magic bytes, password-protected PDF detection, page count, sha256, size.
- Malware scanning as a background job. A file can't be attached or opened until it is clean.
- The staff file endpoint. It writes document.viewed or document.downloaded to mortgage_events before returning any bytes.

No UI in this phase. Write integration tests against a local S3-compatible store. Include a test that a staff user without a mortgage role, including an admin, gets 403 on the file endpoint. Update PROGRESS.md.
```

**Done when:** tests pass. Oversize, wrong-type and password-protected files are rejected. Unauthorised requests get 403. Every open writes an event row.

---

## Phase 3 — Website intake (W1–W7)

**Goal:** a visitor can submit both services end to end on staging.

**Builds**
- Routes and query params from SPEC §4.1. Copy verbatim.
- W1 service cards with URL preselect. W2 details with validation, kept in sessionStorage.
- W3 → submit → W4 for consultancy.
- W5/W6 upload rows in every state shown: empty, uploading (progress, Cancel), added (Replace / Add more files), needs attention. Consent checkbox. CTA rules from SPEC §2.2.
- Submit endpoint: `transition()` → reference, SLA start, document rows, files attached, consent stored, events.
- W4/W7 confirmation pages. W7 shows "We'll contact you by {due}".
- Confirmation emails for both services.
- The five entry points, behind the flag.

**Prompt**
```
Phase 3 of @docs/mortgage/PLAN.md. Plan first.

Build W1–W7 from docs/mortgage/design-references (screens/mreq-front-1.jsx, mreq-front-2.jsx, mreq-shared.jsx). Rebuild them with this repo's components and tokens. Copy is final and verbatim. Path A/B/C labels are internal and never shown to applicants.

- Routes and query params from SPEC §4.1. W1–W2 answers stay client-side until submit.
- W5 and W6 upload rows with every state in the designs, using the Phase 2 API. Limits come from documents.ts; the statement month notes come from requiredStatementMonths().
- The submit endpoint: create the request through transition(), allocate the reference, start the SLA for pre-approvals, attach draft files, store consent (wording version, IP, user agent) and write events.
- W4 and W7, session-bound, with no PII in the URL.
- Confirmation emails for both services (SPEC §6).
- The five entry points in SPEC §4.1, behind the mortgage_requests flag.
- Playwright tests for Paths A, B and C, plus the oversize-file error.

Only desktop (1440px) is designed. Below 1024px, stack the side rail under the main column. Check each screen against its design at 1440px and 390px before finishing. Update PROGRESS.md.
```

**Done when:** all three paths submit on staging with correct rows and events, emails arrive, the pages work at 390px, and Playwright passes.

---

## Phase 4 — CMS queue, file & consultancy (C1, C2, C6)

**Goal:** the team can see and own every request, and can work a consultancy request from start to finish.

**Builds**
- "Mortgages" nav item in the CMS shell, with the open count.
- C1 as specified in SPEC §4.3.
- C2 (pre-approval), except the viewer (Phase 5) and bank sending (Phase 6): header chips, stage rail, clock, document set card with file tags, applicant card, owner and reassign, contact buttons, consent card, activity.
- C6: contact log with Reached / No answer / Left a message; booking card (adviser, format, day, slot); invite by email and WhatsApp with .ics; Send pre-approval link (creates and sends the link; the landing page comes in Phase 5); mark completed.
- Owner assignment (SPEC §2.7) and the `sla.tick` job.

**Prompt**
```
Phase 4 of @docs/mortgage/PLAN.md. Plan first.

Build C1, C2 and C6 from docs/mortgage/design-references (screens/mreq-cms-1.jsx) inside the existing CMS shell, with the permissions in SPEC §7.

- C1: tabs, filters, search, promise-due sort, at-risk banner, pagination and masked mobiles as in SPEC §4.3. Clock values come only from slaStatus().
- C2: everything except the document viewer (Phase 5) and bank sending (Phase 6). Employment type is read-only after submission.
- C6: contact log and attempt logging (the first attempt moves New → Contacted); booking with adviser slots from working hours minus existing bookings; invite by email and WhatsApp with an .ics; Send pre-approval link (create and send the access link only); mark completed.
- Owner assignment per SPEC §2.7; reassign for the Head of mortgages; claim for advisers.
- The sla.tick job and at-risk/breach notifications, idempotent.
- Every status change goes through transition() and every action writes an event.

Use the Phase 1 seed so the screens can be compared with the designs. Add integration tests for permissions and for sla.tick with a fake clock. Update PROGRESS.md.
```

**Done when:** seeded C1, C2 and C6 match the designs. A consultancy request moves New → Contacted → Consultation booked → Completed. The at-risk alert fires in a fake-clock test.

---

## Phase 5 — Document review & re-upload loop (C3, C4, W8)

**Goal:** the team can review every document. A flagged document goes back to the applicant and returns without touching the accepted ones.

**Builds**
- Viewer: document tabs with state, file switcher for statement sets, PDF and image rendering, zoom, rotate, logged download, page indicator.
- Review panel: checks from `checklists.ts`, recorded fields for salary certificates, statement periods → coverage grid, Accept, "Next: …" link.
- Request re-upload (C4, and C2's "Request documents" with a document picker): reason chips, message, channels, the pause note.
- W8 at `/mortgages/r/[token]`: OTP → one-document upload → Send documents.
- Invite landing for links sent from C6: OTP → documents step with details carried over → child request.
- C2 "Accept application" enabled at 4 of 4 accepted. Sending comes in Phase 6.

**Prompt**
```
Phase 5 of @docs/mortgage/PLAN.md. Plan first.

Build C3 and C4 (screens/mreq-cms-2.jsx) and W8 (screens/mreq-front-2.jsx).

- The document viewer with PDF and image rendering, tabs, file switcher, zoom, rotate, logged download, and the review panel. Checks come from checklists.ts. Accept is enabled only when every check is ticked. Staff enter a period for each statement file, and the coverage grid is computed from those periods.
- The owner's first document open moves New → In review.
- Request re-upload: reasons, message and channels. It creates the reupload request and access link, moves the file to Awaiting applicant (the SLA pauses) and sends WhatsApp (approved template) and email.
- /mortgages/r/[token]: OTP to the mobile on file, then an upload scoped to that one document. Accepted documents are read-only. Sending moves the file back to In review (the SLA resumes) and notifies the owner.
- The invite landing for links sent from C6: OTP, then the documents step with details carried over. Submitting creates a child pre-approval request linked to the consultancy request.
- Link security as in SPEC §8.

Tests: expired and revoked links, the OTP attempt limit, access to another request's link denied, accepted documents unchanged after a re-upload, paused time excluded from the deadline. Playwright: C4 → W8 → back in C2. Update PROGRESS.md.
```

**Done when:** Karim's seeded file completes the loop, and time remaining after resume equals time remaining at pause.

---

## Phase 6 — Partner banks & decision (C5)

**Goal:** accepted files go to banks, responses are recorded, and the applicant hears back within the 24 hours.

**Builds**
- Banks admin page (not designed; CMS table pattern): code, name, colour, active, package emails.
- Accept application → choose banks (default: all active) → per-bank package: structured summary plus an expiring, logged download link → With banks.
- C5: status tiles; bank responses (amount, rate, type, fixed years, valid until, letter upload); computed 25-year monthly payment; Send a reminder; lead offer; Pre-approve / Decline; editable message; channels; Confirm.
- Decline path, per SPEC §9 item 8.

**Prompt**
```
Phase 6 of @docs/mortgage/PLAN.md. Plan first.

Build partner-bank sending and C5 (screens/mreq-cms-2.jsx, MrqDecision).

- A minimal banks admin page using the CMS table pattern (not designed).
- Accept application on C2, enabled at 4 of 4 accepted: choose banks, build one package per bank (structured summary plus an expiring, logged download link, no attachments), email it, create submission rows and move the file to With banks.
- C5: record each bank's response with its letter PDF, compute the 25-year monthly payment with payments.ts, send reminders, choose the lead offer, pre-approve or decline with an editable message, and notify by email (with the letter) and WhatsApp. Confirming stops the SLA and records met or breached.
- No package is sent without consent on file. Block and explain if it's missing.

Tests: can't send without consent or with fewer than 4 accepted documents; the decision stops the clock; package links expire and log access. Playwright: Priya's seeded file from In review to Pre-approved. Update PROGRESS.md.
```

**Done when:** Priya's file runs end to end, the applicant gets the email, letter and WhatsApp, and C1 shows the file under Closed.

---

## Phase 7 — Hardening & launch

**Goal:** safe to switch on for real applicants.

**Builds**
- A security review against SPEC §7–8, then fixes, then a human review. Add a pentest if the budget allows.
- Production checks behind each claim in the website security copy, then engineering sign-off.
- Retention purge, and DSR export/delete for mortgage data.
- PII scrubbing in error reporting. A no-PII funnel from W1 to submit. SLA met-rate metric.
- Accessibility: keyboard uploads, focus management across steps, announced errors, contrast.
- Runbook: stuck scans, bounced emails, rejected WhatsApp templates, disputed clocks.
- UAT with the mortgage team on staging. Then turn the flag on for internal users, then for the public.

**Prompt**
```
Phase 7 of @docs/mortgage/PLAN.md.

1. Review every mortgage route, action and job against SPEC §7 and §8. Write docs/mortgage/SECURITY-REVIEW.md listing each control, where it's implemented, and any gap. Don't fix anything yet.
2. After I approve the list, fix the gaps, with tests.
3. Add the retention purge and DSR export/delete for mortgage data.
4. Add PII scrubbing to error reporting and a no-PII analytics funnel from W1 to submit.
5. Run axe on W1–W8 and C1–C6 and fix the violations.
6. Write docs/mortgage/RUNBOOK.md.
Update PROGRESS.md.
```

**Done when:** the security review is signed off, UAT passes, and the flag is on.

---

## After launch

Not in this plan. Each needs design first: OCR read-back, bank APIs, an applicant tracker page, banks asking for extra documents mid-review, calendar sync, Arabic.
