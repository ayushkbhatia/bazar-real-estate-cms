# Follow-ups

Cross-session backlog. Anything you noticed during a PR that you didn't want
to bloat the change with — drop it here. Pick something off when you have a
slot.

## How to use this file

- **Add an entry** when you finish a PR and spot a real follow-up. Include
  enough context that a stranger (or future-you) can act without your
  memory.
- **Claim an entry** by editing the line to add `→ <branch-or-PR>` once you
  start it. Don't squat — only claim when you're actually doing the work.
- **Remove an entry** when the PR that addresses it merges. Keep this file
  small.
- **Don't use this for bugs.** GitHub issues for bugs. This is for "nice to
  have, not yet justified."

## Format

```
- [scope] One-line summary.
  Why it exists. Optionally: file paths, the PR that surfaced it, what
  "done" looks like.
```

`[scope]` is a short tag — `[i8]`, `[realtime]`, `[deals]`, `[infra]` — so a
quick grep can show "what's outstanding in my area."

---

## Open

- [i18n] The glossary matcher rejects correct Arabic over a shadda or an
  article.
  Surfaced running `lib/i18n/mt/validate.ts` over the shipped search-header
  defaults (PR after #448). `off-plan-sale.subtitle` — curated copy that came
  from `messages/ar/search.json`, not a machine draft — fails two glossary
  stems: `مطوّر` does not contain `مطور` because of the shadda, and
  `بخطة سداد` does not contain `السداد` because it is indefinite. The docblock
  in `lib/i18n/mt/glossary.ts` promises a stem that "survives inflection" and
  the `extraStems` field already exists for broken plurals, so neither case is
  outside its intended scope. Done = `termRe`/the stem check normalises Arabic
  diacritics (and ideally tolerates the definite/indefinite pair), and the
  allowlist entry in `lib/master-pages/search-headers.test.ts` is deleted —
  that spec already fails if the entry starts passing, so it will tell you.
  Worth checking how many strings elsewhere are silently kept English by the
  same two causes before deciding the shape of the fix.
- [i18n] The hero search panel and the "Insights" nav tab are still English on
  `/ar`.
  Spotted while fixing locale stickiness (the whole navbar is Arabic on `/ar`
  except that one tab). Two separate causes, worth confirming before either is
  touched: the megamenu tab label comes from the DB (`megamenu_tabs`) and its
  `title_ar` looks unpopulated, while `HeroSearch`'s mode tabs
  ("Buy / Rent / Off-Plan / Commercial"), its "Area, building, community or
  emirate" placeholder and its "Search" button are literals in
  `app/[locale]/(public)/_components/hero-search.tsx` that no message wave has
  reached. The hero is the first thing an Arabic visitor sees, so this is the
  most visible remaining hole. Done = both read from `messages/` (or the DB
  twin), with `no-unextracted-literals` covering the hero.
- [i18n] The `footer` message namespace is now read by nothing.
  The footer's copy moved into `footer_*` tables (migrations 0112/0113), so
  `messages/en/footer.json` and `messages/ar/footer.json` — `rights`, `orn`,
  `privacy`, `terms`, `cookies`, `sitemap` — have no consumer left. They were
  kept rather than deleted because removing a namespace also means editing
  `NAMESPACES` in `lib/i18n/namespaces.ts`, the `pickClientMessages` case in
  `lib/i18n/namespaces.test.ts:238`, and the hardcoded list in
  `lib/i18n/icu.test.ts:173` — i18n infra churn that had nothing to do with the
  footer PR. "Done" is deleting both files and those three references. Note the
  Arabic in them is the client's own wording and is already carried into the
  0112 seed, so nothing is lost.

- [off-plan] The landing's "View all in <area>" links go to a page that cannot
  answer them.
  `app/[locale]/(public)/off-plan/page.tsx` builds `viewAllHref` as
  `/off-plan/search?area=<slug>`, but that route searches the `properties`
  table for `mode = 'off_plan'` — individual units — while the rail above it
  shows `developments`. For an area with projects but no unit rows the link
  lands on an empty result set: `/off-plan/search?area=hudayriyat-island`
  returns 0 despite three published projects there. Verified 2026-08-11; the
  area guide worked around it by anchoring in-page instead. "Done" is either an
  area filter on a developments listing, or repointing these at `/off-plan`
  with the group's anchor.

- [e2e] Two developer specs skip rather than assert when their subject is draft.
  `developers.spec.ts` guards `/developers/aldar` and the MODON dedup case with
  `test.skip` on a 404, which is honest but means the merge-dedup invariant
  goes unchecked whenever MODON is unpublished. "Done" is discovering a
  both-sources developer from the grid the way `_helpers.ts` discovers
  properties, areas and categories, so the assertion always runs.

- [forms] Wire the two bespoke lead forms to the shared renderer.
  `/services/sell` (two-step owner wizard) and the valuation report gate (OTP)
  are registered in the Forms Manager as `control: "copy"`: their visibility,
  their wording and their responses are managed, but their field lists are
  read-only because the components draw their own inputs. Expressing them
  through `FormRenderer` needs two things it doesn't have — a `step` on
  `FormFieldDef`, and a way for a handler to interrupt between validation and
  submit. "Done" is flipping both to `control: "full"` with no visible change
  to either page.

- [forms] Newsletter signups on the home teaser and article sidebar don't read
  their CMS copy.
  `NewsletterSignup` takes an optional `form` prop and only /insights passes
  it, so the other two surfaces still show the built-in "Subscribe". They log
  their submissions either way. "Done" is threading the form through
  `insights-teaser.tsx` and `insights/[slug]/_components/article-rail.tsx`, or
  giving each surface its own registry entry if the client wants them worded
  differently.

- [services] `/services/consulting` and `/services/consultation` both exist.
  The first is the old seed-driven "Consulting" page (senior-advisor hours,
  AED 950/hr) and is no longer linked from the megamenu; the second is the
  new client-approved Property Consultation landing. Nothing links to the
  former except `app/[locale]/(public)/sitemap/page.tsx`. "Done" is a decision:
  keep it as a distinct service, or redirect it at the new page and drop the
  seed entry.

- [areas] Thirteen area guides have no market statistics.
  The area-guide restructure gave every area the thirteen-band template, but
  only the eleven areas in the content deck came with sale and rental index
  figures. The other thirteen (Al Raha, ADGM, Corniche, Zayed City, Mussafah,
  KIZAD, Nurai Island, Al Raha Gardens, Hidd Al Saadiyat, Mamsha Al Saadiyat,
  Saadiyat Lagoons, Saadiyat Reserve, Yas Acres) carry either a structural
  statistic or nothing, and the band hides itself where there is nothing —
  see the header of `supabase/migrations/0092_area_guide_content_researched.sql`
  for why nothing was invented. Done looks like: index figures typed into
  /admin/pages/sub/area/<slug> → Property market statistics, with the month
  they belong to in the footnote. No code change needed.
  `lib/master-pages/area-guide-content.test.ts` guards the "no invented index"
  rule for the migration file, not for CMS edits.

- [areas] Landmark and community photos are all placeholders.
  0091 and 0092 seed every landmark and community row with an empty image
  reference and a placeholder caption, so the grids draw brand placeholder art
  rather than photography. Each row has an image picker in the CMS. Done looks
  like: photos attached for at least the eleven deck areas. The cover-image
  brief written by the content deck is stored per area under the Cover image
  section ("Image brief"), so whoever sources them has the art direction.

- [shortlist] Two listing surfaces still can't be shortlisted.
  The card-level shortlist button is now default-on for anything rendering
  `ListingCard` with a `propertyId`, but two surfaces draw their own markup
  and were left alone: the MapLibre marker popup
  (`app/[locale]/(public)/_components/map-view.tsx`, built with `setHTML()` — a
  string, so no React button can mount without reworking it into a portal),
  and the concierge chat result card
  (`app/[locale]/(public)/concierge/_components/inline-card.tsx`, which is
  text-only, carries no property id, and is deliberately two lines tall).
  "Done" is either both wired up or a decision recorded that they stay out.

- [compare] `/tools/compare` breaks its own client components on soft nav.
  Two symptoms, near-certainly one cause. (1) The route throws "Hydration
  failed because the server rendered HTML didn't match the client" on a
  plain `?ids=<two published ids>` load. (2) After any *client-side*
  navigation within the route, client components inside the re-rendered
  slot grid never mount — the server-rendered markup around them is fine
  (the dashed empty-slot card and its text render), but the interactive
  child is absent from the DOM while still present in the RSC payload.
  Reproduce (2) without any of the shortlist work by clicking a per-card
  remove control: the slot count updates and the picker trigger vanishes.
  Neither is from this branch — both reproduce with the picker changes
  stashed. The picker sidesteps it by navigating with a plain `<a>`
  (see the comment in `picker-drawer.tsx`); that workaround should come out
  once this is fixed. "Done" is a clean console plus client components
  surviving a soft nav on that route.

- [shortlist] "Recently viewed" in the compare picker has no source.
  `app/[locale]/(public)/tools/compare/_components/picker-drawer.tsx` — the Saved tab
  now reads the real shortlist, but nothing in the app records views since
  customer accounts were removed
  ([ADR-0005](docs/decisions/ADR-0005-remove-customer-accounts.md)), so that
  tab keeps an honest empty state next to a working one. Either give it a
  localStorage-backed source or drop the tab; leaving a permanently-empty
  tab beside a live one is the worst of the three.

- [shortlist] Eviction at `SHORTLIST_CAP` is still silent.
  `components/brand/compare-button.tsx` drops the oldest id when you save
  past the cap (`next = [...ids.slice(1), propertyId]`) with no toast and no
  visible change on the card that fell out. Much harder to reach now the cap
  is 25 rather than 4, so this is a polish item, not the correctness problem
  it was — but a visitor who does hit it still gets no explanation.

- [developments] Click-test the units & floor plans admin card.
  `app/[locale]/(admin)/admin/pages/sub/development/[slug]/_unit-plans-card.tsx` (~450
  lines) shipped in #263 without ever being exercised in a browser — the
  agent that wrote it had no staff credentials for `/admin/*`. Its server
  actions (`_unit-actions.ts`), the schema and both RLS directions are
  verified against the database; the UI is not. Walk one project through
  save, reorder, hide, the media-library picker, add/remove a layout, and
  deleting a unit type (which cascades its layouts). All 19 projects now
  carry seeded records to edit, so there is plenty to click. "Done" is
  either a clean pass or bugs filed.

- [infra] Consider running the migration-number check as a pre-commit hook.
  `scripts/check-migrations.sh` runs in CI and via `npm run db:check`, which
  catches a duplicate ordering key at push time. A hook would catch it at
  rebase time instead, which is when it is actually cheap to fix. Not done
  now because the repo has no hook infrastructure at all and adding husky
  for one check is a poor trade.

- [megamenu] Media library picker for featured tiles.
  `megamenu_featured_tiles.media_asset_id` is in the schema (FK to
  `media_assets`) but the admin editor at `app/[locale]/(admin)/admin/navigation/
  [slug]/_editor.tsx` doesn't render a picker yet — tiles fall back to the
  `bz-img` / `bz-img-dark` diagonal placeholder. When a tile picks an image
  asset, `components/brand/megamenu-tile.tsx` also needs an `image` variant
  branch that resolves the storage_key to a public URL.

- [megamenu] Entity picker for items (auto-fill label + href from target).
  `megamenu_items.target_kind` + `target_id` are nullable hints today. The
  editor lets you pick `target_kind` from a dropdown but `target_id` stays
  empty — you have to type `label` + `href` manually. Wire in a cascading
  picker: choose kind → search/list entities (areas, developers, pages,
  developments, articles) → on select, prefill label & href with overrides
  still allowed. Surfaced as v2 in the megamenu plan.

- [megamenu] Surface `/admin/navigation` link in the CMS sidebar.
  Blocked by the shared-files rule on `components/brand/cms-shell.tsx`.
  Add it to the "Admin" group with a `Navigation` (or `Menu`) lucide icon
  once parallel-work pressure is gone. Until then, the route is reachable
  by typing the URL or via "Site settings → Megamenu" (once the link is
  added on `app/[locale]/(admin)/admin/settings/page.tsx`).

- [megamenu] PostHog event for megamenu interactions.
  Capture `megamenu_tab_opened` (tab slug, source: hover|click|keyboard)
  and `megamenu_link_clicked` (tab slug, item label, href) in
  `components/brand/public-mega-nav.tsx` to learn which panels and links
  get used. Use the existing `posthog.capture` pattern from
  `components/brand/listing-card.tsx`.

- [i8] Regenerate `db/types.ts` after `0014_bulk_ops.sql` applies in prod.
  Server code in `lib/queries/bulk-operations.ts` + the action wrappers in
  `app/[locale]/(admin)/admin/properties/_bulk-actions.ts` currently cast through
  `unknown` for the new `bulk_operations` table. Once the migration lands
  in the production Supabase project, run `npm run db:types` and drop the
  casts. Surfaced by PR #67.

- [nav] React key warning in the mobile drawer (public tree only).
  Opening the hamburger drawer on a `(public)` page logs "Each child in a
  list should have a unique key prop. Check the render method of
  `TabsList`. It was passed a child from `PublicLayout`." Pre-existing on
  `main` (predates the drawer sign-in fix — confirmed the sign-in diff
  touches neither the `data.tabs.map()` nor `{footerSlot}`). Only fires
  when a `footerSlot` is passed, so the `(account)` tree (no footerSlot)
  is clean. Likely the `{footerSlot}` node interacting with the tab list
  render in `components/brand/public-mega-nav-mobile.tsx`; track down the
  unkeyed list. Blocked by the shared-files rule on `components/brand/*`.

- [nav] Delete `components/brand/public-nav.tsx` — now dead code.
  `app/(account)/layout.tsx` was its only consumer and now mounts
  `PublicMegaNav` instead, so nothing imports it. Left in place only
  because of the shared-files rule on `components/brand/*`. Its
  `AccountMenu` and `Wordmark` imports are shared with `public-mega-nav.tsx`
  and must survive the deletion. Delete once parallel-work pressure is
  gone; grep for `PublicNav` first to confirm it's still unreferenced.

## Recently done

(Move entries here briefly before deleting, so a `git log -p docs/FOLLOWUPS.md`
shows the trail.)

- [nav] Mobile drawer footer is now session-aware (this PR).
  `components/brand/public-mega-nav-mobile.tsx` no longer hardcodes a
  `/sign-in` link — it renders "Sign in" when signed out (unchanged) or
  "Signed in as <email>" + "Sign out" when signed in, via the new
  `lib/hooks/use-session-email.ts` (extracted from `AccountMenu`'s
  subscription). Fixes the wrong affordance the account tree always hit.

- [curated] `lib/queries/curated-listings.ts` hero embed fixed (P0
  launch-readiness). Swapped to the `property_media` join pattern from
  `listings-by-agent.ts`; added error logging so PostgREST failures no
  longer silently empty `/exclusive`, `/new-this-week`, `/price-drops`.

- [i5] Reassign-digest email shipped (P2 launch-readiness).
  `bulkReassignProperties` now fires a one-off digest to the
  newly-assigned agent via `bulkReassignDigestTemplate`. Single agent
  per call so no grouping needed; fire-and-forget so failures don't
  block the action response.

- [properties] Bulk-publish doesn't enforce the Developer gate or PoA-optionality.
  Surfaced by the listing-wizard PR (developer_id + publish overhaul). The
  single-property gate now requires a developer and treats Power of Attorney as
  optional (`poa_optional`), but `lib/queries/properties-bulk.ts`
  (`evaluateBulkPublishability`) shares `evaluatePublishability` and passes
  neither flag, so bulk-publish still ignores developer and still requires PoA.
  Left inconsistent because that file + its test are under the protected
  `lib/queries/properties*` glob. Decide whether bulk should match single-property.

- [properties] Publish role gate 404s marketing/support silently.
  `PROPERTY_ROLES = [admin, editor, agent]` in
  `app/[locale]/(admin)/admin/properties/[id]/_actions.ts`; `requireRole` throws
  `notFound()` for other staff, so marketing/support clicking Publish get a bare
  404 with no explanation. Show a "you don't have permission" message instead.

- [properties] permit-expiry cron auto-archives with no in-app warning.
  `app/api/cron/permit-expiry/route.ts` flips any published listing whose permit
  has lapsed to `archived` (emails admins only). Paired with the permit-expiry
  publish gate this is a re-publish lockout. Consider an in-app banner /
  soft-warning window before the hard archive.

- [brand] Dark mode still runs the old moss accent.
  The navy/teal/taupe recolor (M01–M29 handoff) deliberately left the `.dark`
  block in `app/globals.css` untouched — the handoff scopes dark mode out and
  says to flag it separately. `.dark` still redefines `--bz-accent/-hover/-soft`
  at moss hue 155, so dark mode shows the old green. Needs its own pass with
  client-approved dark-surface teal/navy values.

- [brand] `accent_token` storage key is still "moss" (now pointing at teal).
  `lib/schemas/site-settings.ts` swapped the hex (`moss: "#005777"`) so the CMS
  brand panel shows teal, but the stored key/name is still `moss` because
  renaming it means migrating stored `site_settings.accent_token` values.
  Rename to `teal` (with a data migration + update `site-settings.test.ts`
  literals) post-handover.

- [brand] Ink CTAs/dark bands intentionally kept ink, not navy.
  The recolor moved only the surfaces the handoff names (why/mission bands,
  category-tile scrims). Other `bg-bz-ink` dark CTAs and bands (chip-cloud CTA,
  mortgage hero band, area-map flyout CTA, insights aside, chat bubbles) stay
  ink by design. Revisit only if the client wants navy everywhere.

- [properties] Every property-form save silently resets three Sprint-8 fields.
  `normaliseEditInput` (`lib/schemas/property.ts`) coerces `bazar_verified` and
  `featured_on_homepage` to `false` and `advisor_note` to `null` when they're
  absent from the payload — and the edit form never renders them, so a plain
  Save on any listing wipes the Bazar Verified badge, the homepage feature
  toggle, and the advisor note. Fix: only include those keys when present in
  `raw` (and update the three `normaliseEditInput` cases in
  `lib/schemas/property.test.ts` that assert the coercion).

- [properties] Bulk publish doesn't check that a developer is set.
  `evaluateBulkPublishability` (`lib/queries/properties-bulk.ts`) never selects
  `developer_id`, so `has_developer` is undefined and the gate skips it — a
  listing that single-publish blocks can go live via the bulk dialog. Add
  `developer_id` to the row select/type once the existing catalogue is
  backfilled (most seeded rows have no developer today, so turning it on now
  would block bulk publish broadly).

- [properties] `properties.compliance` is now write-nothing, read-nothing.
  The publish gate no longer reads the Form A / title deed / NOC / PoA flags and
  the CMS no longer writes them (the `updateCompliance` action was removed with
  the Compliance card). The column and `propertyComplianceSchema` /
  `COMPLIANCE_LABELS` / `normaliseCompliance` are retained for the historic data
  and for whatever surface picks the paperwork trail back up. Drop them if a
  future sprint confirms the paperwork lives entirely outside the CMS.

- [media] Trash has a 30-day window in the copy but nothing purges it.
  The media library labels trashed assets "In trash Nd" against a 30-day
  window (`TRASH_WINDOW_DAYS` in `app/[locale]/(admin)/admin/media/page.tsx`), but only a
  human clicking "Delete permanently" ever removes the storage object. Either
  add a cron that purges expired + still-unused assets, or drop the countdown.

- [media] No bulk trash on the media library.
  The "Unused" filter makes a pile of dead files easy to find, then they have to
  be trashed one at a time. Add select-all + bulk trash over the filtered set
  (server side must re-verify usage per asset, as `trashMedia` already does).

- [media] Storage objects with no `media_assets` row are invisible.
  The usage index reasons from the DB outward, so it can't see files that exist
  in the `media` bucket without a row (failed uploads before the rollback
  landed, manual uploads via the Supabase dashboard). A reconciliation job would
  need to list the bucket and diff against `media_assets.storage_key`.

- [media] Three orphaned Sprint-7d components remain unwired.
  `_components/filters.tsx` (type/date/uploader), `quota-indicator.tsx` (needs a
  real bytes-used reading) and `upload-zone.tsx` (its drop handler still toasts
  "Sprint 9 wires the bulk upload action") are imported by nothing.
  `folder-rail`, `search`, `view-toggle` and `usage-badge` are now wired; the
  fake `trash.tsx` was deleted when the real trash view landed.

- [master pages] Section defaults are duplicated between code and registry.
  `lib/master-pages/pages.ts` holds each section's default copy, and most
  section components still carry the same literal as a fallback for callers
  that pass nothing. They can drift. Once every caller goes through
  `getMasterPageContent`, delete the component-level literals and let the
  registry be the only source.

- [master pages] Home hero copy is only editable on the full-bleed variant.
  `HeroForVariant` renders one of four heroes chosen in Settings → Brand; only
  `HeroFullBleed` (the default) takes copy overrides. Editing the hero fields
  while a different variant is selected has no visible effect. Either give the
  other three the same treatment or scope the fields to the active variant.

- [master pages] No preview or draft state.
  Saving a master page publishes immediately (it writes the `pages` row and
  revalidates). There's no "preview my changes" step and no draft/publish split
  the way the rest of the CMS has one. Worth adding before non-technical
  editors use it heavily.

- [master pages] Empty list = "keep the built-in list".
  A list field an editor never touches stays empty and the section renders the
  list it ships with (home FAQs, testimonials). Adding one item takes over the
  whole list. It's explained in the editor, but a clearer "override" toggle
  would beat the implicit rule.

- [sub-pages] Only the sections with static headings take a copy override.
  Master plan, payment plan, units, floor plans, location and the hero read
  `heading`/`intro` overrides; the rest build their headings from the record
  (developer name, area name) and ignore them today. Either wire the remaining
  sections or drop the fields from those section definitions so the editor
  stops offering a field that does nothing.

- [sub-pages] Floor-plan images aren't editable from the sub-page.
  Cover, site plan and the renders gallery are now, but floor plans come from
  `floor_plans` rows (each with a label, beds and area alongside the image), so
  they still need the developments editor. Folding them in means a list field
  that writes to a related table rather than to the section document.

- [sub-pages] The framework is development-only.
  `SUBPAGE_KINDS` has one member. Area guides and developer profiles are the
  obvious next kinds: add an entry to the registry, a section list, and an index
  route at `/admin/pages/sub/<kind>` — the block on the Pages index, the
  storage and the editor are already generic. `countSubPagesByKind` needs a
  query per kind.

- [master pages] Featured-project picks aren't validated against live records.
  The home page's off-plan section stores development slugs; the renderer drops
  any that no longer resolve and the editor flags them as "no longer
  available", but nothing warns the editor when a project they featured is
  later unpublished. A cron or a check on the developments publish action could
  surface "this project is featured on the home page" before it goes dark.

- [sub-pages] Area guide body copy still lives in `lib/seeds/areas`.
  The editor overrides the hero (eyebrow, heading, intro, position) and can
  reorder or hide any section, but stats, schools, amenities and the lifestyle
  dossier still read from the seed module and `area_guides`. Exposing those
  means list fields writing to `area_guides`, not to the section document.

- [blog] Trashed posts have no purge and no countdown.
  `/admin/blog?view=trash` keeps posts indefinitely until an admin deletes them
  for good. Same gap as the media library's trash — either add a cron that
  purges after N days or leave it deliberate and say so in the UI.

- [blog] No bulk archive or trash.
  Rows are actioned one at a time. Fine at the current volume; worth
  select-all + bulk once the list runs past a screenful.

- [admin] Server actions must be passed to client components by reference.
  `MasterPageEditor` takes its save/reset as props. Wrapping them in arrows in
  a server component — `{ save: (a, b) => saveThing(a, b) }` — makes them plain
  functions, and the page 500s with "Functions cannot be passed directly to
  Client Components". That shipped in #180 and #186 and broke both sub-page
  editors. TypeScript can't tell the two apart, so if another caller appears,
  consider a Playwright smoke test that loads each editor route.

- [areas] Deleting an area has no admin path.
  Areas can be created and edited but not removed. `areas.id` is referenced by
  properties, developments, area_guides and the megamenu, so a delete needs to
  decide between blocking on references and reparenting them — worth designing
  before adding the button.

- [amenities] Storage is labels, not codes — the handoff asks for codes.
  `properties.amenities` holds labels ("Beach access"), which is what the
  search facet matches via `contains` and what the public page prints. The
  design handoff wants stable ids so labels can be translated for the Arabic
  site. Switching means: apply 0059 (and decide the ~14 ambiguous values it
  lists), backfill every listing's array label→code, flip `valueOf()` in
  `lib/amenities.ts` to return `entry.code`, and re-point the facet. The UI
  needs no changes — that's why the indirection exists.

- [amenities] The search facet is a static snapshot of the taxonomy.
  `MoreFiltersDrawer` is a client component, so it reads `DEFAULT_AMENITIES`
  rather than the table. Entries an admin adds under Settings → Fields appear
  in the property editor and on property pages immediately, but in the facet
  only on the next deploy. Fix by passing the taxonomy down from the search
  page's server component.

- [amenities] Migration 0059 is written but unapplied.
  It adds the 15 amenities already in use that have no taxonomy entry. DDL/data
  apply is blocked on the stale PAT, so until it runs those listings keep
  showing their values under "not in the amenity list" in the editor.

- [developments] "Other projects by this developer" is still automatic.
  It lists the developer's other published projects; there's no way to curate
  or reorder them the way future neighbours now can. Same picker pattern would
  drop in — `meta.sibling_ids` alongside `meta.nearby_ids`.

- [developments] The developer section has no editable copy.
  It renders the linked developer's name, description and stats from the
  `developers` row, so editing means editing that record. Fine while a
  developer's blurb is shared across their projects; revisit if per-project
  wording is ever wanted.

- [developments] Feature blocks have no drag-to-reorder.
  They render in stored order and can be added/removed, but reordering means
  deleting and re-adding. The dnd-kit pattern from the section list would drop
  straight in.


- [agents] Public advisor cards still render seeded profiles, not staff rows.
  Portraits now come from `staff.photo_url`, but the name, title, phone,
  WhatsApp and bio on a development/property/area advisor card still come from
  `lib/seeds/agents`, joined on slug. Editing those in the admin changes
  /agents and /agents/[slug] only. Replacing the seed lookups with a staff
  query is the real fix; the photo overlay is the seam to do it through.

- [megamenu] Tile images are the only media the menu carries.
  Featured tiles now take an asset; column items still render a lucide icon
  chosen by name (`megamenu_items.icon`) with no picker. If the design ever
  wants imagery on menu links, that's the next field.

- [megamenu] Two protected files were edited for this build.
  `components/brand/cms-shell.tsx` (the sidebar entry) and
  `components/brand/megamenu-tile.tsx` (rendering the tile image) are both on
  the do-not-edit list, and were changed because the feature can't work
  without them. Worth confirming they survive the next brand sync.

- [media] Two uploads went unreferenced when Sell/Commercial were deleted.
  `0a92872e-…` ("How to sell your property") and `35f114f9-…` ("Online
  valuation") were used only by the Sell tab's featured tiles. Migration 0060
  deletes the tiles, not the assets, so both now show as not-live in the media
  library and can be trashed there if nobody wants them. Left for a human to
  eyeball rather than deleted automatically.

- [cms-shell] Megamenu isn't in the mobile tab matcher.
  `activeCmsTab` in `components/brand/cms-shell.tsx` maps `/admin/blog`,
  `/admin/pages` and now `/admin/content-assets` to the Content tab;
  `/admin/megamenu` still falls through to "More". Left alone because it's a
  behaviour change in a protected file that nobody asked for, but it is an
  oversight from the megamenu build.

- [content-assets] Only the enquiry composer consumes assets so far.
  `getContentAsset(slug)` exists so deal-stage mail, viewing reminders and
  valuation nurture can adopt the library, but none of them do yet — they
  still use the hardcoded templates in `lib/email-templates.ts`. Migrating
  each is a per-surface decision about what should stay code-driven.

- [enquiries] WhatsApp is still a deep link, not an API send.
  The composer opens wa.me with the message prefilled and logs the handoff on
  the timeline, but it cannot confirm delivery and inbound WhatsApp replies
  never reach the conversation. A real WhatsApp Business Cloud integration
  needs a Meta app, a verified number and template approval — note that
  CLAUDE.md currently lists the Cloud API in the stack table, which overstates
  what is wired.

- [enquiries] The lead's web inbox no longer receives staff replies.
  Replies used to insert a message with channel 'web' — which the lead could
  read at /account/enquiries/[id] — and separately forward by email. They are
  now logged on the channel they actually went out on. The account inbox still
  renders the thread, so nothing broke, but "reply in the lead's web inbox" is
  no longer a distinct channel an advisor can choose.

- [master-pages] Chip lists are a textarea, not a repeatable field.
  Community-type chips are stored one label per line, because a list field's
  sub-fields can only be scalars — a nested list isn't expressible in the
  section model. Fine for eight short names; if chips ever need their own link
  or image, the model needs a nested-list kind first.

- [areas] The hero's italic treatment is derived, not authored.
  `headlineParts` italicises the final word of the areas headline so the field
  stays a plain string. An editor can't choose which word is emphasised, and a
  headline ending in a short word ("of") will italicise that. Storing rich text
  or a separate "emphasised tail" field would fix it.

- [auth] Customer auth emails still come from Supabase, with the localhost link.
  The staff invitation now sends via Resend with a link built from the live
  request, but /sign-up confirmation, /forgot-password recovery and /magic-link
  all still use Supabase's mailer — so they arrive from "Supabase Auth" and
  their links resolve against the project's Site URL, which is still
  http://localhost:3000. Fixing it is either a dashboard change (Site URL +
  redirect allow-list + custom SMTP pointed at Resend) or moving those flows to
  our own tokens the way the invitation now works. Not touched here because it
  changes production auth configuration.

- [auth] Invitation activation trusts the token alone, by design.
  /staff-invite sets a password for whoever holds a valid token — including for
  an auth user that already exists, which is how the two stranded invitations
  are recoverable. That is the same trust model as a password-reset link, but it
  means an admin who mis-types an invitee's email hands password-set rights over
  that address to whoever owns it. Invitations are admin-only and audited; worth
  knowing before widening who can invite.

- [auth] Staff can't reset their own password from the staff door.
  /admin/login links to /forgot-password, which goes through Supabase's mailer
  and Site URL — so a staff member self-serving a reset still gets a
  "Supabase Auth" email with a localhost link. The admin-triggered path from the
  advisor profile is now sound; the self-service one isn't. Pointing
  /forgot-password at the same token flow (or fixing the Supabase config) would
  close it.

- [staff] Suspended accounts are blocked from password links, active ones aren't rate-limited.
  sendStaffPasswordLink refuses a suspended member, and each send deletes the
  previous outstanding reset for that address so old links die. There's no cap on
  how often it can be pressed, though — an admin could mail someone repeatedly.
  Harmless internally, worth a throttle if invites are ever delegated.
- [auth] CONFIG STATUS as of 2026-07-31 — item (2) is DONE, item (1) is done
  but needs verifying end to end.
  1. Supabase auth: `site_url` was `http://localhost:3000` and `uri_allow_list`
     was EMPTY (read from the Management API on 2026-07-30). Every auth email
     link — sign-up confirmation, magic link, recovery — resolved to localhost,
     and because the allow-list was empty Supabase rejected any redirectTo the
     code passed and fell back to site_url. Both have now been set, along with
     custom SMTP pointed at Resend and the auth email rate limit. Still unproven
     by a real end-to-end sign-up and magic link from production.
  2. DONE — `bazarrealestate.com` is verified in Resend (eu-west-1) and
     `RESEND_FROM_ADDRESS=hello@bazarrealestate.com` is set in `.env.local` and
     all three Vercel environments. Previously every Bazar-sent email went out
     as onboarding@resend.dev, Resend's sandbox sender, which only delivers to
     the account owner. Note the domain is `bazarrealestate.com`, NOT `bazar.ae`
     — if the site later moves to bazar.ae, that domain needs verifying too.

- [email] Three crons stamp their "already handled" marker before the send, so
  a failed email is never retried and the row is excluded forever.
  `enquiry-auto-reply/route.ts:56,64` also scans a fixed 5-minute window, so any
  enquiry not mailed within 5 minutes is abandoned; `app/[locale]/(public)/_actions.ts:159`
  doesn't stamp `ack_sent_at` at all on the inline path, which double-sends the
  ack when the inline send succeeds. `enquiry-escalation/route.ts:116` stamps
  `escalated_at` before the mail loop and discards the `sendEmail` result at
  `:151`. `permit-expiry/route.ts:109` gates its 7-day dedup on an audit insert
  written regardless of send outcome. Each wants: stamp only when at least one
  send returned ok, and widen the scan window with an attempt counter.

- [email] `lib/saved-search-alerts.ts:138,149` builds property CTAs from
  `propertyUrl()` (`lib/queries/property-utils.ts:14`), which is site-relative —
  so every property link in a saved-search alert email is dead. The absolute
  `base` is already computed at `:224`; prefix with it.

- [email] `vercel.json:24` schedules `saved-search-alerts-diff` every 15 min but
  the route calls `runSavedSearchAlerts("daily")`, and `lib/saved-search-alerts.ts:211`
  stamps `last_alert_at` before the no-match early return at `:216` — so the
  04:00 daily digest inherits a 15-minute window. `"instant"` subscribers are
  never processed by anything.

- [email] `enquiries/[id]/_actions-viewing.ts:181` tells the client the calendar
  invite is attached; `:197` is literally `void ics`. `SendEmailInput`
  (`lib/email.ts:8`) has no attachments field, so no callsite can attach
  anything. Either wire attachments through or delete the sentence — the
  plain-text body at `:164` correctly doesn't promise one.

- [security] `supabase/migrations/0010_admin_polish.sql:90` fires
  `handle_staff_invitation` on ANY `auth.users` INSERT. Under the current invite
  flow (which leaves `accepted_at` null until activation) a public sign-up using
  an invited address would mint the staff row without ever presenting the token,
  for the whole 14-day window. Not exploitable today, but worth scoping to
  `new.raw_user_meta_data->>'bazar_staff_invite' = 'true'` in a NEW migration.

- [developments] The floor-plan gate is the same stub the brochure gate was.
  `_components/floorplan-gate.tsx` still collects an email, waits, and toasts —
  no enquiry, no record, nothing sent. It wants the same treatment the brochure
  gate just got: name + phone + email, a real enquiry carrying development_id,
  and the plan opening rather than being promised by email. Left out to keep this
  change reviewable.

- [developments] No brochure means the button still appears.
  With no PDF set, the form captures the lead and says an advisor will send it —
  deliberately, so the lead isn't lost. Nobody is notified specifically that a
  brochure was requested without one existing, though; the enquiry just says
  "Brochure request". A flag on the enquiry, or hiding the button, are both
  defensible if that turns out to be noisy.

- [email] Two orphaned templates and a dead CTA survived phase 5, found in phase 10.
  `kycApprovedTemplate` / `kycRejectedTemplate` were supposed to go with the KYC
  review; the scripted removal matched the first function and silently missed
  the other two after the offsets shifted. `viewingReminderTemplate` has zero
  callers — the viewing-reminders cron does not reference it — so a viewing
  reminder is scheduled but no email is built. Worth deciding whether that cron
  should send one or be removed.

- [email] lib/email-templates.test.ts now asserts no template links at a removed
  route (/account, /sign-in, /sign-up, /magic-link, /reset-password,
  /verify-otp). It renders every exported template and greps the output. If a
  future template legitimately needs one of those paths, that test is the thing
  that will stop it.

- [cron] The seven surviving jobs still need CRON_SECRET set in Vercel.
  Production returns `{"reason":"CRON_SECRET not configured"}` on every cron
  route, so none has ever run — no enquiry acknowledgement has ever been sent
  and no enquiry has ever been escalated. `.env.example` has documented it as
  REQUIRED IN PRODUCTION since the beginning. Setting it in Production and
  Preview and redeploying is the entire fix; Vercel injects the matching
  Authorization header automatically.

- [cron] The enquiry auto-reply has a second, also-dead path.
  The pg_net trigger (0030) posts to a Supabase Edge Function that has never
  been deployed (`list_edge_functions` is empty), and `app_settings` is empty
  so `functions_base_url()` returns NULL and the trigger deliberately no-ops.
  Deploying the function and setting that row would restore acknowledgements
  independently of Vercel.

- [valuation] dld_comparables is empty and no longer refreshed.
  The weekly import cron was removed as unused. /tools/valuation and
  /market-reports read that table, so both price against nothing until it is
  loaded — manually, or by reinstating the import.

- [db] CASCADE does not reach function bodies — this bit us once already.
  0068 dropped `deals`; `deal_buyer_account()` kept querying it and an RLS
  policy on storage.objects kept calling that, which broke ALL image uploads
  (0069). `anonymise_account()` was broken the same way, for the second time.
  Before any future `drop table`, grep pg_proc for the table name:
    select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and pg_get_functiondef(p.oid) ilike '%<table>%';
  and check pg_policies in BOTH `public` and `storage`.

- [db] anonymise_account covers less than 0037 claims.
  The live definition scrubs accounts, enquiries, messages, viewings,
  newsletter_subscribers and reviews only. 0037 said it was extended to
  valuation_requests, mortgage_inquiries and others — those
  statements are not in the deployed function, so 0037 looks never to have been
  applied. `anonymise_by_email` (0067) does cover them, so the email-keyed path
  is the more complete one. Worth reconciling.

- [storage] The `documents` bucket still exists, empty and policy-less.
  Postgres blocks deleting it via SQL; remove it through the Storage API or the
  dashboard. Nothing can read or write it in the meantime.

- ~~[legal] /ar/legal/privacy is the only Arabic page on the site.~~
  **Closed 2026-08-12 — the trigger fired.** This entry called for adopting a
  real i18n layer rather than copying the one-off pattern a third time, and
  that is now in flight: see
  [ADR-0007](decisions/ADR-0007-arabic-locale-routing-and-content-storage.md)
  and [I18N.md](I18N.md). Two carry-overs for the phase that moves the route
  tree under `[locale]`:
  - `/ar/legal/privacy` exists as a *physical* route today, so the move must
    relocate its hand-authored Arabic to the `ar` branch of `legal/privacy`.
    Left alone, that URL would start serving the **English** page under
    `lang="ar"` — an hreflang violation on the one page a client checks first.
  - `LegalDocFrame` sets an inline `style={{ fontFamily: ARABIC_STACK }}`.
    Inline styles beat the `:lang(ar)` block, so unless it is removed in the
    same PR, that page renders in a different, per-device system face from
    every other Arabic page.

- [i18n] Four more tables have public text with no editor behind it.
  Adding Arabic turned into an audit of where the CMS never finished the
  English, because a column with no editor renders fine and fails nothing.
  Beyond article_categories, development_units and properties.description
  (each recorded separately — **all three now built**), two more surfaced while
  wiring the last batch: `area_guides` has three readers and zero writers —
  intro_md, amenities and schools render on /areas/<slug> and are edited
  nowhere; and `developments.amenities` was populated on 8 of 21 projects with
  no writer in app/ at all (**now editable** — the amenities picker moved to
  `admin/_fields/` and mounted on the development record). Both arrived by
  migration. `area_guides` is the one still outstanding; its Arabic twins have
  existed since 0104 and become reachable the moment an editor does.

- [pages] `pages.title` is an internal label used as a public <title> fallback.
  Every writer synthesises it — `${record.name} (area guide)`,
  `(project page)`, `(master page)` — and `pages/[slug]/page.tsx:22` falls back
  to it when `seo.meta_title` is unset. So a visitor can end up with
  "Saadiyat Island (area guide)" in their browser tab. It is registered
  `strategy: "never"` because translating "(area guide)" would be translating
  an internal label, but the real fix is that this fallback should be the
  record's own name, or nothing. Cheap to fix, and worth doing before /ar
  launches rather than after.

- ~~[developments] `development_units` has readers but no writer.~~ **Done** —
  an Inventory grid now sits under the development sub-page editor, with
  Arabic twins for unit_type, orientation and lagoon_access and a read fold on
  the public table. One thing it left behind: `developments.total_units` is a
  hand-typed number on the record while the grid holds the real rows, so the
  public eyebrow can read "6 available of 312" against 8 stored units. The
  editor says so, which is the cheap half of the fix; deriving the total, or
  flagging the mismatch, is the other half.

- [blog] Article categories can be created but never edited.
  `createArticleCategory` in app/[locale]/(admin)/admin/blog/_category-actions.ts
  is the ONLY write to `article_categories` — there is no update action and no
  categories admin page, so the 13 existing rows' labels cannot be changed and
  their `description` cannot be set at all (0 of 13 have one, because nothing
  has ever written it). The label renders publicly on
  /insights/category/<slug>, so this is a live surface with no editor. That is
  also why article_categories has no Arabic inputs: there is nothing to add
  them to. Done looks like a small categories screen — rename, describe,
  reorder, deactivate — at which point the Arabic twins already in the schema
  become reachable in the same pass.

- [i18n] properties' public read path is unfolded, and the file is protected.
  title, short_description, description, address_line, view and orientation all
  have twins and (except description) Arabic inputs, but nothing renders them:
  the fold belongs in `lib/queries/properties.ts`, which is on the
  protected-files list where additive changes get reverted. Every other table's
  fold went in without asking because those query files carry no such rule.
  Two `localiseRow` calls are needed — one before the detail shaper, one in the
  published-list map — and both must sit upstream of the shaping functions, as
  in lib/queries/developments.ts. Needs an explicit go-ahead on that file
  before anyone writes it.

- [i18n] Arabic columns can exist with no way to type into them, and no guard sees it.
  `AWAITING_TWIN` in lib/i18n/domains.ts tracks whether a `_ar` COLUMN exists,
  because that is what domains.test.ts can verify from db/types.ts. It says
  nothing about whether a CMS form exposes the field. `developers.name_ar` and
  `developers.description_ar` are in exactly that state right now — shipped by
  migration 0103, no Arabic inputs on /admin/developers/<slug>. Same for the
  public read paths: areas and developers are still resolved without a locale
  fold outside the megamenu and branding, so stored Arabic will not render on
  /areas/<slug> or /developers until those queries pass a locale through
  localiseRow. Worth either extending the guard to check editor coverage, or
  accepting the split and tracking UI separately — but not leaving it implicit.

- [ci] E2E still asserts on other CMS-owned copy, and any editor can redden it.
  On 2026-08-13 an editor standardised the submit label on 16 forms between
  05:40 and 07:13; `property_enquiry` went from "Send enquiry" to "Submit" and
  `contact_enquiry` gained `required` on both email and phone. Two marketplace
  specs failed on a branch whose diff contained no runtime code at all. Those
  two plus the newsletter spec now locate forms structurally
  (`button[type="submit"]`), but the same trap is still set elsewhere:
  `developments.spec.ts:124` matches `/townhouses ·/i`, which is
  `development_unit_types.label`, and the filter-chip assertions in
  `marketplace.spec.ts` read taxonomy labels. The general fix is the one
  applied here — assert the outcome, locate by structure, and leave exact
  wording to unit tests where it cannot drift.

- [forms] The `development_brochure` submit button says "Sumbit" in production.
  Live on the public form since 2026-08-13 06:54. One-word fix in
  /admin/forms/development_brochure; noted here because nothing in the CMS
  spell-checks editor copy and nobody is likely to look at that button again.

- [properties] `properties.description` has no editor, and no data.
  `_tabs/description.tsx` exports `PropertyDescriptionTab` — a full Tiptap
  editor with a bold/italic/list/link toolbar — and **nothing imports it**. Its
  own comment says "Sprint 9 wires autosave through this onChange callback",
  which never happened. Consequence: the long description cannot be edited in
  the CMS at all, and `select count(*) ... where description <> ''` over the 18
  published rows returns **0**. The public property page does render it
  (`p/[slug]/page.tsx:528`), so this is a real content surface that has been
  dark since Sprint 7c. Either mount the tab (it looks complete) or delete it —
  a working editor nobody can reach is worse than neither.

- [i18n] Masked measurement units come back Latin in the Arabic.
  Observed on the first live run (BAZ-AD-06055): "216 sqm" is masked whole, so
  the Arabic sentence reads "…تقدّم 216 sqm من المعيشة الراقية". That is the
  mask doing its job — the number cannot drift because the model never sees it
  — but a Gulf reader expects "متر مربع". The fix is the mechanism that already
  exists rather than a new one: pass unit overrides to `unmask` the same way
  hand-authored toponyms are passed, so ⟦n⟧ resolves to "216 متر مربع" while
  the digits still never reach the model. Needs a decision on whether ft² stays
  ft² (it is the unit the DLD paperwork uses) before wiring it.

- ~~[i18n] OG images and PDFs stay English on /ar — both blocked on text layout.~~
  **Closed 2026-08-13 — decided, not deferred.** The client confirmed that OG
  cards stay English with no mirroring or transposition, and that a single PDF
  serves both the English and Arabic pages. So neither is outstanding work.
  The evidence is kept where it is useful rather than here: lib/og/arabic-og.test.ts
  holds the Satori measurements (shapes Arabic, never reorders; `direction:
  "rtl"` ignored; a bidi pre-pass survives one line and breaks on the first
  wrap) and guards against an OG route quietly starting to consume Arabic.
  lib/pdf/language-note.ts holds the @react-pdf/renderer analysis and applies
  the "(English)" suffix, which is now permanent copy rather than a placeholder.

- [legal] §2's Arabic heading reads "البيانات الشخصية التي بجمعها".
  The English heading is "What Personal Data We Collect", so this looks like
  a typo for "نجمعها" in the client's source document. Published verbatim —
  their text, their call. Worth raising when the retention placeholder is.

- [legal] Terms and cookies still carry the "lawyer-drafted copy in progress"
  banner and the dpo@ mailbox.
  Privacy now has client-final text (banner off, info@ contact) via the new
  LegalDocFrame `draft` / `contactEmail` / `dateLabel` props. When the client
  sends final terms and cookie copy, pass the same props there.

- [legal] The site's entity details contradict the published privacy policy.
  The policy says "Bazar Real Estate L.L.C.", regulated by ADREC. The footer,
  OG images, email templates, PDF headers and lib/queries/trust.ts
  (`DLD_BROKER_PERMIT = "ORN 28041"`) still say "Bazar Real Estate Brokerage
  LLC · ORN 28041 · DMT". Needs one client answer, then a sweep.

- [areas] Area pins and stats still read `lib/seeds/areas.ts`, not `area_guides`.
  `getAreaProfile` merges the published `area_guides` overlay for the detail
  page, but `lib/queries/area-map.ts#seedStatsForSlug` (map flyouts) does not,
  so a CMS-created area pins with a listing count and no figures. Swap it for
  the profile resolver once the client populates `area_guides` at handover.

- [areas] Nothing puts a new area into the megamenu's Areas tab.
  The tab is curated DB rows edited by data migration (see the megamenu docs),
  by design — but an area added from the property wizard is reachable from
  /areas and search only. Worth a "feature in nav" toggle on the area record if
  the client asks.

- [sell] Advisor coverage still comes from `lib/seeds/agents.ts`.
  `lib/queries/lead-routing.ts` matches an owner lead to an advisor in three
  passes: the CMS rules at /admin/settings/routing, then the seed roster's
  `areas`, then the CMS fallback agent. Only six of the twelve live advisors
  have seed coverage, and `staff` has no coverage column — so most areas rely
  on an admin writing a routing rule. Either add coverage to `staff` (and an
  editor for it) or populate the rules table at handover.

- [sell] The enquiry detail pane doesn't render the qualification payload.
  An owner lead stores its answers in `enquiries.inferred_constraints`
  (category, type, bedrooms, ft², furnishing, urgency, call window). The desk
  reads them from the first message of the thread, which carries the same
  brief — but "About this lead" could show them structurally.

- [sell] The transactions card has no data to draw.
  `dld_comparables` is empty in production, so the card falls back to a
  figure-free state rather than inventing a trend. It renders the real
  24-month Saadiyat sparkline the moment the DLD import runs.

- [developers] The catalogue and the shipped directory disagree about slugs.
  `app/[locale]/(public)/developers/_data.ts` ships `modon` / `imkan` / `sobha`; the
  `developers` rows those listings actually reference are `modon-properties`,
  `imkan-properties`, `sobha-realty`. The grid now merges on the normalised
  name (`developerNameKey`) so neither is listed twice, and the superseded slug
  canonicalises to the row — but the real fix is to align the two, then retire
  `_data.ts` in favour of the catalogue plus uploaded logos. Logos are the only
  thing keeping it: the 30 trimmed PNGs in `/public/developers` have no DB
  equivalent for the launch partners.

- [infra] `npm run lint` and `npm run test:run` walk `.claude/worktrees/`.
  Neither `vitest.config.ts` nor `eslint.config.mjs` ignores it, so a local run
  from the repo root picks up every sibling worktree — 613 test files instead of
  109, and an ENOENT when another session's tree changes mid-run. CI is clean
  (fresh checkout), so this only bites locally. Adding `.claude/**` to both
  ignore lists is the fix; left alone here because other sessions are actively
  working in those trees.

- [prefs] `NEXT_PUBLIC_FX_USD_PER_AED` is declared but no longer read.
  ADR-0006 made the USD rate an exact constant (`1 / 3.6725`) because the AED
  is pegged — an env override for a peg is the wrong knob. `usdPerAed()` and
  the schema entry still sit in `lib/env.ts`, a shared file, so removal was
  left for whoever is next in there. Drop both plus the `.env.example` line.

- [prefs] The PDF exports for valuation and compare take no `prefs`.
  `lib/pdf/market-report-pdf.tsx` already threads `readPreferencesFromCookie()`
  through its API route, and API routes have no `revalidate` to lose by reading
  a cookie — so this is cheap. `lib/pdf/valuation-pdf.tsx`,
  `lib/pdf/compare-pdf.tsx` and `lib/pdf/payment-plan-pdf.tsx` are still
  AED/ft²-only and inconsistent with it.

  Admin CMS staying AED/ft² is now a decision, not an oversight: staff edit
  `price_aed` and `built_up_ft2` directly, and showing a field in a unit other
  than the one it stores invites data-entry errors.

- [perf] The dashboard pipeline chart runs six count queries instead of one.
  `app/[locale]/(admin)/admin/page.tsx` used to `select` every `enquiries` row to tally
  six integers in memory, with no `limit`, so its cost grew with the table
  forever. That is now six `head: true` counts inside the existing
  `Promise.all`, which is bounded but still six round-trips. One grouped
  `count(*) ... group by status` in an RPC would be a single trip; it needs a
  migration to add the function, which is why it was not folded into the perf
  pass.

- [perf] `CmsShell` is imported by 43 admin pages rather than mounted in the
  layout. That is the real reason the admin chrome remounts on every
  navigation — the sidebar, topbar and both notification trees are rebuilt per
  page instead of persisting across the segment. The session provider added in
  #293 removes the per-navigation *fetching* (four `/api/notifications/recent`
  calls and two browser `getUser()` calls per nav, now zero), but not the
  remount itself. Hoisting the shell into `app/[locale]/(admin)/layout.tsx` is a
  43-file change and a real UX improvement — it belongs in its own PR, not a
  performance one.

