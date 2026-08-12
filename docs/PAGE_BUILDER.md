# Page Builder

Campaign landing pages, assembled in `/admin/page-builder` and served at
`/lp/<slug>`. Built for the marketing manager to use weekly without design or
engineering input.

## The idea in one paragraph

The front end already contains ~40 designed, mobile-audited section components.
The gap was never design — it was that none of them were reachable from a CMS
surface a non-engineer could compose. So the catalogue is a **curation of
existing sections**, not a design surface: every entry renders through a
component already shipping on `/`, `/buy`, `/rent`, `/services/*` or
`/developments/[slug]`. That is what makes "mobile-optimised out of the box" a
structural property rather than a promise repeated per block.

## Where it sits among the three content systems

| | `pages.blocks` | Master pages | **Page Builder** |
|---|---|---|---|
| Route | `/pages/[slug]` | 16 fixed routes | `/lp/[slug]` |
| Composition | open, 5 generic primitives | **fixed** in code | **open**, 14 designed sections |
| Content | editable | editable | editable |
| Images | never resolved — placeholder art only | real | real |
| Draft/live split | none | none | **yes** |
| Storage | `pages.blocks` | `pages.blocks` under `master/` | `landing_pages` |

Master pages deliberately kept their fixed composition
(`lib/master-pages/types.ts:1-15`). The Page Builder is the third system because
a campaign page needs both halves: designed sections, arranged freely.

## Files

```
lib/page-builder/
  types.ts            BlockDef · BlockInstance · ResolvedBlock · budgets · slug rules
  catalogue.ts        BLOCK_DEFS · getBlockDef · newBlockInstance · mintBlockId
  blocks/             the 14 definitions, grouped as the picker shows them
  presets.ts          3 starting layouts (+ Blank)
  document.ts         parse · resolve · validate — and the data-loss rules
  data.ts             collectDataRequest (pure) · resolveLandingData (batched)
  adapters.ts         values → component props, one pure fn per block
  publishability.ts   evaluateLandingPublishability — pure, 10 blockers

lib/queries/landing-pages.ts     public + admin reads
lib/schemas/landing-page.ts      metadata zod + slug rules

app/(admin)/admin/_fields/       FieldEditor / ImagePicker / UploadButton
                                 (extracted from the master-page editor; shared)
app/(admin)/admin/page-builder/  list · new · editor · preview · actions
app/(public)/lp/[slug]/          ISR route + the renderer switch

supabase/migrations/0099_landing_pages.sql
```

## Five decisions worth knowing before you change anything

### 1. Unknown blocks are kept, never dropped

`parseBlocks` and `parseStoredSections` both drop items they don't recognise,
silently. That is safe there because those documents are *derived* — the
registry can regenerate any master-page section.

A landing page's copy is **authored**. It exists nowhere but that jsonb. So a
block whose `type` this build doesn't know is kept in the document, skipped at
render, and shown in the editor as a locked card. Its values are re-read from
the database on save, never taken from the client, so a stale tab can reorder or
hide it but cannot corrupt it.

**Consequence: never rename a `BlockDef.key`.** Add a new one and mark the old
`deprecated: true`. `catalogue.test.ts` holds a frozen `KNOWN_TYPES_V1` that
fails the build if you try.

### 2. Data is fetched once, up front

`BlockDef.needs` declares what a block wants; `collectDataRequest` unions and
dedups across the whole document; `resolveLandingData` issues the queries. No
block fetches for itself.

This is not tidiness. None of the catalogue query modules is React-cached, so a
component calling `listPublishedDevelopments()` twice really does make two
round-trips — and `LISTING_FIELDS` pulls a nested `property_media` for every
role and throws all but the hero away. Eight featured rails self-fetching would
be eight joined catalogue queries on every revalidation.

Ceiling: **≤ 8 round-trips for any page**, asserted in `data.test.ts`. An eslint
`no-restricted-imports` rule stops `_render.tsx` and `adapters.ts` importing
query modules, `next/headers` or the cookie-aware Supabase client at all.

