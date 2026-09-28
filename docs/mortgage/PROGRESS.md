# Mortgage module — progress log

One entry per phase, newest last: what was built, deviations from SPEC, open
TODOs. This file carries context from one session to the next (PLAN.md, "How
to run each phase").

---

## Phase 0 — Recon, decisions, setup · 28 Sep 2026

**Built (documentation only, no feature code)**
- `docs/mortgage/`:
  - `PLAN.md` and `SPEC.md`, verbatim;
  - `frontend/` (W1–W8) and `cms/` (C1–C6), unzipped from the two design
    handoffs. The duplicate `SPEC.md` inside each `00-foundations/` was dropped
    so there is one SPEC to keep current.
- `IMPLEMENTATION.md`: where every part of SPEC goes in this repo, what to
  reuse, conflicts, missing prerequisites, files per phase, risks and pushback.
- `DECISIONS.md`: every open question in one register, with owner,
  needed-by date and recommendation.
- `CLAUDE.md`:
  - added the "Mortgage module" block from PLAN, adapted to this repo;
  - removed "deals (Kanban stages, documents, KYC)" from the status list, since
    that module was removed in #214.

**Deviations from SPEC and the handoffs** (details in IMPLEMENTATION.md §0)
- The transition function lives in SQL, mirrored in `lib/mortgage-requests/state.ts`.
- `staff.mortgage_role` replaces new `staff_role` values. Proposed as D9;
  SPEC allows it.
- The file stream moves to `/api/admin/mortgages/files/[fileId]`.
- The website flow is its own route group, `app/[locale]/(mortgage)/`.
- The domain module is `lib/mortgage-requests/`, not `lib/mortgage/`.
- CMS strings live in `lib/mortgage-requests/cms-strings.ts`, not `messages/`.
- Drafts are purged by a cron, and scans run inline with a cron retry.
- There is no MSW or Storybook; a staff-only state gallery takes their place.

**Open before Phase 1**
- D9, D10, D11 and D26 (with G2) are needed by 29 Sep.
- D1–D7 need owners and dates for Phase 0 to close.

**Not verified from here**
- The live database (the Supabase connectors failed to authenticate):
  - the row count of `mortgage_inquiries`;
  - whether the leftover `documents` bucket still exists;
  - whether a fresh migrate from `0001` succeeds locally.
- The master-page and megamenu entry-point rows as edited live.
