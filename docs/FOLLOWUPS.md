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

- [i8] Regenerate `db/types.ts` after `0014_bulk_ops.sql` applies in prod.
  Server code in `lib/queries/bulk-operations.ts` + the action wrappers in
  `app/(admin)/admin/properties/_bulk-actions.ts` currently cast through
  `unknown` for the new `bulk_operations` table. Once the migration lands
  in the production Supabase project, run `npm run db:types` and drop the
  casts. Surfaced by PR #67.

- [i5] Optional reassign-digest email.
  When a bulk reassign happens, send each newly-assigned agent a single
  "You were assigned N properties" Resend email. Spec'd as optional in I5
  and deferred to keep PR #63 scoped. Trigger from
  `bulkReassignProperties` after `logBulkOperation`; template should live
  alongside the existing transactional templates in `lib/email-templates.ts`.
  Group by agent so each one receives one email even if the bulk hit a
  mix of agents.

## Recently done

(Move entries here briefly before deleting, so a `git log -p docs/FOLLOWUPS.md`
shows the trail.)

_(empty)_