- [db] Revisit `unused_index` once the database has seen representative
  traffic. Migration `0085` deliberately added ~30 indexes that the planner
  will not use at current row counts — they exist for the FK delete path
  (deleting one media asset scanned thirteen child tables before). They will
  show up as `unused_index` in the advisor and must not be dropped on that
  basis. A sane rule when revisiting: non-constraint, non-partial, zero scans,
  on a table above ~10k rows. Nothing qualifies today.

- [db] The 47 `multiple_permissive_policies` warnings are deliberately open.
  Each is the same shape — a broad public-read policy OR'd with a staff
  policy. Consolidating them is a security change wearing a performance
  costume: merging two independently reviewable grants into one boolean is a
  fresh chance to widen access, and the failure mode is silent (nothing
  errors, drafts just become publicly readable). Postgres already ORs
  permissive policies into a single qual, so the saving is one OR branch. If
  it is ever done it needs its own PR with per-table role reasoning and a
  security review.

- [test] The admin CMS has no end-to-end coverage of authenticated behaviour.
  `e2e/admin-rbac.spec.ts` says so in its own header: without service-role
  credentials CI cannot seed a staff session, so the suite asserts the
  anonymous redirect paths and nothing past the login wall. That is why the
  session work in #293 is guarded by unit assertions rather than a real
  navigation, and why RLS changes are verified with SQL probes rather than the
  suite. Seeding a staff session in CI would unlock both.
