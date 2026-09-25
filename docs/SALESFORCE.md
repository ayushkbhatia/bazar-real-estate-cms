# Salesforce integration

Two directions, one Connected App, one integration user.

| Direction | What it does | Status |
|---|---|---|
| **Leads out** — website → Salesforce | Every public enquiry becomes a `Lead__c` record | **Built** (Phases 1, 2, 2.5) |
| **Listings in** — Salesforce → website | Every listing the CRM marks Published for the website becomes a listing here | **Built** (Phase 3) — see [Listings](#listings--salesforce-to-website) |

Vendor documents: *Lead Creation API* (18 Sept 2026), *Web to Lead Creation*
(23 Sept), the production edition of the same (24 Sept) and *Published
Listings — API Integration Guide* (24 Sept). The listings guide uses the
**same Connected App and secret** as the lead documents — verified by
comparing them, not assumed — so both directions share
`SALESFORCE_INSTANCE_URL` / `SALESFORCE_CLIENT_ID` / `SALESFORCE_CLIENT_SECRET`
and there is nothing new to configure.

Production, as of 25 Sept: the Run As user is fixed, so **leads can go live**
(`Lead__c` is createable). **Listings cannot yet** — the production
integration user sees no listing objects at all; see
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

`Lead__c` is a **custom** object, not the standard `Lead`. Eight fields, all
custom, all documented in the vendor doc and nothing beyond them.

| Salesforce | Source | Notes |
|---|---|---|
| `Name__c` | `enquiries.name` | Truncated at 255. |
| `Email__c` | `enquiries.email` | Omitted when absent. |
| `Country_Code__c` | split from `enquiries.phone` | `"+971"`. See `lib/salesforce/phone.ts`. |
| `Phone__c` | split from `enquiries.phone` | National part, trunk zero stripped. |
| `Lead_Source__c` | enquiry `source` | `Website`, or `Others` for WhatsApp. Required. |
| `Inquiry_Type__c` | intent → listing mode → source | `Buy` / `Sell` / `Rent`. Required. |
| `External_ID__c` | `enquiries.id` | In the upsert URL, not the body. |
| `Property_Reference__c` | `properties.reference` | `BAZ-AD-04891`. Omitted for non-property leads. |
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

The fallback is a compromise, not a mapping. A property-management enquiry is
the opposite of all three values — the person already owns the property — and
a general "tell me about your services" lead is none of them. Worth asking
Levarus for a fourth value.

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

`missingRequiredFields` stays as the last line of defence: a lead that still
reaches the push without the fields is marked `failed` with a
`Blocked locally:` reason and costs no API call. It should now be unreachable
from the public forms, and it remains the right answer for anything that
writes an enquiry by another route.

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
| `Country_Code__c` | **picklist** | — | no | 206 values, `+7` absent |
| `Lead_Source__c` | picklist | — | no | the nine documented values |
| `Inquiry_Type__c` | picklist | — | no | Buy / Sell / Rent |
| `Property_Reference__c` | string | 255 | yes | |
| `Description__c` | textarea | 131072 | yes | we truncated at 32000 |
| `External_ID__c` | string | 254 | yes | External ID, Unique |

No undocumented required field exists, so the documented set is sufficient.

**`Country_Code__c` is a restricted picklist.** Neither document said so. A
code outside its 206 values fails the whole record. `+7` — Russia and
Kazakhstan — is missing, although every neighbour (`+994`, `+995`, `+996`,
`+998`) is present, so it reads as an omission. Until it is added, those
leads are refused locally with a reason rather than sent with a wrong code:
the lead stays visible in the CMS and replays with one UPDATE once the value
exists.

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

### The objects, as they really are

The guide's names are inverted and its samples are optimistic, so this is from
a `describe` of both objects and a read of every sandbox record (24 Sept):

- **`Property_Listing__c`** is the *listing* — the offer: `Sale_Rent__c`,
  `Price__c`, `Listing_Status__c`, `Expired_Date__c`, the assigned agent, and
  `Website_Status__c` (`Published` / `Failed`; blank when never published).
- **`Listing__c`** is the *property* — 104 fields, read through
  `Property__r`. The guide lists fifteen. Among the ones it leaves out:
  `Title_Arabic__c` and `Description_Arabic__c` (so listings arrive bilingual),
  `Listing_Images__c` (the rich-text field CRM users actually upload photos
  into), `Property_Type_Bayut_Picklist__c` (the only type field with villas
  and townhouses), `ProjectStatus__c`, `Developer__c`, `RERAPermitNumber__c`,
  and `OwnerName__c` / `Owner_Contact__c`, which we must never read.

Where the guide is wrong: `Rooms__c` and `Bathrooms__c` are **string**
picklists (`"Studio"`, `"1"`…), not numbers; `Latitude__c` / `Longitude__c`
are **strings**; `Listing_Image_URLs__c` arrives **comma**-separated; its
sample furnishing value `"Furnished"` is not in the picklist
(`Unfurnished / Partly Furnished / Fully Furnished`).

The sandbox's single published listing, `LST-00000`, has no title, no price on
the listing, no location, no type, no developer and no permit — and its photos
are `/sfc/servlet.shepherd/…` links that need a Salesforce session. It is held
with six reasons, each naming the Salesforce field to fill.

### How a run works

1. **Sweep.** One SOQL query: every `Property_Listing__c` with
   `Website_Status__c = 'Published'`, joined to `Property__r`, through an
   explicit field **allowlist** (`fields.ts`). Never the guide's step 4
   (`GET /sobjects/Listing__c/{id}`), which returns every field — owner's
   name and phone included. If the org hides one of our fields, the query
   fails whole with `INVALID_FIELD`; the run then describes both objects,
   drops what it cannot see, keeps syncing, and reports the gap.
2. **Withdrawals, on evidence only.** A listing we have seen that is missing
   from the sweep is asked about by id. Unpublished or deleted (`queryAll`)
   → taken off the website. **Not visible at all → nothing changes** and an
   issue is raised: that is what a sharing-rule or permission change looks
   like, and it must never be able to empty the website.
3. **Plan** (`plan.ts`, pure): snapshot → the website row, plus *holds* (why
   it cannot be published, each tagged with who fixes it — Salesforce, the
   website, or nobody: "photos still copying") and *notes*.
4. **Content.** Create the property (`draft`, a fresh `BAZ-XX-0NNNN`
   reference) or correct drift, copy photos, link them.
5. **Status**, after re-reading the admin flags, so an admin who hides a
   listing mid-run is not overridden by a decision made a minute earlier.

The whole catalogue is swept each run rather than a `LastModifiedDate`
delta: a change to the *property* record does not bump the *listing's*
stamp, and absence from a full sweep is the first half of the withdrawal
evidence. At this org's size that is one query. Revisit past a few thousand
published listings.

### Who owns what

| Salesforce owns (overwritten every run) | The website owns (never touched after creation) |
|---|---|
| title, description, mode, segment, type, completion form, beds, baths, sizes, furnishing, parking, floor, map pin, price, area / sub-community, developer, amenities, permit number and expiry, photos from Salesforce | slug, reference, SEO, short description, card labels, featured flags, advisor note, view, orientation, photos an editor added |
| `title_ar` / `description_ar` **when** the CRM wrote Arabic | the Arabic twins when it did not |
| the advisor **when** the CRM's agent maps to a staff member | the advisor when it does not |

Ownership is enforced by comparing each synced field with the row every run
(so an editor's change to a Salesforce field is put back) and, before that
can surprise anyone, by the editor itself: saving a Salesforce listing keeps
Salesforce's values for those fields and says so; the map-pin, developer and
advisor controls refuse with a pointer to Salesforce. The editor's publish
card is replaced by a Salesforce card, because the sync owns the status.

Status changes an editor makes anywhere else — the bulk bar, a CSV import —
are caught by a trigger (`properties_salesforce_editor_status_tr`, 0136):
taking a Salesforce listing off the website **hides** it (the sync keeps it
off), publishing it approves and allows it. Only a person's change counts; the
sync's own writes, as the service role, do not.

### Mapping

| Salesforce | Website |
|---|---|
| `Sale_Rent__c` (else `OfferingType__c`, else `Purpose__c`) | `mode`: `rent`, or `buy` / `off_plan` by completion |
| `ProjectStatus__c` (else `Project_Type__c`) | `property_form`: Resale → `resale`, Primary ready → `ready_new`, any Off-plan → `off_plan` |
| `Property_Type__c` (v1.2), else `Property_Type_Bayut_Picklist__c`, else `PropertyType__c` | `type` + `segment`. No honest equivalent ("Other", Residential Floor, Villa Compound, Bulk Units, Full/Half Floor) → held |
| `Category__c` | `segment` |
| `Price__c` (sale; else `PropertyPrice__c`, noted) | `price_aed` |
| Rent: `Price__c`/`Yearly__c`, by `Rent_Frequency__c` | yearly rent; a monthly rent with no `Yearly__c` is held, never multiplied |
| `Sub_Community__c`, `Community__c`, `Location__c` (v1.2) + `Emirate__c` | area / sub-community by exact name or slug, most specific first; ambiguous or another emirate → held for an admin to map |
| `Developer__c` | developer, ignoring "Properties", "Realty", "PJSC"…; else held for mapping |
| `Assigned_Agent__r.Email` (else the property's `Agent_Name__r`) | advisor, by staff email; else noted for mapping |
| `RERAPermitNumber__c`, `Permit_Expiry_Date_c__c` (v1.2) | permit number and expiry; missing or past → held. `Expired_Date__c` ends the *listing* and holds it when past |
| `FurnishingType__c` | `Unfurnished` / `SemiFurnished` (v1.2's spelling) / `Fully Furnished` |
| `Amenities__c` | the amenity taxonomy, through apostrophes and hyphens plus a small alias table; unmatched values are noted, never added |
| `Cover_Page_Image__c` / `Main_Image_URL__c`, `Listing_Images__c` + `Listing_Image_URLs__c`, `Floor_Plans__c` | hero, gallery in the CRM's order, floor plan. Cover and floor plan are rich-text fields that v1.2 fills with bare URLs; both forms are read |

### Write-back (guide v1.2, step 5)

The sync PATCHes `Website_Status__c`, `Website_URL__c` and `Website_Error__c`
on each listing, so the CRM team sees in Salesforce what happened — **once an
admin turns write-back on** (`salesforce_listing_sync.write_back`, 0137; off by
default, because on a first production run every listing held for a missing
field would be deactivated at once).

| Website state | Written |
|---|---|
| live | `Published`, the listing's URL, error cleared |
| held for something **Salesforce** must fix | `Deactivated`, the reasons — their contract: it leaves the published set until the CRM team fixes it and publishes it again |
| held for something **we** must fix (a location to map), photos copying, awaiting approval | status untouched, so it stays in the sweep; the error field says what it is waiting for |
| hidden by an editor | `Deactivated`, "taken off the website by the Bazar team" |
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
rather than every run, and a listing's first appearance waits for its whole
gallery. Placeholder `example.com` URLs in the sandbox 404 and are reported.

### Safety rails

- **A sandbox never publishes.** A `*.sandbox.my.salesforce.com` org is
  evaluated and shown on the admin screen — holds and all — and nothing
  reaches `properties` or the bucket. Proven by running the real sync
  against the sandbox with the production database.
- **Approval first.** `salesforce_listing_sync.auto_publish` is off: the
  first appearance of every listing waits for an admin's Approve. Approval is
  sticky; turning auto-publish on later is one button.
- **Pause.** One button stops all fetching and writing.
- **Portal feeds skip Salesforce listings** (`lib/syndication/load.ts`):
  Salesforce publishes to Property Finder and Bayut itself, and a second copy
  from us would list each one twice.
- **Leads close the loop.** An enquiry on a Salesforce listing reaches
  `Lead__c` with the CRM's own listing name (`LST-00003`) in
  `Property_Reference__c` and the website reference in the description.

## Production status

Checked 25 Sept, after v1.2 of the listings guide:

| | Sandbox | Production |
|---|---|---|
| Token (Run As user) | ✅ | ✅ — fixed |
| `Lead__c` create | ✅ | ✅ |
| `Country_Code__c` has `+7` | ✅ (207 values) | ❌ (206) |
| `Property_Listing__c`, `Listing__c` visible | ✅ | ❌ — the integration user sees only `Lead__c`; a listing query answers `sObject type 'Property_Listing__c' is not supported` |
| Write-back fields editable | ✅ (proven with a no-op PATCH) | ❌ (objects not visible) |

So leads can go live now; listings wait for the objects, their fields and the
integration user's access to be deployed to production. Setting the three
`SALESFORCE_*` variables in Vercel turns both on; until the listing objects
exist in production, the listing sync reports a failure on the health page
every run, which is accurate.

## Open questions for Levarus

Sent 22 Sept · the 23 Sept revision answered **9, 10 and most of 11**. The
rest are outstanding, and two new ones have been added by that revision.

### Listings — Salesforce to website

v1.2 (25 Sept) answered L1, L3–L8: a complete published sandbox listing
(`LST-00002`), `Permit_Expiry_Date_c__c`, ADREC in `PermitType__c`, a
website `Property_Type__c`, the amenity picklist cleaned (bar "Location URL"),
AED confirmed, and write-back fields. Still open:

- **P1. Production listing objects.** Deploy `Property_Listing__c`,
  `Listing__c` and their fields to production, and give the Run As user read
  on both, edit on the three `Website_*` fields, and access to the listings'
  Files. Today it can see only `Lead__c`.
- **P2. `+7` in production.** Added to `Country_Code__c` in the sandbox only.
- **P3. Rotate the sandbox secret.** v1.2 still carries the original one; it
  has now been in five documents.
- **P4. Their sample query selects `Project__c`**, which does not exist in
  the sandbox — run as written it fails with `INVALID_FIELD`. Ours does not
  read it.
- **P5. What does `Republished` mean?** We treat it as live.
- **P6. `LST-00002`'s data disagrees with itself**: `Emirate__c` Abu Dhabi
  but Dubai Hills Estate; `Property_Type__c` Apartment but "4BR Villa" in the
  title and Villa in the Bayut field. Worth fixing before anyone judges the
  website by it.

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
14. A fourth `Inquiry_Type__c` value ("Other", or "Manage"). Property
    management and general service enquiries are none of Buy/Sell/Rent, and
    the field cannot be left empty, so they currently land on `Buy`.

## Design rules that held

Written before the listings guide arrived, as the decisions that are
expensive to reverse after a first sync. Two changed once the real objects
were visible, and why:

- **Field-level ownership** — kept. The Arabic twins and the advisor became
  Salesforce's *only when Salesforce supplies them*: the CRM turned out to
  carry human-written Arabic, which is better than a machine draft, and an
  assigned agent.
- **Never auto-publish** — kept as the default, made a setting. A human
  approves each listing's first appearance until an admin switches
  auto-publish on; approval is per listing and sticky.
- **Never hard-delete** — kept. Withdrawn is `off_market`, which the listing
  page answers with a 410, and which reverses when Salesforce republishes.
- **Poll, do not subscribe** — kept, as a full sweep rather than a
  `LastModifiedDate` watermark; see "How a run works".

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Ask list to Levarus; rotate the sandbox secret | Sent |
| 1 | Leads out: client, mapper, queue, cron, admin card | **Built** |
| 2.5 | Exactly-once upsert, real picklists, required-field guard | **Built** |
| 2 | PDPL: erasure and access requests reach the CRM | **Built** |
| 3 | Listings in: sweep, mapper, drift correction, evidence-based withdrawal, sandbox mirror | **Built** |
| 4 | Photos from Salesforce Files and URLs into the `media` bucket | **Built** |
| 5 | Review queue: approval, hide/allow, mapping screen, editor guards | **Built** |
| 5.5 | Guide v1.2: permit expiry, community, website type, write-back (off until an admin enables it) | **Built** |
| 6 | Production: leads live (credentials in Vercel); listings after P1 | Leads ready; listings blocked on Levarus |
