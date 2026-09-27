# Page Builder

Campaign landing pages, assembled in `/admin/page-builder` and served at
`/lp/<slug>`. Built for the marketing manager to use weekly without design or
engineering input.

## The idea in one paragraph

The front end already contains ~40 designed, mobile-audited section components.
The gap was never design — it was that none of them were reachable from a CMS
surface a non-engineer could compose. So the catalogue is a **curation of
existing sections**, not a design surface: every entry renders through a
component already shipping on `/`, `/buy`, `/rent`, `/about`, `/services/*`,
`/areas/[slug]` or `/developments/[slug]`. That is what makes
"mobile-optimised out of the box" a structural property rather than a promise
repeated per block.

## Where it sits among the content systems

| | `pages.blocks` | Master pages | Section library | **Page Builder** |
|---|---|---|---|---|
| Route | `/pages/[slug]` | 16 fixed routes | none — it renders inside others | `/lp/[slug]` |
| Composition | open, 5 generic primitives | **fixed** in code | one section, no page | **open**, designed sections |
| Content | editable | editable | editable | editable |
| Images | never resolved — placeholder art only | real | real | real |
| Draft/live split | none | none | none | **yes** |
| Storage | `pages.blocks` | `pages.blocks` under `master/` | `pages.blocks` under `subpage/section/` | `landing_pages` |

Master pages deliberately kept their fixed composition
(`lib/master-pages/types.ts:1-15`). The Page Builder is a separate system because
a campaign page needs both halves: designed sections, arranged freely.

### Shared content: the `testimonials` block is the exception

Every other block owns its copy, which is right for a campaign page — it exists
nowhere else, which is why `document.ts` goes to such lengths never to lose it.
Client testimonials are the opposite: the same reviews are already on the home
page, so a per-block copy would mean the site quoting one client two ways the
first time somebody fixed a typo on one page.

So `testimonials` declares `needs: ["testimonials"]` and reads the section
library (`lib/master-pages/library.ts`, edited at
`/admin/pages/sub/section/testimonials`). What the block owns is what belongs to
*this* page: the eyebrow, the heading, and how many cards to show. Two blocks on
one page still make one fetch — `collectDataRequest` asks for the largest slice
anyone wanted and each adapter re-slices.

"How many" defaults to **all of them**, and the list holds up to
`TESTIMONIALS_MAX` (24). The cards render as a carousel rather than a three-up
grid, so the count is an editorial choice with no layout ceiling. Parse the
stored value with `testimonialLimitOf` and not by hand — "all" is a legal value
and `Number.parseInt("all") || 3` silently meant three.

If you add a second shared section, it goes in the library and follows this
shape. Do not copy shared copy into `defaults`.

`partners` is the second: the banking and regulatory logos from
`/admin/pages/sub/section/partners`, read with the cached `getPartners` — the
same list the home page and /about carry. Its words start as
`PARTNER_BAND_DEFAULTS`, the band's shipped wording.

## Project sections