- [developments] `development_media` is empty, and nothing writes it.
  The renders section falls back to the development record's own media (roles
  `render`/`gallery`) when the exterior gallery is empty, but the table has
  zero rows across all 20 developments and no CMS surface creates any — the
  Page images card writes `hero_image_id`/`masterplan_id` on the row instead.
  So the fallback is unreachable in practice. Either give the table an editor
  or delete the join table and the fallback with it; leaving it half-wired is
  what made the masterplan lookup fail before (see `lib/queries/developments.ts`).
  Bears on the interior/exterior split: record media stands in for exteriors
  only, because a role enum with no writer can never express "interior".

- [settings] Under the anon key, `getPublicSiteSettings` still answers from
  `DEFAULTS` rather than the row an admin edited. `site_settings` had no anon
  policy at all until 0096, and 0096 opened only the branding and display
  columns — the wide read also asks for `lead_routing` and `email_templates`,
  which anon may not select, so the whole select is a permission error and the
  catch falls through to the hardcoded defaults. Nothing errors visibly. Two
  consequences worth confirming before anyone relies on either: the homepage
  `hero_variant` / `accent_token` toggles at /admin/settings/hero have never
  taken effect on the public site, and `matchAdvisor` (lib/queries/lead-routing.ts)
  never sees the area→agent rules an admin wrote at /admin/settings/routing —
  it falls straight through to the seed coverage roster. The fix is not another
  grant: `lead_routing` carries staff user ids and has no business on an anon
  key. Route the routing lookup through the service-role or cookie-aware client
  (it runs inside a form submit, so it is already dynamic), and split the
  display columns onto the narrow public read the way `getPublicBranding` does.

