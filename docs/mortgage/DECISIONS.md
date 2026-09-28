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
| D3 | **Partner banks.** The list (FAB, ADCB, Mashreq?); package recipients per bank; whether they accept an expiring download link rather than attachments or their own portal; how long the link lives; any bank forms the applicant must sign; referral agreements; permission to show logos | Head of mortgages | Phase 6 · 19 Oct | Confirm the link approach with at least one bank before Phase 6 | SPEC §9 #4 | Open |
| D4 | **Where applicant data lives.** Supabase and the functions run in Tokyo (ap-northeast-1 / hnd1), so Emirates IDs and bank statements would be stored in Japan. Does financial PII have to stay in the UAE, for the documents only or for the database rows too? | Bazar + compliance, with engineering | Phase 2 · 1 Oct | Ask compliance this week. If documents must stay in the UAE, use AWS S3 in `me-central-1` (IMPLEMENTATION §1.7); otherwise a private Supabase bucket | SPEC §9 #1 | Open |
| D5 | **How applicants get their code** (W8 and the invite link). WhatsApp authentication template (needs D1), SMS (UAE sender-ID registration through a provider, weeks), or email as a fallback. Codes are email-only in the repo today | Bazar | Phase 5 · 13 Oct | WhatsApp, falling back to email. Email only at launch if D1 slips; W8's "code sent to {maskedMobile}" then needs a variant | SPEC §6, §8 | Open |
| D6 | **Malware scanner.** Follows D4: GuardDuty Malware Protection (with S3; check it's offered in `me-central-1`), a ClamAV container in the same region, or a paid scanning API (sends files abroad). Never VirusTotal, which shares uploads | Ayush, with Bazar for cost | Phase 2 · 1 Oct | Decide together with D4 | SPEC §8 | Open |
| D7 | **Retention and link expiry.** How long files and requests are kept after closure; secure-link lifetime (proposed 7 days); whether the UAE AML 5-year record rule for brokers applies to these documents | Compliance | Links: Phase 5 · 13 Oct. Retention: Phase 7 · 22 Oct | — | SPEC §9 #11 | Open |
| D17 | **Security copy sign-off.** "Encrypted in transit and at rest. Only Bazar's mortgage team can open them, and every view is recorded." Each clause needs its control built and checked (SPEC §8) | Ayush | Launch | Sign off in Phase 7 against SECURITY-REVIEW.md | SPEC §9 #3 · FE-11 | Open |

## B. Product decisions for Bazar

| ID | Decision | Owner | Needed by | Recommendation | Source | Status |
|---|---|---|---|---|---|---|
| D8 | **Staging.** There is no non-production database. The mortgage seed, admin e2e, real email/WhatsApp tests and UAT need one | Ayush + Bazar (monthly cost) | Phase 3 · 5 Oct (a local Supabase stack covers Phases 1–2) | A second Supabase project, with Vercel Preview pointed at it | IMPLEMENTATION §1.14 | Open |
| D9 | **How mortgage roles are modelled.** New `staff_role` values (SPEC) or a separate `staff.mortgage_role` column (head, adviser) | Ayush | Phase 1 · 29 Sep | The column. Staff have one role each today, and permissions only know "any staff" and "admin"; the column lets an admin also be Head of mortgages without touching every role list | SPEC §3 · IMPLEMENTATION §2.2 | Proposed |
| D10 | **Admins without a mortgage role can't open anything** in the module (SPEC §7, because the website promises only the mortgage team can). Also: how break-glass access works and who reviews it | Bazar | Phase 1 · 29 Sep | Keep SPEC's rule; break-glass means temporarily granting a mortgage role, which is itself logged | SPEC §7 · CMS-1 | Open |
| D11 | **The 24-hour promise: wall-clock or working hours?** Designed as wall-clock, nights and weekends included, and W7 shows the exact time. A Friday 18:00 submission would be due Saturday 18:00 | Bazar | Phase 1 · 29 Sep (changes `sla.ts`) | Keep wall-clock only if weekend cover is staffed; otherwise switch to working hours before launch and adjust W7's copy | SPEC §2.5, §9 #5 | Open |
| D12 | **Arabic.** SPEC says English only for v1, but CI requires every public string to have Arabic in the catalogue (G-8) | Bazar | Phase 3 · 5 Oct | Ship the machine-drafted Arabic catalogue (ADR-0008) and serve English only until Bazar approves it. Keep the consent's Arabic off any live page until a person approves it | SPEC §1 · IMPLEMENTATION §1.11 | Proposed |
| D13 | **Enquiries and Salesforce.** Should a mortgage request also appear in Enquiries or go to Salesforce `Lead__c`? | Bazar | Phase 3 · 5 Oct | At most a minimal lead (name, mobile, reference); no financials or documents ever leave. Salesforce's `Inquiry_Type__c` only accepts Buy, Sell or Rent, so Levarus would add a value | SPEC §9 #14 | Open |
| D14 | **New accounts.** Upstash (rate limits; also switches on the limits every existing form already has in code) and Cloudflare Turnstile (bot check). Both have free tiers, and the client takes them over at handover | Ayush + Bazar | Phase 2 · 1 Oct | Open both | SPEC §4.2, §8 | Open |
| D15 | **Consultations.** Formats offered (phone, video, office); where video-call links come from (per-adviser link?); the "before 12:00, as Ahmed asked" slot filter; who sets advisers' working hours, and where | Head of mortgages | Phase 4 · 8 Oct | A per-adviser video link and weekly hours on a mortgage settings page | CMS-7 · IMPLEMENTATION §1.2 | Open |
| D16 | **The team.** Are Yasmin Abdalla, Rashid Khan and Leena Varghese real staff? Who gets which mortgage role? W8 shows "Mortgage adviser" for Yasmin, while the CMS says "Head of mortgages" | Bazar | Phase 4 · 8 Oct (UAT) | Take the label from the staff record | FE-7 | Open |
| D18 | **Assignment.** Round-robin across active advisers on submit, or advisers claim from the queue? | Head of mortgages | Phase 4 · 8 Oct | Build both behind the setting SPEC asks for; default to round-robin | SPEC §2.7, §9 #6 · CMS-10 | Open |
| D19 | **Decline.** Reasons, message template, and whether a file can be declined before it goes to banks | Head of mortgages | Phase 6 · 19 Oct | — | SPEC §9 #8 | Open |
| D20 | **Unreachable or withdrawn requests.** What end state they get | Head of mortgages | Phase 4 · 8 Oct | — | SPEC §9 #9 | Open |
| D21 | **Review checks** for Emirates ID, passport, trade licence and 3-month statements (only the salary certificate and 12-month statements are designed). Should the salary certificate's three recorded fields be required before Accept? | Head of mortgages | Phase 5 · 13 Oct | SPEC's proposed checks; the fields required, since C5 prices on them | SPEC §2.3, §9 #7 · CMS-3 | Open |
| D22 | **Minimum age and date-of-birth rules** | Head of mortgages | Phase 3 · 5 Oct | — | SPEC §9 #13 | Open |
| D23 | **Loan-to-value figures.** W2 and C2 say UAE National up to 85%, expat up to 80% (the Central Bank caps for a first home under AED 5M). The calculator's defaults compute 75% for residents under AED 5M. The property FAQ says 80% and 60% | Bazar | Phase 3 · 5 Oct | One source: fill `{ltv}` from mortgage settings, defaulting to the design's values, and align the calculator and the FAQ | Phase 0 finding | Open |
| D24 | **Non-residents.** W2 only offers UAE National or UAE Resident/Expat and only accepts UAE mobiles; the calculator supports non-residents | Bazar | Phase 3 · 5 Oct | Intentional? If so, say so on the calculator's pre-approval buttons | Phase 0 finding | Open |
| D25 | **The calculator's old pre-approval form.** `mortgage_preapproval` files an enquiry today; the fallback link `/contact?source=mortgage` ignores its parameter | Bazar | Phase 3 · 5 Oct | Retire it when the flag goes public; the calculator's buttons point at the new flow | Phase 0 finding | Open |
| D26 | **The unused `mortgage_inquiries` table** (and its three enums) | Ayush (needs G2) | Phase 1 · 29 Sep | Count production rows; leave it if any exist | Phase 0 finding | Open |
| D27 | **Are the permit number and phone numbers real?** "ADREC permit MB-2026-01184", +971 2 632 2223, WhatsApp +971 50 691 1103. Where does the permit line go on small screens? | Bazar | Phase 3 · 5 Oct | Keep the permit line visible on mobile, under the top bar | FE-10 · FE-12 | Open |
| D28 | **"licence" or "license"** (the designs use both) | Design | Phase 3 · 5 Oct | "licence" (UAE English) everywhere | SPEC §9 #12 · FE-8 · CMS-16 | Open |
| D29 | **Copy for every email and WhatsApp message.** SPEC §6 only summarises them: 8 to applicants, 4 to the team, 2 to banks, plus the WhatsApp templates. The default decision message isn't specified | Design + Bazar | Confirmations: Phase 3 · 5 Oct. The rest: Phases 4–6 | — | SPEC §6 · CMS-6 | Open |

## C. Design gaps from the handoffs

Each screen README lists the gaps that affect it. When the build meets one
before it is designed, it uses a clearly marked TODO string or a stub and lists
it in PROGRESS.md, as the handoff prompts ask.

**Website (Phase 3 unless noted)**

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
| CMS-2 | Choosing banks after "Accept application"; recording a bank response; the Decline mode; the partner banks page | 6 |
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

## D. Go-aheads only Ayush can give

| ID | What | Needed by | Status |
|---|---|---|---|
| G1 | Edit the protected `components/brand/cms-shell.tsx`: the "Mortgage requests" nav item, its count badge, and hiding it from staff without a mortgage role | Phase 4 · 8 Oct | Open |
| G2 | Reconnect the Supabase connector (`supabase-hub` rejects its token with a 401; `supabase` needs authorising). Needed to count `mortgage_inquiries` rows (D26), check the leftover `documents` bucket, and dump the production schema if a fresh local migrate fails | Phase 1 · 29 Sep | Open |
| G3 | Edit the protected `lib/env.ts` for the new variables: Turnstile, WhatsApp, the scanner, and S3 if D4 needs it | Phase 2 · 1 Oct | Open |

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
