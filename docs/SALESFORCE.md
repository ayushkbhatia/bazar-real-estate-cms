# Salesforce integration

Two directions, one Connected App, one integration user.

| Direction | What it does | Status |
|---|---|---|
| **Leads out** — website → Salesforce | Every public enquiry becomes a `Lead__c` record | **Built** (Phases 1, 2, 2.5) |
| **Listings in** — Salesforce → website | Every listing the CRM marks Published for the website becomes a listing here | **Built** (Phase 3) — see [Listings](#listings--salesforce-to-website) |
| **Areas out** — website → Salesforce | Every area added or renamed on the website reaches the `Area__c` / `Sub_Area__c` picklists; a delete is recorded, not sent (the API has none) | **Built** (0169) — see [Areas](#areas--website-to-salesforce) |

Vendor documents: *Lead Creation API* (18 Sept 2026), *Web to Lead Creation*
(23 Sept), the production edition of the same (24 Sept), its **v1.1 (1 Oct)**
— adds `Preferred_Languages__c` and `Website_Listing_URL__c`, removes
`Property_Reference__c` — and *Published
Listings — API Integration Guide* — v1.2 (25 Sept) and **v1.3 (5 Oct)**, a
production and a sandbox edition with the same field list. The listings guide
uses the **same Connected App** as the lead documents, so both directions
share `SALESFORCE_INSTANCE_URL` / `SALESFORCE_CLIENT_ID` /
`SALESFORCE_CLIENT_SECRET` and there is nothing new to configure.

Production, as of 7 Oct: **leads are live** (since 25 Sept). **Listings are
connected** — the production sweep has run every fifteen minutes since 1 Oct
— and nothing has been published yet: the only listings the CRM had published
were sandbox test records, which Levarus deleted on 5 Oct. See
[Production status](#production-status).

Setup, env vars and triage queries: [INTEGRATIONS.md](INTEGRATIONS.md#salesforce).

## Phase 1 — leads out

An enquiry is written to Postgres, and Salesforce is told afterwards by
`/api/cron/salesforce-lead-sync`. Never the other way round: a lead is the
one thing on this site that must not be lost, and calling a third party
inside the submit action would put their uptime in front of the visitor's
confirmation screen.

The queue is `enquiries.crm_sync_state`, which defaults to `pending`
(migration 0130). That is the whole enqueue mechanism — every insert path
enrols itself, and a form added next year cannot forget to.

### Field mapping

`Lead__c` is a **custom** object, not the standard `Lead`. Ten fields, all
custom, all documented in the vendor doc (v1.1) and nothing beyond them.

| Salesforce | Source | Notes |
|---|---|---|
| `Name__c` | `enquiries.name` | Truncated at 255. |
| `Email__c` | `enquiries.email` | Omitted when absent. |
| `Country_Code__c` | split from `enquiries.phone` | `"+971"`. See `lib/salesforce/phone.ts`. |
| `Phone__c` | split from `enquiries.phone` | National part, trunk zero stripped. |
| `Lead_Source__c` | enquiry `source` | `Website`, or `Others` for WhatsApp. Required. |
| `Inquiry_Type__c` | intent → listing mode → source | `Buy` / `Sell` / `Rent` / `Other`. Required. |
| `External_ID__c` | `enquiries.id` | In the upsert URL, not the body. |
| `Website_Listing_URL__c` | the page the lead came from, absolute | Every lead whose page is known: the listing for a listing enquiry (the page it was sent from, else its canonical `/p/<slug>-<reference>` — slugs alone repeat), the project for a project enquiry (else `/developments/<slug>`), otherwise the page the form sat on (`/buy`, `/tools/valuation`). Levarus's website lead assignment reads it (19 Oct 2026). Replaced `Property_Reference__c`, removed on 13 Oct 2026; the reference itself is in the description (`Property: …`). |
| `Preferred_Languages__c` | `enquiries.locale` | Restricted picklist: `Arabic`, `Arabic & English`, `English` (added 22 Oct 2026). An `/ar` lead sends `Arabic`, an English-site lead `English`; `Arabic & English` is never claimed (`PREFERRED_LANGUAGE` in `leads.ts`). Leads synced before 22 Oct went without it on the English side. |
| `Description__c` | `enquiries.brief_raw` + metadata | See below. |

**On the two picklists.** Both are Required as of 23 Sept, which inverts the
rule this mapper was first written under: an unmappable value can no longer be
omitted and left for an advisor to fix, because omitting it fails the whole
record with `REQUIRED_FIELD_MISSING`. Every branch now terminates in a real
value.

`Inquiry_Type__c` resolves in precedence order — the visitor's declared
intent (`inferred_constraints.intent`), then the listing's mode, then the form
it came from, then a stated fallback of `Buy`. Intent outranks the listing
deliberately: someone on a for-sale page who ticked "rent" means it. `off_plan`
is a purchase. `commercial` is left unmapped because our `property_mode`
conflates for-sale and for-lease, so intent or source decides instead of a
coin flip. Valuation and `/services/sell` leads now carry `Sell`, which they
could not before the value set was published.

The fallback is `Other`, added by Levarus on 19 Oct 2026 at Bazar's request.
A property-management enquiry (intent `manage`) is the opposite of Buy, Sell
and Rent — the person already owns the property — and a general "tell me
about your services" lead is none of them. Until that day both were filed as
`Buy`.

`Lead_Source__c` has entries for `Facebook`, `Property Finder` and `Bayut`,
all channels Bazar uses. None is mapped yet, deliberately: no lead in the
database has ever arrived through those paths, the Meta Lead Ads importer is
on an unmerged branch with an empty `meta_leads` table in production, and
writing an untested branch against a schema that may still change is worse
than leaving it. WhatsApp maps to `Others` because the picklist has no word
for it, which is more honest than claiming the website.

### Intake matches the CRM contract

`Email__c`, `Phone__c` and `Country_Code__c` are all Required. This site asked
for email **or** phone for as long as it had a contact form, so a share of
leads arrived with no number and would have been refused outright.

Intake now asks for both, in three places that have to agree:

| Layer | What changed |
|---|---|
| `lib/forms/fields.ts` | `email()`, `phone()`, `dialPhone()` default to `required` **and** `locked` |
| `lib/schemas/enquiry.ts` | both fields required; the either-or `.refine` is gone |
| `lib/schemas/valuation.ts` | `owner_phone` required, since a valuation is an enquiry too |

`locked` matters as much as `required`. A form whose phone box an editor had
merely unticked would produce leads the CRM rejects; one whose box they had
deleted would do it just as thoroughly and less visibly. Locked fields can
still be relabelled and reworded — the editor keeps the wording, not the
existence — and `resolveForm` re-attaches a locked field that storage
dropped, so a form that lost its phone box gets it back.

`buildFormSchema` forces both fields for any `enquiry` handler rather than
reading the stored `required` flags. Three forms in production still carried
`required: false` on a contact box; honouring that would have let the page
accept a submission `enquirySchema` then rejects, and the visitor would see a
generic failure on a form that looked complete. Those four rows were flipped
in the database at the same time, so the UI agrees, but the guarantee does
not depend on them.

`missingRequiredFields` checks only `Email__c` since 13 Oct 2026. A lead
whose phone cannot be split into a picklist code and a number (or that came
by a route with no phone) is now sent anyway, by Bazar's decision, and
Salesforce answers for itself — so the day Levarus relax `Phone__c` those
leads arrive with no change here. The two leads that had been blocked were
not missing a phone: one was test text, and one was a visitor who typed
Arabic-Indic digits (`+٩٧١…`), which `splitPhone` now reads as digits.

**`Property_Reference__c` was removed from `Lead__c` in production on
13 Oct 2026**, at Omar's request, and replaced with a website listing URL
field. Until the sync caught up every property enquiry answered
`INVALID_FIELD: No such column`. The sync now sends `Website_Listing_URL__c`
instead — confirmed by the v1.1 doc and a describe of the object — and
resends a lead once without an optional field the org refuses, so a missing,
read-only or rejected optional field costs a call, not the lead.

**Optional fields** (`OPTIONAL_LEAD_FIELDS`): `Website_Listing_URL__c`,
`Preferred_Languages__c`, `Mortgage_Service__c`. Dropped and resent on
`INVALID_FIELD` (no such column, or hidden from the integration user),
`INVALID_FIELD_FOR_INSERT_UPDATE` (visible but read-only) and
`INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST` naming the field. The middle one was
missing until 19 Oct 2026: `Mortgage_Service__c` arrived read-only to the
integration user, and every mortgage lead failed outright on it (BZM-26-0002,
15 Oct). A required field is never dropped. The description always carries `Property: <reference>`.

The description also carries, since the same day, `Page:` — the absolute
URL of the page the form was sent from (`form_submissions.source_path`) — and
`Project:` for an enquiry about a project (`enquiries.development_id`).

**The trade was accepted deliberately.** Some visitors will not give a number
and will not submit. The alternative is capturing leads the sales team never
sees.

Two things this does not fix. Validation messages are English-only across
every schema in the repo, so an Arabic visitor who omits a phone reads an
English error — a pre-existing gap, now more visible. And asking Levarus to
make `Phone__c` and `Country_Code__c` optional (question 13) is still worth
doing: it would let the site choose its own intake rules rather than inherit
the CRM's.

### Delivery is exactly-once

`External_ID__c` (Text(254), External ID, Unique) exists as of 23 Sept, so the
push `PATCH`es `sobjects/Lead__c/External_ID__c/<enquiry uuid>`. A retry after
a network timeout matches the existing record and updates it; there is no
window in which a duplicate lead can be created.

The field name is **defaulted**, not env-gated. A blank env var would silently
fall back to `POST` — at-least-once delivery, duplicates on every retry — and
nothing would say so. Defaulting inverts that: an org genuinely lacking the
field fails loudly with `INVALID_FIELD` on the first lead, and the reason
lands in `crm_last_error`. `SALESFORCE_LEAD_EXTERNAL_ID_FIELD` remains for an
org that renamed it.

Two success shapes, both handled: `201` with `created: true` for a new record,
`200` with `created: false` for an update.

### Mortgage requests (0160, 14 Oct 2026)

Every mortgage request — Fast Pre-Approval or Mortgage Consultancy — goes to
the same `Lead__c` object, through the same cron and the same upsert, on its
own queue columns (`mortgage_requests.crm_*`, defaulting to `pending`). The
request's uuid is the External ID. `lib/salesforce/mortgage-leads.ts` maps it:

| Lead__c | From the request |
|---|---|
| `Name__c`, `Email__c` | `full_name`, `email` |
| `Country_Code__c`, `Phone__c` | `mobile_e164`, split as an enquiry's phone is |
| `Lead_Source__c` | `Website` |
| `Inquiry_Type__c` | `Buy` (financing a purchase) |
| `Mortgage_Service__c` | `Fast Pre-Approval (24-hour)` or `Mortgage Consultancy` — a restricted picklist of exactly those two, on the object since 19 Oct 2026 but **read-only to the integration user** until Levarus grant edit; dropped and resent without meanwhile |
| `Preferred_Languages__c` | `locale`, as an enquiry's |
| `Website_Listing_URL__c` | the listing page, when the applicant started from one |
| `Description__c` | first line `Mortgage request: <service>`, then reference, residency, employment, where they started, the listing and parent consultation if any, a link to the file in /admin/mortgages, and the request id |

Nothing from the file goes: no document, upload, consent or date of birth.
The walkthrough samples (applicants at `@example.com`) are skipped, never sent.
The lead is created once, at submission; later stage changes stay on the
website.

Erasure: a mortgage request is deleted outright by a DSR or retention, so a
`before delete` trigger queues its Salesforce record id in
`salesforce_lead_erasures`, and the cron pseudonymises that record as it does an
erased enquiry's (Phase 2) before deleting the queue row.

**Ask of Levarus:** ~~a field `Mortgage_Service__c`~~ created 19 Oct 2026;
still to do, **edit access to it for the integration user's profile or
permission set**. Until then the service is the description's first line.

## Phase 2 — erasure reaches the CRM

The privacy notice names Salesforce as a processor and tells the public their
enquiry data is held there. Phase 1 made that true. Phase 2 makes the
*converse* true: a PDPL erasure request now scrubs both copies, not just the
one in Postgres.

**Pseudonymise, not delete.** `Name__c` takes the pseudonym, `Email__c`,
`Phone__c` and `Country_Code__c` are set to `null`, and `Description__c` is
replaced with the same redaction notice `anonymise_by_email` writes into
`messages.body`. `Lead_Source__c`, `Inquiry_Type__c` and
`Property_Reference__c` survive — "a website lead about BAZ-AD-04891 wanting
to buy" identifies nobody, and is the commercial fact the 7-year AML
retention basis exists to preserve. This mirrors migration 0067 deliberately:
doing something different in the CRM than in the database would mean the
retention basis either holds for both or for neither.

**Required fields complicate it.** The erasure PATCH nulls `Email__c`,
`Phone__c` and `Country_Code__c`, which 23 Sept marks Required. The doc calls
that "the API contract for the website integration", which may or may not mean
the fields carry Salesforce's field-level Required flag — and that flag
rejects an update that nulls them, which would stop erasure reaching the CRM
entirely. We cannot read the org's field metadata to find out. So a
`REQUIRED_FIELD_MISSING` on the scrub retries once with non-identifying
constants (`redacted@bazar.invalid`, `0000000000`, `+0`) instead of nulls.
`.invalid` is reserved by RFC 2606 and can never resolve, so the address
cannot be mailed even by accident. Erasure requires removing the personal
data, not specifically writing NULL — and this is the same substitution
already made for `Name__c` and `Description__c`.

**The pseudonym is read back, not regenerated.** 0067 builds `deleted-<hex>`
in Postgres; the CRM scrub reuses that exact value, so an auditor can line the
Salesforce record up against the database row. A second, independent
pseudonym would make them impossible to reconcile.

**Ordering matters and is not obvious.** `anonymise_by_email` sets
`enquiries.email = null`, so a moment after it runs there is no way left to
ask which CRM records belonged to that address. The admin action therefore
marks `crm_erasure_due_at` *before* it scrubs. In the same pass, any enquiry
still `pending` or `failed` moves to `skipped` — pushing a lead to the CRM
after the subject asked to be forgotten would be the worst available
ordering. Rows already `synced` keep that state, because the erasure pass
needs `crm_external_id`.

**It never blocks the request.** The Postgres scrub carries the legal
deadline. The CRM call runs inline so the staff member sees both outcomes on
one screen, but a failure leaves `crm_erasure_due_at` set and the sync cron
retries it — erasures run before pushes in that job, because one has a
deadline and the other does not. The admin result says plainly when a record
is still outstanding rather than reporting a clean "done".

Outstanding obligations are one query:

```sql
select id, crm_external_id, crm_erasure_due_at
from enquiries
where crm_erasure_due_at is not null
order by crm_erasure_due_at;
```

A non-empty result older than a few minutes means an erasure has not
completed in the CRM. A permanent failure also raises a Sentry error.

**Leads Salesforce filed as Re-Inquiries are not erased by this.** Levarus's
duplicate rule (19 Oct 2026) takes a lead whose email matches an earlier
inquiry (same email, same project) out of `Lead__c`: our upsert creates the
record, their trigger copies it into a Re-Inquiry under the parent inquiry
and deletes it about two seconds later. The integration user cannot see the
Re-Inquiries object, so the personal data is out of reach. First seen with
BZM-26-0002 → `LD-000074` (deleted), parent `LD-000032`; on 19 Oct it was the
only one of the site's 18 synced records in that state.

A gone record used to count as erased. Now `scrubLead` reads its
recycle-bin copy (`findReInquiry`, through `queryAll`): deleted within two
minutes of creation means the trigger took it, and the result carries
`reInquiry` with the parent's name, found by the same address with
re-enquiries or by the re-enquiry timestamp. The drain then retires the
marker (no retry can reach it), writes the reason to `crm_last_error`,
reports "Salesforce erasure incomplete: the lead became a Re-Inquiry" to
`/admin/settings/health` with record ids only, and the DSR screen tells the
staff member to ask Levarus — so the reply to the subject does not claim it
was erased. If the lookup itself fails the erasure stays outstanding.

Two limits. The recycle bin keeps a deleted record for fifteen days; past
that, a Re-Inquiry and a lead someone deleted by hand look the same, and the
erasure counts as done. And the parent is scrubbed only if it is one of
this site's own leads with the same address, which the same erasure pass
covers; a parent from another channel is the sales team's. The fix for both
is on Levarus's side (ask 18).

**Access requests** disclose the CRM copy too: when a subject's enquiry
actually reached Salesforce, the export archive carries a note naming it as a
recipient. Derived from `crm_external_id` being present rather than asserted
because the integration exists — naming a processor that received nothing
would be its own inaccuracy.

## What the object actually looks like

Verified 24 Sept against the sandbox with a `describe` call, after the
production credentials arrived. **Every number below contradicts something we
had been assuming from the documents**, which is the argument for doing this
before wiring anything up.

| Field | Type | Length | Nillable | Notes |
|---|---|---|---|---|
| `Name__c` | string | 255 | no | as assumed |
| `Email__c` | email | **80** | no | we assumed 255 |
| `Phone__c` | phone | **40** | no | we assumed 255 |
| `Country_Code__c` | **picklist** | — | no | 206 values at first; `+7` added 25 Sept (207) |
| `Lead_Source__c` | picklist | — | no | the nine documented values |
| `Inquiry_Type__c` | picklist | — | no | Buy / Sell / Rent |
| `Property_Reference__c` | string | 255 | yes | |
| `Description__c` | textarea | 131072 | yes | we truncated at 32000 |
| `External_ID__c` | string | 254 | yes | External ID, Unique |

No undocumented required field exists, so the documented set is sufficient.

**`Country_Code__c` is a restricted picklist.** Neither document said so. A
code outside its values fails the whole record, so a code the list does not
hold is refused locally with a reason rather than sent. `+7` — Russia and
Kazakhstan — was missing from the first 206 values although every neighbour
was present; Levarus added it on 25 Sept in both orgs, and it is in
`SALESFORCE_COUNTRY_CODES` since.

**The integration user cannot delete.** `DELETE` returns
`INSUFFICIENT_ACCESS_OR_READONLY`, which is correct — an integration should
not be able to remove leads — and it retrospectively justifies choosing
pseudonymisation over deletion for erasure, since deletion was never
available.

### Both round trips, proven

*Upsert is exactly-once.* Two PATCHes to the same `External_ID__c`:

```
1st PATCH → HTTP 201  created=true   id=a04iy0000000crhAAA
2nd PATCH → HTTP 200  created=false  id=a04iy0000000crhAAA
records with this External_ID__c: 1
```

*Erasure needs its fallback.* The null-first attempt is refused exactly as the
defensive path anticipated, and the substitute succeeds:

```
nulling PATCH   → HTTP 400  REQUIRED_FIELD_MISSING: [Email__c, Phone__c]
fallback PATCH  → HTTP 204
```

Leaving the record pseudonymised with its commercial facts intact —
`Name__c: deleted-…`, `Email__c: redacted@bazar.invalid`, `Phone__c:
0000000000`, `Inquiry_Type__c` and `Property_Reference__c` untouched.

## Listings — Salesforce to website

`/api/cron/salesforce-listing-sync`, every fifteen minutes. The code is in
`lib/salesforce/listings/`; the admin screen is **/admin/properties/salesforce**
(linked from the Properties header and the Salesforce integration card).

### The contract: guide v1.3

v1.3 of the guide (5 Oct 2026) is Salesforce's answer to Bazar's v1.1
requirements — every fact the listing page shows has a Salesforce field, in
values the website recognises — and `fields.ts` reads exactly its step-2
field list, plus `Id`, `LastModifiedDate` and the `Agent_Name__c` lookup
itself. What v1.3 settled, and the sync now follows:

- **Placement is `Area__c` / `Sub_Area__c`**: restricted picklists holding the
  website's own area names (v1.1 Appendix A), `Sub_Area__c` dependent on
  `Area__c`, `Area__c` dependent on `Emirate__c`. `Community__c` and
  `Sub_Community__c` stay in Salesforce for the portals and are **not** read;
  `Location__c` is read for the admin screen only.
- **The advisor is the Property's Assigned Agent** (`Agent_Name__c`) only.
  The listing's own `Assigned_Agent__c` is not read.
- **The write-back URL field is `Website_Listing_URL__c`** — v1.2 called it
  `Website_URL__c`.
- **New property fields**: `PropertyText__c`, `Short_Description__c` (+
  Arabic), `Tenure__c`, `Year_Built__c`, `Handover_Date__c`, `View__c` /
  `Orientation__c` with formula Arabic twins, `Service_Charge_Sqft__c`,
  `Website_Amenities__c`, `Exclusive__c`, `Vacant_On_Transfer__c`,
  `Project__c` + `Project__r.Name`; on the listing, `Published_Platform__c`.
- `Property_Type__c` is restricted and includes Hotel Apartment and Commercial
  Villa; `Rent_Frequency__c` is required for a website rental.

The fallbacks the sync read before v1.3 — `PropertyType__c`, the Bayut type,
`OfferingType__c`, `Purpose__c`, `Project_Type__c`, `PropertyPrice__c`,
`Published_Date__c`, `Reference__c`, `Listing_ID__c` — are dropped with them:
each stood in for a field that is now required or restricted, and reading a
field outside the contract only means a health-page alarm the day its access
is tidied away. A test (`NOT_IN_WEBSITE_FEED`) keeps the communities and the
listing-level agent out.

Still true from the earlier guides: `Property_Listing__c` is the *listing*
(the offer) and `Listing__c` the *property*, read through `Property__r`;
`Rooms__c` / `Bathrooms__c` are string picklists (`"Studio"`, `"1"`…);
coordinates are strings; `Listing_Image_URLs__c` is comma-separated; uploads
live in the rich-text `Listing_Images__c`. v1.3's samples add two quirks:
`Orientation__c` holds compass **letters** (`"E"`), and the Assigned Agent's
`Email` can come back **null** (the advisor is then matched by an admin's
mapping, keyed on the User id).

### How a run works

1. **Sweep.** One SOQL query: every `Property_Listing__c` with
   `Website_Status__c` Published or Republished, joined to `Property__r`,
   through the explicit field **allowlist** (`fields.ts`), ordered by `Id` (not
   the guide's `LastModifiedDate DESC`, so a multi-page sweep cannot skip or
   repeat a record edited mid-sweep). Never the guide's step 4
   (`GET /sobjects/Listing__c/{id}`), which returns every field — owner's
   name and phone included. If the org hides one of our fields, the query
   fails whole with `INVALID_FIELD`; the run then describes both objects,
   drops what it cannot see, keeps syncing, and reports the gap.
2. **Withdrawals, on evidence only.** A listing we have seen that is missing
   from the sweep is asked about by id. Unpublished or deleted (`queryAll`)
   → recorded as **withdrawn** on the mirror, and flagged on the Salesforce
   screen and the listing's editor page. The website's listing is not
   touched (see "Who owns what"). **Not visible at all → nothing changes**
   and an issue is raised: that is what a sharing-rule or permission change
   looks like.
3. **Plan** (`plan.ts`, pure): snapshot → the draft's fields, plus *holds*
   (what the CRM left out, each tagged with who fixes it) and *notes*.
4. **Content**, for a listing with no draft yet: copy its photos, and once
   all of them are copied create the property — `draft`, a fresh
   `BAZ-XX-0NNNN` reference, its photos linked. A listing whose draft exists
   is skipped: not one write.
5. **Mirror**, after re-reading the hidden flags, so an admin who hides a
   listing mid-run is not overridden by a decision made a minute earlier.

The whole catalogue is swept each run rather than a `LastModifiedDate`
delta: a change to the *property* record does not bump the *listing's*
stamp, and absence from a full sweep is the first half of the withdrawal
evidence. At this org's size that is one query. Revisit past a few thousand
published listings.

Stored snapshots carry a schema version (`v`, now 3). A re-apply — an
admin's hide, allow or mapping — plans from the stored snapshot without calling
Salesforce, through `upgradeSnapshot`, so a row written before v1.3 plans as
Salesforce would send it today, minus the fields it never had.

### Who owns what

**Salesforce supplies the first draft; the website owns everything after
that** (0166, the client's decision of 21 Oct 2026).

The sync creates a listing's property row **once**, as a `draft`, with every
fact the CRM gave (the mapping table below) and its whole photo gallery. From
that moment the row is an ordinary website listing:

- Every field is edited in the property editor — title, descriptions and
  their Arabic, price, rooms, map pin, area, address line, developer,
  project, permit, amenities, advisor, card labels (Exclusive and Vacant on
  transfer included), photos. No control refuses a Salesforce listing.
- It is published, unpublished and archived from the editor's own publish
  card, behind the same publish gate as any listing.
- The sync never writes the row, its photos or its status again. A later edit
  in Salesforce reaches only the mirror's snapshot (shown on the Salesforce
  screen for reference). The mirror's state is `on_website`.
- **A withdrawal in Salesforce does not take the listing down.** It is
  recorded on the mirror and shown as a warning on the editor page and the
  Salesforce screen ("Still published on the website"), for an editor to
  unpublish if the property is no longer available.
- **Deleting the draft does not bring it back.** A listing whose draft was on
  the website and is gone is marked hidden; *Allow on website* on the
  Salesforce screen makes a fresh draft.

What the CRM left out of the draft — a blank permit, an area or developer the
website does not have — is not a hold any more: the draft is made anyway, the
gaps are listed under the editor's Salesforce card ("What Salesforce left out
of the draft"), and the publish gate refuses what the law requires (permit,
developer, form) until an editor fills it.

Before the draft exists, three things can still stop it: the CRM record is too
incomplete to be a row at all (no title, offering, type or price — held), its
photos are still copying (held, `photos_pending`), or an editor chose *Don't
bring in* (hidden). Approval and auto-publish are gone: the sync never
publishes, and `salesforce_listing_sync.auto_publish` is no longer read.

Status changes an editor makes in bulk or by CSV still pass through the
trigger `properties_salesforce_editor_status_tr` (0136, 0159), which stamps
`hidden_at` / `approved_at` on the mirror and audits it. Those stamps no
longer change anything for a listing whose draft exists.

### Mapping

| Salesforce | Website |
|---|---|
| `Sale_Rent__c` | `mode`: `rent` or `buy` (off-plan is `property_form`, not a mode, since 0168) |
| `ProjectStatus__c` | `property_form`: Resale → `resale`, Primary ready → `ready_new`, any Off-plan → `off_plan`; blank on a sale → held |
| `Property_Type__c` | `type` + `segment`, Hotel Apartment and Commercial Villa included. "Other", or a value the website has never seen → held |
| `Category__c` | `segment` |
| `Price__c` | `price_aed` (sale) |
| Rent: `Price__c` / `Yearly__c`, by `Rent_Frequency__c` | yearly rent. Frequency blank → held (required by v1.3); monthly with no `Yearly__c` → held, never multiplied; yearly with `Price__c` ≠ `Yearly__c` → held (the 1 Oct sweep found a sale price in `Price__c` on a rental) |
| `Area__c`, `Sub_Area__c`, checked against `Emirate__c` | area by exact name or slug (an admin's mapping first); the sub-area only among **that** area's sub-communities. Area blank → held; not on the website → held for an admin to map; a sub-area the website lacks → placed in the area and noted |
| `Project__r.Name` | `development_id`, by the project page's exact name or slug; unmatched → noted, not linked |
| project (or sub-area) + area | `address_line` / `address_line_ar` in the live listings' house style — "Yas Riva Reserve, Yas Island" — from the website's own Arabic names |
| `Developer__c` | developer, ignoring "Properties", "Realty", "PJSC"…; else held for mapping |
| `Agent_Name__r.Email`, else an admin's mapping of the `Agent_Name__c` User | advisor; unmatched → noted |
| `RERAPermitNumber__c`, `Permit_Expiry_Date_c__c` | permit number and expiry; missing or past → held. `Expired_Date__c` ends the *listing* and holds it when past |
| `Short_Description__c`, `Description__c` (+ Arabic) | `short_description`, `description` (plain text → escaped paragraphs) |
| `Tenure__c` | `freehold` / `leasehold` / `usufruct`; anything else noted, not shown |
| `Year_Built__c`, `Handover_Date__c` | `year_built`: off-plan takes the handover year (the expected completion), a completed home its year built, else a past handover year; outside 1900–2100 noted, not shown |
| `View__c`, `Orientation__c` (+ formula Arabic) | `view`, `orientation` — compass letters written out ("E" → East) — and their twins; the view's amenity ("Garden View" → "Garden Views") is added to the amenities |
| `Service_Charge_Sqft__c` | `service_charge_per_ft2`, 0–1,000 AED/sq ft/yr; else noted |
| `FurnishingType__c` | `Unfurnished` / `Semi Furnished` (with or without the space) / `Fully Furnished` |
| `Amenities__c` + `Website_Amenities__c` | the amenity taxonomy, through apostrophes and hyphens plus a small alias table; unmatched values are noted, never added |
| `Exclusive__c`, `Vacant_On_Transfer__c` | the two built-in card labels (`flags.exclusive` / `flags.vacant_on_transfer`) |
| `FloorNumber__c` | a whole number; "G" / "Ground" is 0; "G+1" is dropped |
| `Published_Platform__c` | not used; noted when it lacks Website on a listing published for the website |
| `Cover_Page_Image__c` / `Main_Image_URL__c`, `Listing_Images__c` + `Listing_Image_URLs__c`, `Floor_Plans__c` | hero, gallery in the CRM's order, floor plan. Cover and floor plan are rich-text fields that may hold bare URLs; both forms are read |

`VideoTourURL__c` and `URLLink360__c` are read into the snapshot and not yet
shown (docs/FOLLOWUPS.md).

### Write-back (guide v1.3, step 5)

The sync PATCHes `Website_Status__c`, `Website_Listing_URL__c` and
`Website_Error__c` on each listing, so the CRM team sees in Salesforce what
happened — **once an admin turns write-back on**
(`salesforce_listing_sync.write_back`, 0137; off by default, because on a
first production run every listing held for a missing field would be
deactivated at once). v1.2 named the URL field `Website_URL__c`; the column
comment in 0137 still does.

| Website state | Written |
|---|---|
| on the website, published by an editor | `Published`, the listing's URL, error cleared |
| on the website, not published | status untouched; "A draft on the website. The Bazar team edit it and publish it there." |
| too incomplete to draft, for something **Salesforce** must fix | `Deactivated`, the reasons — their contract: it leaves the published set until the CRM team fixes it and publishes it again |
| photos still copying | status untouched, so it stays in the sweep; the error field says so |
| not brought in by an editor | `Deactivated`, "taken off the website by the Bazar team" |
| withdrawn by the CRM, or a sandbox | nothing |

Only changed fields are sent, compared with what the sweep read back, so a
steady catalogue costs no write calls. `Republished` counts as live
everywhere — in the sweep, in withdrawal evidence, and it is never
"corrected" to `Published`. A listing that leaves the set because we
deactivated it keeps its reasons on the admin screen.

### Photos

Copied into the `media` bucket, never hot-linked. Salesforce Files come
through the REST API with our token (`ContentVersion/{id}/VersionData`,
proven against the sandbox); pasted rich-text images through the rich-text
image resource; web URLs over https only, with private addresses refused on
every redirect hop, a 25 MB cap and the file type read from its bytes.
Each photo is copied once (`salesforce_media`), a dead link is retried daily
rather than every run, and a listing's draft waits for its whole gallery —
once the draft exists its photos are the editor's. Placeholder `example.com` URLs in the sandbox 404 and are reported.

### Safety rails

- **A sandbox never publishes.** A `*.sandbox.my.salesforce.com` org is
  evaluated and shown on the admin screen — holds and all — and nothing
  reaches `properties` or the bucket. Proven by running the real sync
  against the sandbox with the production database.
- **The sync never publishes.** Every Salesforce listing arrives as a draft
  and goes live only when an editor publishes it.
- **Pause.** One button stops all fetching and writing.
- **Portal feeds skip Salesforce listings** (`lib/syndication/load.ts`):
  Salesforce publishes to Property Finder and Bayut itself, and a second copy
  from us would list each one twice. Since 0166 an edit made on the website
  does not reach the portals either: they show Salesforce's version.
- **Leads close the loop.** An enquiry on a Salesforce listing reaches
  `Lead__c` with the CRM's own listing name (`LST-00003`) in
  `Property_Reference__c` and the website reference in the description.

## Areas — website to Salesforce

Vendor document: *Website Area Locations Sync* (Levarus, v1.0, 22 Oct 2026,
production). Same Connected App and token as everything else; the run-as user
needs Levarus's **Website Locations Admin** permission.

`Area__c` and `Sub_Area__c` on a Salesforce listing are restricted picklists
of the website's own area names, dependent on `Emirate__c` and `Area__c`; the
listing sync places a listing by matching them back to `areas`. An area the
website adds that the picklist lacks is an area no CRM user can list in.

```
POST /services/apexrest/properties/website-locations
  UPSERT  { action, eventId, emirate, area, subAreas? }   add or reactivate
  REPLACE { action, eventId, emirate, area, newArea, subAreas? }   rename an area
GET  same path → { "status": "ok" }                         ping
```

**How it runs.** A trigger on `areas` (0169) writes a row to
`salesforce_location_events` for every change Salesforce holds, with the
payload fixed at that moment — a REPLACE needs the old name, which only the
trigger sees. So every path that adds or renames an area enrols itself: the
area editor, the property wizard's *New area*, a data migration. The area
actions send it straight after the save (`after()`, so the editor never waits
on the org); the lead-sync cron sends whatever that missed, every five
minutes. `lib/salesforce/locations.ts` is the sender.

| Website change | Request |
|---|---|
| `area` added | `UPSERT { emirate, area }` |
| `sub_community` added under an area | `UPSERT { emirate, area: <parent>, subAreas: [name] }` |
| `area` renamed, same emirate | `REPLACE { emirate, area: <old>, newArea: <new> }` |
| any other change of name, kind or parent of either | `UPSERT` of where it is now |
| `area` or `sub_community` deleted (0167's CMS delete) | `DELETE`, stored `held`, **never sent** |
| `emirate` or `building`, a description, a slug, a photo | nothing |

`eventId` is `WEB-AREA-<event uuid>`, so a Salesforce log line traces to its
row. Names are trimmed; the emirate is the nearest `emirate` ancestor.

**Order and retries.** Oldest first, and the queue stops behind an event that
has to retry — an add that has not landed must not be overtaken by its
rename. Each event is claimed (its `attempts` advanced, conditionally) before
it is sent, so the action's drain and the cron's never double-send. Retryable
failures back off 1m, 5m, 25m, 2h, 10h; after the fifth, or at once for a
refusal (an unknown emirate, a 400, a 200 whose `status` is not `ok`), the row
is `failed`, reported on the health page, and the queue moves on. An area with
no emirate above it is failed locally with that reason and no call.

**What the API cannot do.** No delete or deactivate, and no sub-area rename.
So a deleted area, a renamed sub-area, or an area moved to another emirate
leaves its old value active in Salesforce. Asked of Levarus (items 19–20
below). Deletes are recorded anyway, `state = 'held'`, which the sender never
reads: the list of values someone must retire in Salesforce by hand, and,
once Levarus add a deactivate action, a backlog to send — map `DELETE` to
their verb in `buildLocationRequest`, then
`update salesforce_location_events set state = 'pending', next_attempt_at = now() where state = 'held';`.
The CMS's delete message tells the editor Salesforce still lists the area.

**Starting state (22 Oct 2026).** A describe of `Listing__c` showed every
website area (31) and sub-area (7) already in the picklists, so nothing was
backfilled. Salesforce also held four values the website does not: `Al
Samha`, `Al Samha East` (the document's own examples), `Postman Active
145820`, and `Al Shamkha`.

Triage:

```sql
select created_at, state, attempts, payload, last_error, response
  from salesforce_location_events
 order by created_at desc
 limit 20;

-- Deleted on the website, still to retire in Salesforce:
select created_at, payload from salesforce_location_events where state = 'held';
```

To resend a failed event after fixing its cause:
`update salesforce_location_events set state = 'pending', attempts = 0, next_attempt_at = now() where id = '…';`

## Production status

| | Sandbox | Production |
|---|---|---|
| Token (Run As user) | ✅ | ✅ |
| `Lead__c` create | ✅ | ✅ — live since 25 Sept |
| `Property_Listing__c`, `Listing__c` visible | ✅ | ✅ — fixed 25 Sept; first sweep 1 Oct |
| Write-back fields editable | ✅ (proven with a no-op PATCH, v1.2 names) | not yet tried — write-back is off |
| Website Locations API | — | ✅ ping and token, 22 Oct 2026 (with the document's credentials) |

The production sweep was unpaused on 1 Oct and has run every fifteen minutes
since. Its first run found one listing, `LST-00001` — a sandbox test record
copied into production — and held it (an area not on the website, an expired
permit, a sale price in `Price__c` on a rental). Levarus deleted the test
records on 5 Oct; both website drafts were withdrawn, neither was ever
published, and the published set has been empty since.

v1.3's new fields are read from the first sweep after this change deploys. If
production does not have one of them yet, that sweep narrows the query, keeps
syncing and lists the field under hidden fields on the health page and the
Salesforce listings screen — check there after the deploy.

## Open questions for Levarus

Sent 22 Sept · the 23 Sept revision answered **9, 10 and most of 11**. The
rest are outstanding, and two new ones have been added by that revision.

### Listings — Salesforce to website

v1.3 (5 Oct) answered the production listing access (P1) and most of
Bazar's v1.1 requirements: all fourteen new fields (N1–N14), the restricted
developer and property-type picklists, the project, the handover date, the
whole-number floor and the Arabic field lengths. Still open:

- **Publishing rules.** v1.3 does not say whether Salesforce now refuses to
  mark an incomplete listing Published (v1.1 rules P1–P21, F1–F7). The
  website holds such a listing either way; the rules would let the CRM team
  see why at the moment they click.
- **Coordinates are still text** (`Latitude__c` / `Longitude__c`), not the
  numbers v1.1 C7 asked for. The website parses and range-checks them, so
  this costs nothing but typos.

- **Write-back field access in production.** The integration user needs Edit
  on `Website_Status__c`, `Website_Listing_URL__c` and `Website_Error__c`;
  untested until write-back is switched on after the first clean real listing.
- **Rotate the Connected App secrets.** Both editions of v1.3 print the
  client id and secret in the document again, as v1.2 did.
- **Agent email.** The v1.3 samples return the Assigned Agent's `Email` as
  null. If the integration user cannot read User emails, every advisor has to
  be mapped by hand on the Salesforce listings screen; with read access they
  match by email.
- ~~P4. `Project__c`.~~ **Answered in v1.3**: the feed now carries
  `Project__c` and `Project__r.Name`.
- ~~P5. `Republished`.~~ **Answered**: a listing published again after expiry
  or deactivation. Live, as we treat it.

### Leads — website to Salesforce

9. ~~A field on `Lead__c` marked External ID.~~ **Answered** — `External_ID__c`,
   Text(254), Unique. In use.
10. ~~Full picklist values.~~ **Answered** — `Inquiry_Type__c`: Buy, Sell,
    Rent. `Lead_Source__c`: Facebook, Advertisement, Webinar, Website,
    Newspaper, Walk In, Property Finder, Bayut, Others.
11. Required fields and error shapes: **answered**. Text lengths: still
    missing for everything except `External_ID__c`. We assume Salesforce's
    255 default and truncate.
12. Separate Connected App credentials for production, over a secure channel.
    **Still outstanding** — the 23 Sept revision carries the same sandbox
    secret as the first, which has now been circulated twice.

### New, raised by the 23 Sept revision

13. **Make `Phone__c` and `Country_Code__c` optional.** 36% of this site's
    leads have no phone number; as written, none of them can reach the CRM.
14. ~~A fourth `Inquiry_Type__c` value.~~ **Answered** 19 Oct 2026: `Other`.
    In use as the fallback and for intent `manage`.

### Raised 19 Oct 2026

15. **Edit access to `Mortgage_Service__c`** for the integration user. The
    field exists but is read-only to it (describe: `createable: false`).
16. ~~An `English` value on `Preferred_Languages__c`.~~ **Answered** by
    22 Oct 2026 (seen in a describe): the picklist now holds `English`, and
    every English-site lead sends it.
17. Duplicate handling (Levarus, 19 Oct): a new email → new `Lead__c` and
    contact; same email + same project → a Re-Inquiry under the parent;
    same email + different project → new `Lead__c` on the same contact. The
    site sends no `Project__c`, so which "project" their rule compares is
    worth confirming.
18. **Erasure of Re-Inquiries.** Either read/edit on the Re-Inquiries
    object for the integration user (with the field that links one to its
    parent and the personal fields it copies), so a website erasure can
    pseudonymise it as it does a `Lead__c`, or a standing arrangement that
    Levarus erase the Re-Inquiries of a parent we name. Until then each one
    is reported on the health page and on the DSR screen for a person to
    act on.

### Raised 22 Oct 2026 (Website Locations Sync v1.0)

19. **A way to retire an area.** The API adds and renames only, and the
    CMS can delete an area since 22 Oct 2026 (#637). Salesforce needs a
    `DEACTIVATE` action (`{ emirate, area }`, and `subAreas` to retire only
    those); until then each website delete is a `held` row to act on by hand.
20. **Sub-area rename.** REPLACE renames an area; a renamed sub-area can only
    be UPSERTed under its new name, leaving the old one active. A
    `REPLACE_SUB_AREA` (`area`, `subArea`, `newSubArea`), or `newSubArea` on
    REPLACE, would close it.
21. **Tidy the picklists.** `Al Samha`, `Al Samha East` and `Postman Active
    145820` look like test values and should be deactivated; `Al Shamkha`
    is in Salesforce and not on the website — add it on the website or
    retire it there.
22. **The response body.** The document gives none for POST. The sender
    treats any 2xx as success unless its `status` is not `ok` or `success`
    is false, and stores the body on the row; please confirm the shape.
23. **Rotate the Connected App secret** — this document prints it too.

## Design rules that held

Written before the listings guide arrived, as the decisions that are
expensive to reverse after a first sync. Two changed once the real objects
were visible, and why:

- **Field-level ownership** — replaced on 21 Oct 2026 (0166). Salesforce owned
  its fields for as long as it published the listing, and the editor refused
  to change them; the client needed to correct listings before posting them.
  Salesforce now supplies the first draft only.
- **Never auto-publish** — kept, and made absolute: the sync never publishes;
  an editor does.
- **Never hard-delete** — kept. A withdrawal is recorded, not acted on; the
  website's listing stays until an editor decides.
- **Poll, do not subscribe** — kept, as a full sweep rather than a
  `LastModifiedDate` watermark; see "How a run works".

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Ask list to Levarus; rotate the sandbox secret | Sent |
| 1 | Leads out: client, mapper, queue, cron, admin card | **Built** |
| 2.5 | Exactly-once upsert, real picklists, required-field guard | **Built** |
| 2 | PDPL: erasure and access requests reach the CRM | **Built** |
| 3 | Listings in: sweep, mapper, drift correction, evidence-based withdrawal, sandbox mirror | **Built**; drift correction and acting on withdrawals removed by 0166 |
| 4 | Photos from Salesforce Files and URLs into the `media` bucket | **Built** |
| 5 | Review queue: approval, hide/allow, mapping screen, editor guards | **Built**; approval and the editor guards removed by 0166 |
| 5.5 | Guide v1.2: permit expiry, community, website type, write-back (off until an admin enables it) | **Built** |
| 6 | Production: leads live (credentials in Vercel); listings after P1 | Leads ready; listings blocked on Levarus |