- [page-builder] The `media-usage` sources are still `.limit(1000)` each, and
  the Page Builder adds a fourth document-shaped one. `pages` already holds one
  `subpage/` row per development, per area and per developer, so the ceiling is
  closer than the number suggests — and row 1001 onward is invisible to the
  usage index, which means its images read as `unused` and the media library
  offers to trash them. Pagination, not a bigger number: the failure is silent
  and only shows up as a hole in a live page weeks later.

- [dead-code] The inventory below is now mechanical, not a memory.
  `lib/dead-code.test.ts` (G-15) enumerates every module in `app/`,
  `components/` and `lib/` that nothing imports, carries a one-line reason per
  entry, and fails if a new one appears. It deletes nothing — ten of its
  entries are the deliberate parking lot described immediately below, and one
  of those is a fabricated-inventory hazard rather than a candidate. Its second
  job is the message waves: a string in a component nothing mounts still gets
  extracted, translated and human-reviewed, and then renders nowhere, so
  G-13's allowlist could never honestly empty. Waves 4b and 4c deleted
  seventeen such components before the guard existed; 24 remain listed.

- [page-builder] Ten pre-designed section components in
  `app/[locale]/(public)/_components/` still have zero call sites: `trust-strip`,
  `services-band`, `awards-band`, `areas-mosaic`, `insights-teaser`,
  `off-plan-strip`, `advisor-of-month`, `client-words`, `market-stats-strip`,
  `cta-banner`. They were considered for the v1 catalogue and left out for
  concrete reasons rather than for time — worth reading before anyone adopts
  one: `areas-mosaic` hardcodes five areas with **invented listing counts**
  ("338") and a layout that only works at exactly five items, which is a
  fabricated inventory claim on a DLD-regulated advertising surface;
  `market-stats-strip` hardcodes Q2-2026 medians behind a `Sprint 9 wires
  getMarketStatsSnapshot()` TODO; `cta-banner` imports `ValuationLeadGate` from
  the valuation tool, so it is not a leaf. Prop-ifying any of them is real work
  with a real reading pass, not free inventory.

