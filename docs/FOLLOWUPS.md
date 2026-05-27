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

## Recently done

(Move entries here briefly before deleting, so a `git log -p docs/FOLLOWUPS.md`
shows the trail.)

- [curated] `lib/queries/curated-listings.ts` hero embed fixed (P0
  launch-readiness). Swapped to the `property_media` join pattern from
  `listings-by-agent.ts`; added error logging so PostgREST failures no
  longer silently empty `/exclusive`, `/new-this-week`, `/price-drops`.

- [i5] Reassign-digest email shipped (P2 launch-readiness).
  `bulkReassignProperties` now fires a one-off digest to the
  newly-assigned agent via `bulkReassignDigestTemplate`. Single agent
  per call so no grouping needed; fire-and-forget so failures don't
  block the action response.