The `project` group is a project's own page, taken apart: **Key facts**
(`ProjectFactsBand`), **Payment plan** (`PaymentPlanSection`, calculator and PDF
included), **Master plan** (`MasterPlanFigure`, the site plan with its pins),
**Floor plans** (`UnitFloorPlans`, with the project's own layout gate) and
**Location map** (`MapEmbed`). Each block names a project (`values.development`)
and draws *that project's* section through the component
`/developments/[slug]` uses, so a campaign never retypes a payment schedule
that then drifts from the record. What the editor owns is the framing —
eyebrow, heading, standfirst — and those default to the wording every project
page publishes (`lib/master-pages/development-page.ts`).

Four rules hold them together:

- **One read for all of them.** `lib/queries/landing-projects.ts` reads every
  project the page names in one PostgREST call, embedding the unit inventory
  and the unit types only when a section on the page draws them. The blocks
  declare `sharedQuery: "projects"`, and the gate charges a shared query
  **once per page** — five project sections cost one query, which is what the
  resolver spends. `queryCost` stays per block for list-shaped inventory.
- **No pick, no section.** `pickRequired` is the single-record twin of
  `rowsRequired`: a project section with no project draws nothing, and the
  editor row and the gate both say so. The advisor card uses it too.
- **Missing data is advisory.** A picked project with no payment plan (or site
  plan, layouts, map pin) renders nothing for that section — a catalogue
  state, like an unpublished pick, so the gate never refuses on it. The editor
  says so on the row (`blockCatalogueGap`), from `projectFeaturesOf`, which
  applies the same tests the adapters do; `project-sections.test.ts` holds the
  two to each other.
- **Pick the project once.** A new project section starts on the project the
  page already shows (`inheritPick`), and the **Project launch** preset asks
  for the project at creation and writes it into every project section.

The master plan figure was lifted out of the project page rather than copied,
so the two cannot drift; the project page's own band around it is unchanged.

## Record pickers in the editor

A select whose `optionsKey` seeds carry a `detail` renders as `RecordPicker`
(`_fields/record-picker.tsx`) instead of a native `<select>`: photo, the mono
reference line, the facts that tell two records apart (beds, baths, size), the
price, and a sale/rent chip — with a search box that matches every word of the
query against all of it, and a list that refuses the same listing twice. The
seeds are built by `_fields/record-seeds.ts`, shared with the home page's
featured-row editor. It exists because a title is not an identifier here:
three live listings are called "Yas Riva Reserve", all on Yas Island. Seeds
without a `detail` (forms, areas) keep the plain select.

## Files

```
lib/page-builder/
  types.ts            BlockDef · BlockInstance · ResolvedBlock · budgets · slug rules
  catalogue.ts        BLOCK_DEFS · getBlockDef · newBlockInstance · mintBlockId
  blocks/             the block definitions, grouped as the picker shows them
                      (project.ts: the five project sections)
  presets.ts          4 starting layouts (+ Blank)
  document.ts         parse · resolve · validate — and the data-loss rules
  data.ts             collectDataRequest (pure) · resolveLandingData (batched)
  adapters.ts         values → component props, one pure fn per block
  publishability.ts   evaluateLandingPublishability — pure, 11 blockers
                      · landingQueryCost
  content-gap.ts      which sections would render nothing — editor + gate;
                      what a picked project lacks — editor only

lib/queries/landing-pages.ts     public + admin reads
lib/queries/landing-projects.ts  every project section's data, one read
lib/schemas/landing-page.ts      metadata zod + slug rules

app/[locale]/(admin)/admin/_fields/       FieldEditor / ImagePicker / UploadButton
                                 (extracted from the master-page editor; shared)
                                 · RecordPicker + record-seeds (listing,
                                 project and advisor pickers)
app/[locale]/(admin)/admin/page-builder/  list · new · editor · preview · actions
app/[locale]/(public)/lp/[slug]/          ISR route + the renderer switch

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
`deprecated: true`. `catalogue.test.ts` holds frozen `KNOWN_TYPES_V1` /
`KNOWN_TYPES_V2` lists that fail the build if you try. A key added later goes in
the later list rather than being backdated into V1 — which shipped when is the
fact those lists carry.

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

That rule's glob names the route as `app/*/(public)/lp/**`. It used to read
`app/(public)/lp/**`, and when the public tree moved under `app/[locale]/` it
matched nothing — the renderer could import a query module with no error. A
`[locale]` in a glob is a character class, so the segment has to be a `*`.

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
- Five new components exist (`feature-rows`, `prose-band`, `cta-band`,
  `image-band`, `project-facts-band`), and one was lifted out of the project
  page rather than written (`master-plan-figure`); everything else was
  already audited.

### 6. A block must be visible the moment it is added

Every list-driven component renders **nothing** when its list is empty — a
heading over an empty grid reads as a broken page, so `_render.tsx` drops the
whole section. Shipping the blocks with `items: []` therefore made "add
section" a no-op: a page assembled from the `lead_gen` preset published with
four sections and two of them missing from the live URL, with the editor, the
save and the publish gate all silent about it.

So a block either **ships with rows** — the copy already live on /buy,
/services or the home page, never invented for the catalogue — or declares
`rowsRequired` and is reported by `lib/page-builder/content-gap.ts`, which the
editor reads to mark the row and the gate reads to refuse the publish. Two
blocks take the second path, because their rows can only be campaign-specific:
`feature_scroll` and `featured_properties` on the hand-picked source.

Blocks whose emptiness is a *catalogue* state rather than a blank the editor
left — `featured_developments` with no picks falls back to the three most
recent, `testimonials` reads the section library — declare neither. Blocking a
publish on those would take a campaign page down because an unrelated record
went off-market, which is the same rule pick resolution already follows.

## Adding a block

1. Define it in `lib/page-builder/blocks/*.ts`. `defaults` must equal what the
   component renders today, so adding the block changes nothing visually —
   including its list fields, per decision 6. If the rows can only be
   campaign-specific, declare `rowsRequired` instead.
2. Add an adapter in `adapters.ts` — pure, `(values, data) => props`.
3. Add a case in `app/[locale]/(public)/lp/[slug]/_render.tsx` **and** its key to
   `RENDERED_KEYS`. `catalogue.test.ts` fails if the two disagree.
4. If it needs data, declare `needs` + `queryCost` and teach `data.ts` how to
   fetch it — in the batch, never in the component. If it reads a fetch other
   blocks share (a project, an advisor), declare `sharedQuery` instead of
   `queryCost`.
5. If it is a view of one record, declare `pickRequired` — and have the
   adapter return null when the pick doesn't resolve.
6. Add its key to the newest `KNOWN_TYPES_V*` list in `catalogue.test.ts`.
7. `render.test.tsx` picks it up automatically and asserts it produces DOM.

## The publish gate

`evaluateLandingPublishability` — pure, eleven blockers, shared by the publish
card and the action so the button and the server can't disagree.

Title · slug valid and unreserved · at least one renderable section · no
unavailable sections · required copy filled · exactly one H1 · alt text on every
picked photo · every form still live in `/admin/forms` · every link resolvable ·
within the query budget · no section that would render nothing.

The budget is `landingQueryCost`: each block's `queryCost`, plus one for each
distinct `sharedQuery` on the page. A full Project launch page — five project
sections — costs one.

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
| `content-gap.test.ts` | **the visibility guard** — no preset assembles an invisible section, and an emptied list is reported |
| `adapters.test.ts` | untouched defaults produce the component's own behaviour |
| `project-sections.test.ts` | project/advisor adapters; the editor's "project has no …" note and the missing section are one fact |
| `render.test.tsx` | every block produces DOM; each preset has exactly one H1; `pickRequired` blocks draw nothing unpicked |
| `_block-editor.test.tsx` | reorder, duplicate, hide, unknown-block card, 44px targets, inherited project picks |
| `_fields/record-picker.test.tsx` | the listing picker shows what tells same-titled listings apart, searches it, refuses duplicates |
| `lib/queries/landing-projects.test.ts` | one select, embeds only on request, Arabic folds — except the payment plan, which must not |
| `lib/queries/landing-pages.test.ts` | public select never names `draft_blocks`; every action names a role constant |

E2E (`e2e/page-builder.spec.ts`) names **no slug** — a campaign page is designed
to be unpublished when the campaign ends, and CI runs against production.
Subjects are discovered from the sitemap and the specs skip cleanly when nothing
is published.