- [page-builder] Seven components under
  `app/[locale]/(admin)/admin/pages/[id]/_components/` remain orphaned from the
  abandoned Sprint 7g/8 page builder — `block-reorder` (dnd-kit), `block-add-cta`
  (offers `mosaic` and `embed`, neither of which is in `BLOCK_KINDS`, so wiring
  it up would create blocks `parseBlocks` deletes on the next read),
  `block-thumbnails`, `data-source-toggle`, `site-tree`, `block-types/embed`,
  `block-types/mosaic`. The Page Builder supersedes what they were for. Decide:
  delete them, or lift `block-thumbnails` into the new add-block picker, which
  is the one piece with obvious value left in it.

- [mortgage] The DBR gauge and the affordability sentence read from two
  different scales. `affordability()` in `lib/mortgage.ts` bands at
  `dbrComfortablePct` / `dbrMaxPct` (40 / 50 by default, both editable under
  Settings → Mortgage); `DbrGauge` colours at 0.35 / `maxDbr`. The 0.35 is the
  lenders' stress-test convention rather than a regulator's number, which is
  why it stayed in code — but it predates the settings panel and nobody chose
  the mismatch deliberately. Either make it a third editable figure or align
  the gauge's green band on `dbrComfortablePct`; the second changes what the
  page renders today, so it needs a look rather than a patch.
  `app/[locale]/(public)/tools/mortgage/_components/dbr-gauge.tsx:56`.

