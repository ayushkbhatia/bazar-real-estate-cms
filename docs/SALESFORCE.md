# Salesforce integration

Two directions, built separately, only one of which exists today.

| Direction | What it does | Status |
|---|---|---|
| **Leads out** — website → Salesforce | Every public enquiry becomes a `Lead__c` record | **Phase 1, built** |
| **Listings in** — Salesforce → website | Properties created by the CRM team appear in the catalogue | Not started — blocked on the vendor |

Two vendor docs so far — *Lead Creation API* (18 Sept 2026) and *Web to Lead
Creation* (23 Sept 2026) — and both cover **only** the first direction. The
revision answered questions 9, 10 and most of 11; questions 1–8 and 12 are
untouched, and the title narrowing from "Lead Creation" to "Web to Lead
Creation" suggests the listing sync is not yet on their side of the plan.

So the larger half of the brief remains unspecified: no documented object, no
field list, no read endpoint, no answer on where photographs live.

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

### The required-field problem

`Email__c`, `Phone__c` and `Country_Code__c` are all Required. This site has
always asked for email **or** phone — `lib/schemas/enquiry.ts` enforces
exactly that — and **279 of 772 production leads have no phone number**.

Every one of those is a guaranteed non-retryable 400. So the push checks
first: `missingRequiredFields` runs before any call, and a lead that cannot
satisfy the contract is marked `failed` with a `Blocked locally:` reason
naming the field, without spending five round trips of the org's API
allocation to learn what was knowable here. The cron counts those separately
from real Salesforce errors, so a blocked lead does not leave the integrations
card red while the org is perfectly healthy.

**The ask is to make `Phone__c` and `Country_Code__c` optional.** Until then,
roughly a third of leads will not reach the CRM. When it changes, the backlog
replays with one statement:

```sql
update enquiries
set crm_sync_state = 'pending', crm_attempts = 0, crm_next_attempt_at = now()
where crm_sync_state = 'failed'
  and crm_last_error like 'Blocked locally%';
```

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

## Open questions for Levarus

Sent 22 Sept · the 23 Sept revision answered **9, 10 and most of 11**. The
rest are outstanding, and two new ones have been added by that revision.

### Listings — Salesforce to website

1. Does a Property/Listing object exist? What is its API name?
2. Full field dictionary: API names, types, picklist values, required flags.
3. How do we read it — SOQL over REST, Composite, or a named Apex service?
4. Is `LastModifiedDate` filterable, so we can pull a delta rather than the
   whole catalogue every run?
5. Photographs: stored in Salesforce as `ContentVersion`, or hosted
   elsewhere? If in Salesforce, how are the binaries fetched?
6. Which field carries sold / withdrawn / off-market, and what do we observe
   when a record is deleted?
7. Any Arabic content in Salesforce, or do all `_ar` twins stay CMS-owned?
   (Per [ADR-0008](decisions/ADR-0008-machine-generated-arabic-first-draft.md)
   they should stay ours. Confirm rather than assume.)
8. Daily API request allocation on the org.

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

## Design rules for Phase 3 (listings in)

Written down now because they are the decisions that are expensive to reverse
after the first sync has run.

- **Field-level ownership, not row-level.** Salesforce owns commercial facts
  — price, beds, baths, area, permit number, status. The CMS owns everything
  Salesforce has no concept of: every `_ar` twin, `seo`, `flags.labels`,
  `slug`, `short_description`, media ordering, `assigned_agent_id`. The sync
  writes only its own columns. Anything less careful erases months of Arabic
  work on its first run.
- **Never auto-publish.** Inbound rows land as `draft`.
  `lib/publishability.ts` requires a developer, a sale form, a valid
  unexpired permit, a price, a title and a slug; a Salesforce record will not
  satisfy all six, and a human should be the one who decides a page goes
  live.
- **Never hard-delete.** A listing disappearing in Salesforce maps to
  `off_market`, never to a removed row — see
  `lib/queries/read-failure.ts` for why a 404 on this site is expensive.
- **Poll, do not subscribe.** Change Data Capture and Pub/Sub both want a
  long-lived connection, which Vercel's model cannot hold. A cron reading a
  `LastModifiedDate` watermark restarts cleanly and matches
  [ADR-0003](decisions/ADR-0003-vercel-cron-over-inngest.md). A
  Salesforce-pushed webhook can be added later as a latency enhancement, the
  same two-layer shape as ADR-0001 and ADR-0002.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Ask list to Levarus; rotate the sandbox secret | Sent |
| 1 | Leads out: client, mapper, queue, cron, admin card | **Built** |
| 2.5 | Exactly-once upsert, real picklists, required-field guard | **Built** |
| 2 | PDPL: erasure and access requests reach the CRM | **Built** |
| 3 | Listings in: ingest core, field mapper, dry-run, admin status | Blocked on Phase 0 |
| 4 | Media ingest from Salesforce into the `media` bucket | Blocked on Q5 |
| 5 | Review queue for Salesforce-sourced drafts | After Phase 3 |
