# Salesforce integration

Two directions, built separately, only one of which exists today.

| Direction | What it does | Status |
|---|---|---|
| **Leads out** — website → Salesforce | Every public enquiry becomes a `Lead__c` record | **Phase 1, built** |
| **Listings in** — Salesforce → website | Properties created by the CRM team appear in the catalogue | Not started — blocked on the vendor |

The vendor doc we were given (*Lead Creation API — Levarus Solutions*,
18 Sept 2026) covers **only** the first direction. The listing sync, which is
the larger half of the brief, is currently unspecified: there is no documented
object, no field list, no read endpoint and no answer on where photographs
live. The open questions below are the whole of what is needed to start it.

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
| `Lead_Source__c` | constant `"Website"` | The only value the doc evidences. |
| `Inquiry_Type__c` | property `mode`, else enquiry `source` | **Only `"Buy"` is mapped** — see below. |
| `Property_Reference__c` | `properties.reference` | `BAZ-AD-04891`. Omitted for non-property leads. |
| `Description__c` | `enquiries.brief_raw` + metadata | See below. |

**On `Inquiry_Type__c`.** It is a restricted picklist and we have never been
given its value set. Sending a value Salesforce does not recognise fails the
create with `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST` and loses the lead;
sending nothing leaves the field blank, which an advisor can fix in ten
seconds. So the map in `lib/salesforce/leads.ts` is deliberately incomplete —
`rent`, `off_plan` and `commercial` are `null` and emit nothing. Filling them
in is a one-line change per mode once question 10 is answered.

**On `Description__c`.** `Lead__c` has no field for the form a lead came
from, the language it was written in, its budget or its timeline. Rather than
drop that, it is appended under the visitor's own message as labelled lines,
including the Bazar enquiry UUID — which is the only correlation back to this
database until there is a real external ID field.

### Known defect: at-least-once delivery

There is no field on `Lead__c` marked **External ID**, so the only available
verb is `POST`. If the connection drops between Salesforce committing the
record and us writing `crm_external_id`, the next cron run creates the lead
again. `crm_attempts` caps the blast radius at five; it does not prevent the
duplicate.

This is not fixable from our side. It needs one field on the object, after
which setting `SALESFORCE_LEAD_EXTERNAL_ID_FIELD` switches the client to
`PATCH sobjects/Lead__c/<field>/<uuid>` — Salesforce's upsert, exactly-once
by construction. That path is written and tested already. It is question 9,
and it is the single most valuable thing the Salesforce team can do for this
integration.

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

Sent <!-- date --> · answers land here as they arrive.

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

9. **A field on `Lead__c` marked External ID**, so we can upsert. See above.
10. Full picklist values for `Inquiry_Type__c` and `Lead_Source__c`.
11. Which fields are required, what are the text lengths, and what does an
    error response look like?
12. Separate Connected App credentials for production, over a secure channel.

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
| 2 | PDPL: erasure and access requests reach the CRM | **Built** |
| 3 | Listings in: ingest core, field mapper, dry-run, admin status | Blocked on Phase 0 |
| 4 | Media ingest from Salesforce into the `media` bucket | Blocked on Q5 |
| 5 | Review queue for Salesforce-sourced drafts | After Phase 3 |