- [marketing] `ServiceHero` lives under
  `app/[locale]/(public)/services/_components/` but is not service-specific any
  more: /tools/mortgage now opens with it, because the client asked for the
  /services/manage shape, and imports it across route subtrees to get there.
  Its two-pass gradient and the "light copy belongs to the column, not the
  section" fix are axe-sensitive and worth exactly one copy, so copying it was
  never an option. Promote it to `_components/marketing/` beside `SectionHead`
  and update the four call sites — a move plus four import lines, left out of
  the section split so that diff stayed readable.

- [i18n] The testimonial card's avatar monogram is built from the first and
  last word of the attribution (`initialsOf` in
  `app/[locale]/(public)/_components/home/home-testimonials.tsx`), which was
  written when the attribution could only be English. Now that the reviews are
  translated, `/ar` draws two-letter Arabic monograms — "زوجان … ريزيرف" gives
  **زر**, which is a word ("button"), not initials. Arabic has no monogram
  convention to fall back on, so this needs a decision rather than a patch:
  drop the circle on `/ar`, keep the Latin initials in both locales (they are
  decorative, not content), or replace the circle with a neutral glyph. Small,
  visible, and only visible to Arabic readers.

- [i18n] `development-faq.tsx` writes its questions and answers as English
  template literals — "When does {name} hand over?", "Currently scheduled for
  Q4 2029. Developers occasionally adjust handover quarters…" — so every
  development detail page carries a paragraph of English inside the Arabic
  accordion. It is generated prose rather than a label, so it cannot ride the
  `development.card.*` keys the handover badges now use: each sentence needs
  its own ICU message with the name, quarter and plan interpolated. Bounded
  (one file, ~8 entries) but a copy job, not a rename.
  `app/[locale]/(public)/developments/[slug]/_components/development-faq.tsx:104`.

