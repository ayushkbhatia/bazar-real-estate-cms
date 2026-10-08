# Mortgage module — decision register

Every open question in [SPEC.md](SPEC.md) §9, both handoffs (FE-n in
[frontend/00-foundations](frontend/00-foundations/README.md) §15, CMS-n in
[cms/00-foundations](cms/00-foundations/README.md) §14), and what Phase 0 found
in the repo ([IMPLEMENTATION.md](IMPLEMENTATION.md)). One row per decision:
who owns it, when the build needs it, and the recommendation.

"Needed by" dates come from the indicative schedule in IMPLEMENTATION.md §4
(Phase 1 starting Tue 29 Sep). If the schedule moves, they move with it. When
a decision is made, set Status to the date and write the answer in the row.
Don't delete the row.

PLAN Phase 0 is done when D1–D7 (SPEC §9 items 1–5, plus the channel and
scanner choices that follow from them) have owners and dates.

## A. Outside parties — start now

These wait on people outside the build. They block launch more than code does.

| ID | Decision | Owner | Needed by | Recommendation | Source | Status |
|---|---|---|---|---|---|---|
| D1 | **WhatsApp Business API.** Needs a Meta-verified business, a WhatsApp Business account, a dedicated number (not one already on the WhatsApp app), a system-user access token, and approved templates (drafts in the appendix). Nothing in the repo sends WhatsApp today | Whoever controls Bazar's Meta Business Manager | Phase 4 · 8 Oct (invites). Launch blocker for W8 codes if D5 picks WhatsApp | Start business verification today. The build is email-first, and WhatsApp switches on by env when approved | SPEC §6 | Open |
| D2 | **Consent wording.** Final English text and its version; one consent or several (sharing with banks, credit-bureau check, marketing); an Arabic legal translation for later | Compliance | Launch. v0.1 is stored until then | Unticked by default. Bump the version on every wording change; each consent row stores the version and text it was given under | SPEC §9 #2 · FE-11 | Open |
| D3 | **Partner banks.** The list (FAB, ADCB, Mashreq?); package recipients per bank; whether they accept an expiring download link rather than attachments or their own portal; how long the link lives; any bank forms the applicant must sign; referral agreements; permission to show logos | Head of mortgages | Phase 6 · 19 Oct | Confirm the link approach with at least one bank before Phase 6 | SPEC §9 #4 | Open. **Built on defaults in Phase 6** (below): the list is data the Head keeps, starting empty in production; links live `link_expiry_days` (7) |
| D4 | **Where applicant data lives.** Supabase and the functions run in Tokyo (ap-northeast-1 / hnd1), so Emirates IDs and bank statements would be stored in Japan. Does financial PII have to stay in the UAE, for the documents only or for the database rows too? | Bazar + compliance, with engineering | Phase 2 · 1 Oct | Ask compliance this week. If documents must stay in the UAE, use AWS S3 in `me-central-1` (IMPLEMENTATION §1.7); otherwise a private Supabase bucket | SPEC §9 #1 | Open |
| D5 | **How applicants get their code** (W8 and the invite link). WhatsApp authentication template (needs D1), SMS (UAE sender-ID registration through a provider, weeks), or email as a fallback. Codes are email-only in the repo today | Bazar | Phase 5 · 13 Oct | WhatsApp, falling back to email. Email only at launch if D1 slips; W8's "code sent to {maskedMobile}" then needs a variant | SPEC §6, §8 | **Decided 28 Sep: WhatsApp**, falling back to email while the Business API (D1) isn't connected. Built in Phase 5 behind a channel switch: codes go by email today, and by WhatsApp's authentication template once D1 lands |
| D6 | **Malware scanner.** Follows D4: GuardDuty Malware Protection (with S3; check it's offered in `me-central-1`), a ClamAV container in the same region, or a paid scanning API (sends files abroad). Never VirusTotal, which shares uploads | Ayush, with Bazar for cost | Phase 2 · 1 Oct | Decide together with D4 | SPEC §8 | **Decided 8 Oct: no scanner** (Ayush: "We are not building a scanner. We are ok to accept any and all documents."). A file is ready once it passes the format checks (type from its bytes, size, no password, page count); the scanner adapter, its variables and the worker's retry were removed, and nothing waits for a scan. `scan_status = 'clean'` now means "passed those checks". Accepted risk: SECURITY-REVIEW SR-3 |
| D7 | **Retention and link expiry.** How long files and requests are kept after closure; secure-link lifetime (proposed 7 days); whether the UAE AML 5-year record rule for brokers applies to these documents | Compliance | Links: Phase 5 · 13 Oct. Retention: Phase 7 · 22 Oct | — | SPEC §9 #11 | **Links decided 28 Sep: 7 days** (`mortgage_settings.link_expiry_days`, already 7). Retention still open: **the purge is built and off** until `retention_months` is set (Phase 7, below). The AML question also decides how erasure treats these files |
| D17 | **Security copy sign-off.** "Encrypted in transit and at rest. Only Bazar's mortgage team can open them, and every view is recorded." Each clause needs its control built and checked (SPEC §8) | Ayush | Launch | Sign off in Phase 7 against SECURITY-REVIEW.md | SPEC §9 #3 · FE-11 | Open |

## B. Product decisions for Bazar

| ID | Decision | Owner | Needed by | Recommendation | Source | Status |
|---|---|---|---|---|---|---|
| D8 | **Staging.** There is no non-production database. The mortgage seed, admin e2e, real email/WhatsApp tests and UAT need one | Ayush + Bazar (monthly cost) | Phase 3 · 5 Oct (a local Supabase stack covers Phases 1–2) | A second Supabase project, with Vercel Preview pointed at it | IMPLEMENTATION §1.14 | Open |
| D9 | **How mortgage roles are modelled.** New `staff_role` values (SPEC) or a separate `staff.mortgage_role` column (head, adviser) | Ayush | Phase 1 · 29 Sep | The column. Staff have one role each today, and permissions only know "any staff" and "admin"; the column lets an admin also be Head of mortgages without touching every role list | SPEC §3 · IMPLEMENTATION §2.2 | **Decided 28 Sep: the column.** Built in 0138 |
| D10 | **Admins without a mortgage role can't open anything** in the module (SPEC §7, because the website promises only the mortgage team can). Also: how break-glass access works and who reviews it | Bazar | Phase 1 · 29 Sep | Keep SPEC's rule; break-glass means temporarily granting a mortgage role, which is itself logged | SPEC §7 · CMS-1 | **Decided 28 Sep: yes, locked out.** RLS in 0138; tested. Break-glass: RUNBOOK §6 (grant a role in SQL, naming who and why; the Head agrees and reviews); every role change is audited by a trigger (0152, SR-14) |
| D11 | **The 24-hour promise: wall-clock or working hours?** Designed as wall-clock, nights and weekends included, and W7 shows the exact time. A Friday 18:00 submission would be due Saturday 18:00 | Bazar | Phase 1 · 29 Sep (changes `sla.ts`) | Keep wall-clock only if weekend cover is staffed; otherwise switch to working hours before launch and adjust W7's copy | SPEC §2.5, §9 #5 | **Decided 28 Sep: working hours.** Built in sla.ts: a 24-hour budget of working time against Bazar's published office hours (Sun–Thu 09:00–19:00, Fri 09:00–15:00, Sat closed), minus holidays. See D11a |
| D11a | **What the promise now says to applicants.** 24 *working* hours is about 2½ working days at those office hours: a Tuesday 10:14 submission falls due Thursday 14:14, a Friday 14:00 one on Tuesday 12:00. W1's "Within 24 hours" badge, W1's "within 24 hours" and W7's "24 hours from when you submitted" read as calendar time. Either change that copy to say working hours, or shorten the budget (one setting, `sla_budget_minutes`). Also: are the mortgage team's hours the office hours? | Bazar + design | Phase 3 · 5 Oct (the copy ships then) | Keep 24 working hours and change the copy to "within 24 working hours"; the budget and hours are settings, so either answer is a data change | D11 · W1 · W7 | **Decided 28 Sep: keep 24 working hours.** The copy must say so. Design to reword W1's badge ("Within 24 hours") and description, the "We contact you within 24 hours" step (W5, W6, W7), and W7's "24 hours from when you submitted" before Phase 3 ships them |
| D30 | **Public holidays.** The clock skips the dates in `mortgage_holidays`, which starts empty. UAE holidays (Eid dates move with the moon sighting) need entering, with who keeps them current | Bazar | Phase 4 · 8 Oct (the settings screen) | The Head of mortgages maintains them on the mortgage settings page | D11 | Open |
| D12 | **Arabic.** SPEC says English only for v1, but CI requires every public string to have Arabic in the catalogue (G-8) | Bazar | Phase 3 · 5 Oct | Ship the machine-drafted Arabic catalogue (ADR-0008) and serve English only until Bazar approves it. Keep the consent's Arabic off any live page until a person approves it | SPEC §1 · IMPLEMENTATION §1.11 | **Default applied 28 Sep (Phase 3):** machine-drafted `messages/ar/mortgage.json` (provenance: unreviewed); the flow serves English only and `/ar/mortgages` redirects to English (`lib/i18n/english-only.ts`). Bazar's approval of the Arabic is still open |
| D13 | **Enquiries and Salesforce.** Should a mortgage request also appear in Enquiries or go to Salesforce `Lead__c`? | Bazar | Phase 3 · 5 Oct | At most a minimal lead (name, mobile, reference); no financials or documents ever leave. Salesforce's `Inquiry_Type__c` only accepts Buy, Sell or Rent, so Levarus would add a value | SPEC §9 #14 | **Default applied 28 Sep (Phase 3):** no lead is created. Open if Bazar wants one |
| D14 | **New accounts.** Upstash (rate limits; also switches on the limits every existing form already has in code) and Cloudflare Turnstile (bot check). Both have free tiers, and the client takes them over at handover | Ayush + Bazar | Phase 2 · 1 Oct | Open both | SPEC §4.2, §8 | **Turnstile decided 9 Oct: none** (Ayush: "We don't need the turnstile either — it's simply complicating the workflow."). The bot check was removed from draft creation and submit, with its variables. Upstash stays optional: without it the rate limits do nothing, and nothing is refused. Accepted risk: SECURITY-REVIEW SR-2 |
| D15 | **Consultations.** Formats offered (phone, video, office); where video-call links come from (per-adviser link?); the "before 12:00, as Ahmed asked" slot filter; who sets advisers' working hours, and where | Head of mortgages | Phase 4 · 8 Oct | A per-adviser video link and weekly hours on a mortgage settings page | CMS-7 · IMPLEMENTATION §1.2 | Open |
| D16 | **The team.** Are Yasmin Abdalla, Rashid Khan and Leena Varghese real staff? Who gets which mortgage role? W8 shows "Mortgage adviser" for Yasmin, while the CMS says "Head of mortgages" | Bazar | Phase 4 · 8 Oct (UAT) | Take the label from the staff record | FE-7 | **Default applied 28 Sep (Phase 5):** W8 shows the adviser's job title from their staff record (`staff.title`, the one /agents shows); a record without one shows only the time. Who the team is remains open |
| D18 | **Assignment.** Round-robin across active advisers on submit, or advisers claim from the queue? | Head of mortgages | Phase 4 · 8 Oct | Build both behind the setting SPEC asks for; default to round-robin | SPEC §2.7, §9 #6 · CMS-10 | Open — **both built 28 Sep (Phase 4)**, round-robin by default; the Head of mortgages switches at /admin/mortgages/settings |
| D19 | **Decline.** Reasons, message template, and whether a file can be declined before it goes to banks | Head of mortgages | Phase 6 · 19 Oct | — | SPEC §9 #8 | **Decided 29 Sep (left to us, and built ahead of Phase 6):** eight reasons, kept on the request — income below the banks' minimum; monthly debts too high (the Central Bank's 50% debt-burden cap); credit report (AECB); too short in the job or business; age at the end of the term; documents incomplete; no bank made an offer; other. The message is the adviser's, prefilled per reason (thanks, the outcome, the reason, what could change it, an open door, their first name — `lib/mortgage-requests/decline.ts`) and edited before sending; "Other" can't go until they write why. **Before the banks: yes**, from New, In review, Awaiting applicant or With banks; the clock stops as for a pre-approval, an open re-upload is cancelled, banks still deciding are withdrawn, and "no bank made an offer" is offered only once the banks were asked. Migration 0147; "Decline" on C2 now, and C5's Decline tab in Phase 6 |
| D20 | **Unreachable or withdrawn requests.** What end state they get | Head of mortgages | Phase 4 · 8 Oct | — | SPEC §9 #9 | Open |
| D21 | **Review checks** for Emirates ID, passport, trade licence and 3-month statements (only the salary certificate and 12-month statements are designed). Should the salary certificate's three recorded fields be required before Accept? | Head of mortgages | Phase 5 · 13 Oct | SPEC's proposed checks; the fields required, since C5 prices on them | SPEC §2.3, §9 #7 · CMS-3 | **Decided 28 Sep: the recommendation** — SPEC's proposed checks for every kind, and the salary certificate's three recorded fields required before Accept |
| D22 | **Minimum age and date-of-birth rules** | Head of mortgages | Phase 3 · 5 Oct | — | SPEC §9 #13 | Open |
| D23 | **Loan-to-value figures.** W2 and C2 say UAE National up to 85%, expat up to 80% (the Central Bank caps for a first home under AED 5M). The calculator's defaults compute 75% for residents under AED 5M. The property FAQ says 80% and 60% | Bazar | Phase 3 · 5 Oct | One source: fill `{ltv}` from mortgage settings, defaulting to the design's values, and align the calculator and the FAQ | Phase 0 finding | **Built 28 Sep (Phase 3):** `mortgage_settings.ltv_national_pct` / `ltv_expat_pct` (85/80) fill W2's "Up to {ltv}% LTV". **Aligned 1 Oct:** the calculator follows the Central Bank's first-home caps — a new "UAE national" buyer status at 15% / 25% minimum deposit either side of AED 5M, residents and GCC nationals at 20% / 30% (were 25% / 35%), non-residents 50% — all editable under Settings → Mortgage; the property FAQ's default says 85% / 80% for a first home under AED 5M and 50% for non-residents |
| D24 | **Non-residents.** W2 only offers UAE National or UAE Resident/Expat and only accepts UAE mobiles; the calculator supports non-residents | Bazar | Phase 3 · 5 Oct | Intentional? If so, say so on the calculator's pre-approval buttons | Phase 0 finding | **Default applied 28 Sep (Phase 3):** as designed (no non-resident option). **Built 1 Oct:** while the application is open, the calculator's pre-approval band says under its buttons that online applications are for UAE nationals and residents, and that people living abroad should contact Bazar (`flow_note`, editable in Pages & blocks → Mortgage calculator, with its Arabic) |
| D25 | **The calculator's old pre-approval form.** `mortgage_preapproval` files an enquiry today; the fallback link `/contact?source=mortgage` ignores its parameter | Bazar | Phase 3 · 5 Oct | Retire it when the flag goes public; the calculator's buttons point at the new flow | Phase 0 finding | **Built 28 Sep (Phase 3):** while the flag is `public`, the form stops drawing and the calculator's buttons open the flow |
| D26 | **The unused `mortgage_inquiries` table** (and its three enums) | Ayush (needs G2) | Phase 1 · 29 Sep | Count production rows; leave it if any exist | Phase 0 finding | **Decided 1 Oct: drop it** (0 rows in production). The code stopped reading it, and `0154_drop_mortgage_inquiries.sql` rebuilds `anonymise_by_email()` without it, then drops the table and its enums; it refuses to run if a row has appeared. Applied after the code is deployed |
| D27 | **Are the permit number and phone numbers real?** "ADREC permit MB-2026-01184", +971 2 632 2223, WhatsApp +971 50 691 1103. Where does the permit line go on small screens? | Bazar | Phase 3 · 5 Oct | Keep the permit line visible on mobile, under the top bar | FE-10 · FE-12 | **Default applied 28 Sep (Phase 3):** the design's numbers, flagged in `lib/mortgage-requests/copy-status.ts`; the permit line moves under the top bar on a phone. Confirming the numbers is still open |
| D28 | **"licence" or "license"** (the designs use both) | Design | Phase 3 · 5 Oct | "licence" (UAE English) everywhere | SPEC §9 #12 · FE-8 · CMS-16 | **Applied 28 Sep (Phase 3):** "licence" (the row reads "Business trade licence") |
| D29 | **Copy for every email and WhatsApp message.** SPEC §6 only summarises them: 8 to applicants, 4 to the team, 2 to banks, plus the WhatsApp templates. The default decision message isn't specified | Design + Bazar | Confirmations: Phase 3 · 5 Oct. The rest: Phases 4–6 | — | SPEC §6 · CMS-6 | Open. Every email is now a draft with copy of ours; the default pre-approval message is built from the design's sample (Phase 6, below) |

## C. Design gaps from the handoffs

Each screen README lists the gaps that affect it. When the build meets one
before it is designed, it uses a clearly marked TODO string or a stub and lists
it in PROGRESS.md, as the handoff prompts ask.

**Website (Phase 3 unless noted)** — Phase 3 shipped these with the defaults
below, each flagged in `lib/mortgage-requests/copy-status.ts` or PROGRESS.md
until design answers: FE-1 copy written; FE-3 nothing selected; FE-4 documents
the new set doesn't need are dropped, no warning; FE-5 "Add more files" for the
ID's second side, then "Replace"; FE-6 lede kept verbatim; FE-9 the READMEs'
proposed layouts (phone stepper names only the current step); FE-13 no
confirmation, Exit returns to the entry page; FE-14 each screen's own order;
W2's consultancy CTA "Continue" with the employment note hidden; "Back to Bazar"
to the entry page; the all-ready-but-no-consent note "Tick the consent box to
continue".

| ID | Gap |
|---|---|
| FE-1 | All validation messages on W2, and upload error copy: `total_exceeded`, `bad_type`, `too_many_files`, `encrypted_pdf`, `infected`, `scan_failed`, `network` (with retry), `draft_expired`, and the PDF-only oversize variant (SPEC §9 #10) |
| FE-2 | W8: code entry, invalid link, expired link, already sent, success; the invite landing (Phase 5) |
| FE-3 | W1 without a `service` parameter: nothing selected, or Fast Pre-Approval preselected? |
| FE-4 | Changing employment type after uploading, with a warning first |
| FE-5 | Adding only the back of the Emirates ID |
| FE-6 | The documents lede lists image formats, but two kinds are PDF only |
| FE-9 | Tablet and mobile layouts (only 1440px is designed) |
| FE-13 | Exit confirmation when there's unsaved data |
| FE-14 | Selection chip order differs between W3 and W5/W6 |
| — | W2's consultancy CTA label and whether its employment note shows; submit loading states; the "Back to Bazar" target; the footer note when everything is ready but consent isn't ticked; W8 copy for kinds other than statements, and its lede when the accepted count isn't three |

**CMS**

| ID | Gap | Phase |
|---|---|---|
| CMS-2 | Reassign and claim; edit applicant; C1's Closed tab, empty, loading and error states; met and breached clock states; full activity log | 4 |
| CMS-2 | Marking a consultation held, no-show or cancelled | 4 |
| CMS-2 | The "Request documents" picker; the review panel's accepted and read-only states | 5 |
| CMS-2 | Choosing banks after "Accept application"; recording a bank response; the Decline mode (built from C2 for D19: see "Defaults built for D19" below); the partner banks page | 6 |
| CMS-3 | Where check sub-lines come from ("First Abu Dhabi Bank", "14 Sep 2026 · 8 days ago") | 5 |
| CMS-4 | Gendered copy in C4's pause note and C6's invite card ("His…", "he'll…"); Bazar doesn't collect gender, so the copy needs to be neutral | 4–5 |
| CMS-5 | Where staff enter each statement's period | 5 |
| CMS-8 | "Started from" labels for the other entry points | 4 |
| CMS-9 | Owner filter options and other sort orders | 4 |
| CMS-11 | At-risk banner wording when several files are listed | 4 |
| CMS-12 | Stage rail for Awaiting applicant and Declined | 4 |
| CMS-13 | Tooltip for actions disabled on files you don't own | 4 |
| CMS-14 | Message when someone else changed the file (409) | 4 |
| CMS-15 | How a breached promise looks in the queue and on the file | 4 |
| CMS-17 | Whether C4 and C5 warn that free text goes only by email outside WhatsApp's 24-hour window | 5–6 |
| — | Mortgage settings page (flag, assignment mode, adviser hours) — not in the designs; proposed in IMPLEMENTATION §1.10 using the CMS form pattern | 4 |

**Defaults built in Phase 4 (28 Sep), for design to confirm or replace.** Each
string is in `PENDING_CMS_COPY` (`lib/mortgage-requests/cms-strings.ts`).

| ID | What was built |
|---|---|
| CMS-1 | Admins without a mortgage role get a 404 and no nav item (D10) |
| CMS-2 | **Claim:** a "Claim" link on unassigned files (C2's Owner card, C6's contact-log header); a second claim answers 409. **Reassign:** a small dialog listing the team, Head of mortgages only. **Edit applicant:** a dialog with name, date of birth, mobile, email and residency; employment is shown locked with the reason. **Held:** once booked, the booking card becomes a summary with "Mark consultation held"; no-show and cancel aren't built. **C1:** the Closed tab (most recently closed first, footer "Showing {shown} of {total} closed requests"), "No requests here." / "Nothing matches that search." / an error line in the table body, the table dimmed while a search loads. **Full activity log:** "View all {count}" expands in place |
| CMS-4 | Neutral: "Their details carry over and they'll only see the {employment} document set." |
| CMS-7 | No time-of-day filter: "Time · {adviser}'s free slots", all free slots shown |
| CMS-8 | Home page, Property page, Services menu, "Pre-approval link from a consultation", Direct |
| CMS-9 | Owner: anyone, me, unassigned, each team member. Sort: promise due only |
| CMS-11 | "has {remaining} left" on every name, joined as a list; after three names, "and {n} more" |
| CMS-12 | In review stays current while awaiting the applicant, with an "Awaiting applicant" pill in the header; Declined takes the last stage's place |
| CMS-13 | Actions a caller can't take are hidden (Reassign, Edit) or disabled with "Only the owner or the Head of mortgages can do this." as the tooltip |
| CMS-14 | "Someone else changed this request. Reload to see the latest, then try again." — and the page re-reads itself |
| CMS-15 | "{overdue} overdue" in the danger colour with a full bar; met shows "Met · {elapsed}" |
| — | The settings page (`/admin/mortgages/settings`, Head only): flag, assignment mode, the two LTV figures, public holidays; working hours shown read-only. Adviser hours are read from `mortgage_adviser_hours` if present, but have no editor yet (D15) |

**Defaults built in Phase 5 (28 Sep), for design to confirm or replace.** CMS
strings are in `PENDING_CMS_COPY`; website strings are in
`lib/mortgage-requests/copy-status.ts`.

| ID | What was built |
|---|---|
| FE-2 | **Code entry:** one field (`autocomplete="one-time-code"`), "Send code", then "We sent a code to {destination}. It works for 10 minutes.", a new code after 60 seconds, and the tries left after a wrong one. **States:** an unknown or cancelled link reads the same ("This link doesn't work"); expired; locked after five wrong codes; "You've already sent this"; and for an invite, "You've already applied" with the reference. None of them shows anything of the application. **Sent:** "Thanks, {firstName}." and that the file is back in review. **Invite landing:** W5/W6's documents step under the secure pill, with "Fast Pre-Approval · from your consultation {reference}" and a lede saying the details carry over; sending it shows W7 without the stepper |
| — | **W8 for other document kinds:** the pill shows the reason chosen in C4; the coverage grid shows only when the reason is "Period incomplete" (a new file has no period until the reviewer enters one, so it isn't a missing month); the dropzone says "Upload a new {document}" when the files replace the document's (a single-file kind, or unreadable, wrong or expired) and "Add to your {document}" otherwise; the rail reads "checks your new document". The lede for any count other than three accepted is an ICU plural |
| CMS-2 | **Request documents:** a dialog picking the document, then C4's form in the viewer. **Accept application:** enabled at 4 of 4 with consent on file, opening a dialog that says the banks come in Phase 6. **Review panel:** accepted ("Accepted by {name} · {time}") and awaiting (the request's date and the adviser's message) states, read-only. **Cancel request** on C2, behind a confirm, because the applicant's link stops working |
| CMS-3 | Sub-lines come from the recorded fields (addressed to, issued on, salary, account holder) and the file (the applicant's name, the coverage). "Signed and stamped" and "Issued by the bank" show the design's hint lines. Red only when the line reports a problem (months missing); otherwise muted |
| CMS-5 | A "Statement periods" list under the checks: one From–To month pair per file. Saving a pair recomputes the coverage and ticks or unticks "Covers the last N months", which is never ticked by hand |
| CMS-17 | No 24-hour-window warning: WhatsApp isn't connected (D1). When WhatsApp is ticked, C4 notes "WhatsApp isn't connected yet, so this goes by email." Revisit with D1 |

**Defaults built for D19 (29 Sep), for design to confirm or replace.** Every
string is in `PENDING_CMS_COPY`.

| ID | What was built |
|---|---|
| CMS-2 (Decline) | A "Decline" button on C2's header, beside Request documents, for the owner or the Head while the file is open. It opens a dialog: reason chips, then the message to the applicant (prefilled, editable; switching reason rewrites it only while untouched), Send by (Email always, WhatsApp as chosen, with the not-connected note), a line on what happens (the clock stops at the elapsed time; an open re-upload is cancelled), and "Decline & notify {firstName}". Once decided, a **Decision** card heads C2's rail: the status, the reason, who and when, and the message sent. The activity reads "{actor} declined the application" with the reason |
| CMS-6 (decline) | The applicant's email (`mortgage_decision_declined`, a Content Assets draft): a subject that doesn't say "declined" (it shows on a lock screen), the adviser's message quoted as written, and replies to whoever decided |

**Defaults built in Phase 6 (29 Sep), for design and Bazar to confirm or
replace.** Every CMS string is in `PENDING_CMS_COPY`; the three emails are
Content Assets drafts.

| ID | What was built |
|---|---|
| D3 | **The list is data** (`mortgage_partner_banks`), kept at `/admin/mortgages/banks` by the Head of mortgages or an admin on the team, and by any admin at `/admin/settings/partner-banks` (Phase 7, SR-13); the rest of the team reads it. Each bank has a code (as the team says it: FAB), a name, a colour for its mark, an order, up to five package inboxes, and a switch; a bank is never deleted, because its submissions point at it. It starts empty in production. **The package is a page, not attachments:** one link per bank and file, only its hash stored, working for `link_expiry_days` (7, the applicant links' setting); behind it a summary (name, date of birth, residency, employment, the recorded salary, employer and start date, the maximum LTV) and the accepted documents, each a logged download. Opening the page and every download are written to the activity log as the bank before anything is shown; a withdrawn link shows nothing, an expired one says so. A reminder issues a fresh link (the old token was never stored), at most one per ten minutes. **Bank labels:** a one-word name as itself (Mashreq), a longer one by its code (FAB), as the designs name them |
| CMS-2 (banks) | **Choosing banks:** C2's "Accept application" opens a dialog listing every bank, the ones that can take a package ticked (active, with an inbox), the others greyed with why, and "Send to {count} banks"; the Head is offered "Add partner banks" when there are none. The file then shows "Open decision". **Record response:** a dialog per bank — "Record response" on a waiting row, "Edit" once it has answered: Pre-approved or Declined; for an offer, up to (AED), the rate, fixed (for how many years) or variable, valid until, and the bank's letter (a PDF of at most 10 MB, no password, checked and scanned like the applicant's files, and required for an offer); notes for the team. A new letter replaces the old. **Reminder:** "Send a reminder" emails the bank a fresh link; the row then reads "Reminder sent {time}". **Lead offer:** the largest valid offer with a checked letter leads until the adviser picks another; an expired offer, or one whose letter is still being checked, can't lead and says why under its name. **Tiles:** a fact that no longer holds (consent withdrawn) turns red and says so. **Confirm:** banks still deciding are withdrawn (their links stop working), which the note under the button says. It returns to C2, decided; C5 then reads as sent, with nothing to change. **Decline tab:** C2's decline form, with "No bank made an offer" among the reasons |
| CMS-6 (pre-approval) | **The message starts from the design's sample:** "Good news, {firstName}: you're pre-approved.", the lead bank by its full name with its amount, rate, term and validity, each other valid offer as "{bank} has also pre-approved you for up to {amount}.", then a close that counts the offers ("talk it through" for one, "both" for two, "them all" for more) and the adviser's first name. It follows the lead offer until the adviser types, and keeps their words after. **The email** (`mortgage_decision_pre_approved`): the decline's subject word for word ("An update on your Fast Pre-Approval application — {reference}"), so good and bad news look the same on a lock screen; the message quoted; "Your pre-approval letter from {bank} is attached." with the lead bank's letter read from the private bucket as it's sent; replies to whoever decided |
| — | **The banks' emails** (`mortgage_bank_package`, `mortgage_bank_reminder`): "Hello to the team at {bank}," (it still reads with no name); who shared the file, what it holds ("a structured summary and 4 documents"), "Open the package", until when the link works, and that every open and download is recorded; replies to the adviser. The reminder adds "We'd be grateful for your response." They carry no applicant details. The gallery lists them under "To leads and clients": it has no group for banks |

**Defaults built in Phase 7 (30 Sep), for compliance and Bazar to confirm or
replace.** The security review they answer is
[SECURITY-REVIEW.md](SECURITY-REVIEW.md).

| ID | What was built |
|---|---|
| D7 (retention) | **Files only, as SPEC §5 says:** a daily job deletes a closed request's files — the applicant's documents and the banks' letters — `retention_months` after it closed, bucket objects first, and keeps each row as `removed` with no name, so the file still shows what it held. The request, its recorded figures and its activity stay. **Off until set:** `retention_months` is null, and the job then deletes nothing and says so on the health page. The settings page shows the period, read-only: it's set by an engineer once compliance decides (the runbook says how), because a wrong number deletes at the next run |
| D7 (erasure) | **An erasure deletes mortgage requests outright** (SPEC §8), documents included — unlike the platform's own tables, which keep AML-relevant rows with their personal fields wiped. If compliance decides the AML record rule covers these files, erasure has to keep them instead until the period ends (a change in `fulfilErasureRequest`). What a partner bank was sent can't be recalled, so the result names those banks, and the admin's reply should say so |
| — (DSR) | **Found by email, and by a UAE mobile when the admin enters one** (the console's new optional field), because an applicant may have applied with another address. The archive lists each request's details, consents (with the IP and browser they were given from), documents with their files' names and sizes — not the files — the banks it went to and their offers, the decision, consultations, the contact log and re-upload requests; staff aren't named. Each export is written to its request's activity (`dsr.exported`). **Not built as IMPLEMENTATION §1.15 planned:** `anonymise_by_email` is untouched; the action erases the mortgage requests first, from app code, because SQL can't delete a storage object and the objects must go before the rows that point to them |
| — (the promise) | **The met rate** (PLAN Phase 7): the Head's settings page shows, for the last 30 days, how many Fast Pre-Approvals were decided within 24 working hours, the median working time to a decision, and how many missed. From `slaStatus()`, like every other clock figure |
| — (consent withdrawal) | **Recorded from C2** (SR-17): "Record a withdrawal" on the Consent card, by the owner or the Head, on a decided file too; it can't be undone (a new consent would be a new application). **What it does** (SR-22): the banks still deciding are withdrawn and every package link on the file stops at once, whatever the bank answered; reminders are refused, and the package page shows nothing without a standing consent. The file itself stays where it is: its end state is D20's. Not designed; its copy is pending |
| — (send results) | **Said as they happened** (SR-25): a bank counts as reached only when every one of its inboxes was, and a send skipped because email is off reads as a warning, not "Sent" |
| — (analytics) | **The W1-to-submit funnels** are written down as code (`APPLY_FUNNELS` in `L/client/analytics.ts`), one for each service, each step an existing event; a test holds every event's properties to no personal data. Building the funnel in PostHog is a dashboard step, in the runbook |

## D. Go-aheads only Ayush can give

| ID | What | Needed by | Status |
|---|---|---|---|
| G1 | Edit the protected `components/brand/cms-shell.tsx`: the "Mortgage requests" nav item, its count badge, and hiding it from staff without a mortgage role | Phase 4 · 8 Oct | **Granted 28 Sep (Phase 4).** The item is added from the session (`AdminSession.mortgage`), so the shell's static nav is unchanged for everyone else |
| G2 | Reconnect the Supabase connector (`supabase-hub` rejects its token with a 401; `supabase` needs authorising). Needed to count `mortgage_inquiries` rows (D26), check the leftover `documents` bucket, and dump the production schema if a fresh local migrate fails | Phase 1 · 29 Sep | Open for the connector. `0138`–`0152` were applied on 30 Sep through the Management API with the project's access token instead |
| G3 | Edit the protected `lib/env.ts` for the new variables: Turnstile, WhatsApp, the scanner, and S3 if D4 needs it | Phase 2 · 1 Oct | **Granted 28 Sep for the whole epic** (additive entries only). Phase 2 added the Turnstile and scanner variables |

---

## Appendix — draft WhatsApp templates (D1, D29)

**Not designed.** These are drafts so Bazar can submit to Meta without waiting
for the build. Bazar approves the wording first. Keep them transactional: Meta
can reclassify a utility template as marketing if it reads as promotional.
Buttons use a dynamic URL suffix for the secure link; Meta numbers a button's
variables separately from the body's, so both start at `{{1}}`. English first;
Arabic versions are separate templates, submitted when D12 is settled.

| Name | Category | Body | Button |
|---|---|---|---|
| `bazar_mortgage_code` | Authentication | Meta's fixed authentication body ("{{1}} is your verification code."), with its security note and "This code expires in 10 minutes." | Copy code |
| `bazar_mortgage_reupload` | Utility | Hello {{1}}, your mortgage adviser {{2}} has asked for one more document for application {{3}}. Please upload it with your secure link. Your application is on hold until it arrives. | URL: "Upload document" → `https://www.bazarrealestate.ae/mortgages/r/{{1}}` |
| `bazar_mortgage_invite` | Utility | Hello {{1}}, as discussed with {{2}}, here is your secure link to apply for Fast Pre-Approval with Bazar. Your details carry over, so you'll only need to upload your documents. | URL: "Start application" → `https://www.bazarrealestate.ae/mortgages/r/{{1}}` |
| `bazar_mortgage_consultation` | Utility | Hello {{1}}, your mortgage consultation with {{2}} is booked for {{3}} ({{4}}). We've emailed you a calendar invite. | — |
| `bazar_mortgage_preapproved` | Utility | Good news, {{1}}: your mortgage pre-approval for application {{2}} is ready. We've emailed you the details and the bank's letter. | — |
| `bazar_mortgage_update` | Utility | Hello {{1}}, there's an update on your mortgage application {{2}}. We've emailed you the details. Reply here or call +971 2 632 2223 with any questions. | — |

The free-text messages staff write in C4 and C5 go out as `bazar_mortgage_reupload`
or `bazar_mortgage_update`, with the full text in the email and on W8. Free
text is sent directly only when the applicant has messaged within the last 24
hours (SPEC §6).
