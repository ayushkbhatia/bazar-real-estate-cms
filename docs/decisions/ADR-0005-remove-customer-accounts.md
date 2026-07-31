# ADR-0005 — Remove customer accounts

**Status:** Accepted · 2026-07-31
**Supersedes:** the signed-in marketplace experience described in earlier revisions of `docs/PROJECT_UNDERSTANDING.md`

## Context

Bazar shipped a full customer-account surface: sign-up, sign-in, magic link,
saved properties, saved searches with email alerts, recently viewed, a document
vault, referrals, tour requests, a lead inbox, and PDPL self-service data export
and deletion.

Almost none of it was used. At the point of removal production held **zero**
customer accounts — all fifteen `accounts` rows belonged to staff, created by
the `handle_new_user` trigger that fires for every auth user. `deals`,
`dsr_requests`, `saved_searches`, `referrals`, `tour_requests` and account-owned
`documents` were all empty; `saved_properties` and `recently_viewed` held two
rows each, from internal testing.

The client decided the product does not need a signed-in customer experience.

## Decision

Remove it. The marketplace is public and anonymous; the only sign-in is the
staff door at `/admin/login`.

## What this cost, and what it did not

Removal was not a subtree deletion. A read-only audit found the account surface
was a **cross-cut**:

- `app/(public)/_components/filter-bar.tsx` and
  `components/brand/save-button.tsx` imported server actions from
  `app/(account)/_actions`, so deleting the account tree broke the **public**
  build.
- `app/(staff-auth)/admin/login/_form.tsx` imported `signInAction` from
  `app/(public)/(auth)/_actions`, so deleting the customer auth pages broke
  **staff sign-in**.
- `deals.buyer_account_id` is `not null references accounts(user_id)`, so with
  no customer accounts **no new deal could ever be opened** — silently, with no
  build error.
- `dsr_requests.account_id` cascades from `accounts`, so hard-deleting accounts
  would have destroyed the compliance audit trail.

The work ran in ten phases, app code first and schema last, so the application
was never broken between them.

### Kept, deliberately

- **`public.accounts`.** Fourteen tables reference it, eight of which survive.
  Every row is a staff member. Dropping it would have taken the staff records.
- **Tour requests** — a public lead form; anonymous visitors submit them.
- **The compare tool** — its state was always client-side, never the
  `comparisons` table.
- **Newsletter** — never account-gated; public signup, 290 live subscribers.
- **`dsr_requests`** — the evidence a data-subject request was handled.

### Replaced, not dropped

**PDPL data-subject rights.** `/account/data-export` and
`/account/data-deletion` were the only implementations of right-of-access and
right-to-erasure, and the privacy notice linked those exact URLs. Deleting them
without a replacement would have been a compliance regression, not a cleanup.

The legal pages now direct subjects to `dpo@bazarrealestate.ae`, and staff
fulfil requests at `/admin/dsr`. Because the subject key moved from account id
to **email**, migration 0067 made `dsr_requests.account_id` nullable and added
`anonymise_by_email()`.

That work also uncovered that **`anonymise_account()` had never worked** — it
calls `gen_random_bytes()` with a `search_path` that excludes the `extensions`
schema, so every erasure request would have failed at the first statement.
Fixed in the same migration.

**Staff password recovery.** The Supabase magic link was never customer UX: it
was the only self-service path back into a staff account. Rather than keep a
second email system alive for it, `/forgot-password` now issues a
Resend-delivered token (`lib/staff-password-link.ts`), shared with the
admin-triggered link. Supabase Auth consequently sends **no email at all** —
one delivery system, no dependency on `uri_allow_list`, and its auth-email rate
limit stops mattering. See the D10 section of
`docs/plans/ACCOUNT_REMOVAL_PLAN.md`.

### Removed alongside

The Deal Room and KYC review, both already unreachable for the reason above and
both empty. Their tables went with the rest in migration 0068.

## Consequences

- The public site has no save/heart button and no saved searches. The saved-search
  alert crons went with them.
- There is no customer-facing account of any kind; `/sign-in`, `/sign-up`,
  `/magic-link`, `/forgot-password`'s old target, `/reset-password` and
  `/verify-otp` permanently redirect to `/admin/login`.
- Creating the first admin in a fresh environment is now
  `scripts/bootstrap-admin.mjs`. It used to be "sign up as a customer, then run
  promote-staff.sh", which is no longer possible.
- Roughly 11,600 lines removed.

## Where the detail lives

`docs/plans/ACCOUNT_REMOVAL_PLAN.md` — the full audit, the ten phases, the ten
blocking decisions with their resolutions, and the explicit do-not-touch list.
Read it before assuming anything here was accidental.