- [i18n] Payment-plan milestone labels ("On Handover", "On Booking") are typed
  into the development record by staff, not written in code, so the Arabic
  payment schedule prints them in English between two Arabic columns. The
  column has no `_ar` twin and `payment_plan` is a jsonb bag, so this is a
  schema question — a twin inside the bag, like `types[].label_ar` on
  `search_bar_tabs` — plus an editor for it. Wrong to fix by translating in the
  renderer: the labels are a small closed vocabulary today and arbitrary text
  tomorrow.

- [i18n] The shadcn `Sheet` primitive labels its close button with a hardcoded
  English `Close`, so every slide-out on the Arabic site hands screen-reader
  users a control they cannot read. The shortlist card now composes around it
  (`showCloseButton={false}` plus its own `SheetClose`), which is the pattern
  available without editing `components/ui/*` — but three Sheets still carry
  the primitive's label: `more-filters-drawer.tsx`, the compare
  `picker-drawer.tsx`, and `components/brand/public-mega-nav-mobile.tsx`. The
  clean fix is one optional `closeLabel` prop on `SheetContent`, which is an
  edit to a shadcn primitive and therefore a decision (re-adding the component
  would drop it) rather than a patch. `components/ui/sheet.tsx:79`.

- [i18n] `amenityLabel()` matches a stored amenity against the taxonomy by
  normalised English label, but `listAmenitiesTaxonomy()` folds that taxonomy
  to Arabic before the comparison — so on `/ar` nothing matches, the helper
  returns its input, and the property page's "Features & amenities" grid prints
  the English. The compare table's amenity rows now go through `arabicFor()`
  instead and are correct, which makes the two surfaces disagree on the same
  page's worth of words. Fix in `lib/amenities.ts`: match on an unfolded label
  (or on `code`) and render the folded one.
  `app/[locale]/(public)/p/[slug]/page.tsx:585`.

- [i18n] `ListingCard`'s save control is labelled `Save to shortlist` /
  `Remove from shortlist` in English on every locale — the aria-label on the
  button that fills the shortlist card this epic just translated. It lives in
  `components/brand/`, which is off-limits to incidental edits, so it wants its
  own pass together with the rest of that directory's literals.
  `components/brand/listing-card.tsx`.