### 3. Saving is not publishing

`saveLandingBlocks` writes `draft_blocks` and never `blocks`. Everywhere else in
this CMS a save on a published row is a deploy; a marketing manager assembling a
campaign over an afternoon would otherwise publish every intermediate state.

- **Publish** = `blocks = draft_blocks; draft_blocks = null` — a snapshot.
- **"Unpublished changes"** = `draft_blocks IS NOT NULL`. No second flag.
- **Preview** lives at `/admin/page-builder/[id]/preview`, inside the `(admin)`
  group rather than on a token URL, and renders the *same* `LandingRenderer` the
  public route does.

`published_at` is set only when null, so republishing doesn't reset it.

### 4. Media must stay registered

`lib/queries/media-usage.ts` has a `source("landing_pages", …)` walking **both**
`blocks` and `draft_blocks`. Without it every image a marketing manager picks
reads as `unused`, `canTrash` says yes, and `/admin/media` offers a delete
button that punches a hole in a live campaign page.

Every media reference must be the `ImageValue` shape `{media_id, alt, label}` —
`collectMediaIds` keys on that literal property name.

### 5. Mobile is inherited, then guarded

- One responsive tree, CSS breakpoints. `isPhoneRequest()` is banned here; it
  would also drop the route out of ISR.
- The renderer's wrapper carries `overflow-x-clip [&>*]:min-w-0`, so one
  section's runaway grid track can't make the page scroll sideways.
- `next/image` always `fill` + explicit `sizes` — `media_assets.width/height`
  are never written by any upload path.
- Four new components exist (`feature-rows`, `prose-band`, `cta-band`,
  `image-band`); everything else was already audited.

## Adding a block

1. Define it in `lib/page-builder/blocks/*.ts`. `defaults` must equal what the
   component renders today, so adding the block changes nothing visually.
2. Add an adapter in `adapters.ts` — pure, `(values, data) => props`.
3. Add a case in `app/(public)/lp/[slug]/_render.tsx` **and** its key to
   `RENDERED_KEYS`. `catalogue.test.ts` fails if the two disagree.
4. If it needs data, declare `needs` + `queryCost` and teach `data.ts` how to
   fetch it — in the batch, never in the component.
5. `render.test.tsx` picks it up automatically and asserts it produces DOM.

## The publish gate

`evaluateLandingPublishability` — pure, ten blockers, shared by the publish card
and the action so the button and the server can't disagree.

Title · slug valid and unreserved · at least one renderable section · no
unavailable sections · required copy filled · exactly one H1 · alt text on every
picked photo · every form still live in `/admin/forms` · every link resolvable ·
within the query budget.

Two advisory-only checks (hero present, search visibility decided) and two
deliberate non-checks: **contrast** is unreachable because every colour is a
closed `select`, and **pick resolution** is not validated because a listing can
be unpublished after the fact and the renderer already drops what it can't
resolve — the same rule `lib/master-pages/index.ts:253` states.

## Testing

| Spec | Guards |
|---|---|
| `catalogue.test.ts` | key stability, defaults↔fields, renderer parity, preset sanity |
| `document.test.ts` | **the data-loss guard** — unknown blocks round-trip byte-identically |
| `data.test.ts` | **the egress guard** — call counts, dedup, zero-query pages |
| `publishability.test.ts` | one case per blocker |
| `adapters.test.ts` | untouched defaults produce the component's own behaviour |
| `render.test.tsx` | every block produces DOM; each preset has exactly one H1 |
| `_block-editor.test.tsx` | reorder, duplicate, hide, unknown-block card, 44px targets |
| `lib/queries/landing-pages.test.ts` | public select never names `draft_blocks`; every action names a role constant |

E2E (`e2e/page-builder.spec.ts`) names **no slug** — a campaign page is designed
to be unpublished when the campaign ends, and CI runs against production.
Subjects are discovered from the sitemap and the specs skip cleanly when nothing
is published.
