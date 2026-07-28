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

- [megamenu] Media library picker for featured tiles.
  `megamenu_featured_tiles.media_asset_id` is in the schema (FK to
  `media_assets`) but the admin editor at `app/(admin)/admin/navigation/
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
  added on `app/(admin)/admin/settings/page.tsx`).

- [megamenu] PostHog event for megamenu interactions.
  Capture `megamenu_tab_opened` (tab slug, source: hover|click|keyboard)
  and `megamenu_link_clicked` (tab slug, item label, href) in
  `components/brand/public-mega-nav.tsx` to learn which panels and links
  get used. Use the existing `posthog.capture` pattern from
  `components/brand/listing-card.tsx`.

- [i8] Regenerate `db/types.ts` after `0014_bulk_ops.sql` applies in prod.
  Server code in `lib/queries/bulk-operations.ts` + the action wrappers in
  `app/(admin)/admin/properties/_bulk-actions.ts` currently cast through
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
  `app/(admin)/admin/properties/[id]/_actions.ts`; `requireRole` throws
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
  window (`TRASH_WINDOW_DAYS` in `app/(admin)/admin/media/page.tsx`), but only a
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
