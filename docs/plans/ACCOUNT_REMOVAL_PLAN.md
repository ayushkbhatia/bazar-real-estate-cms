<!-- Produced by a multi-agent read-only audit (14 agents, 283 items mapped,
     221 flagged as shared). Every headline claim below was then re-verified by
     hand against this worktree and the live database — see "Verified against
     production" for corrections to the audit's own assumptions. -->

# Customer-account removal — audit and phased plan

**Status: PROPOSAL. Nothing has been deleted.** Phases 3 and later are blocked on
the decisions in §1.

---

## D10 — RESOLVED: the Supabase mailer is retired

*Recorded 2026-07-31, after PRs #215/#217 landed. Implemented in the phase 6-9
branch; this section supersedes the "Keep" entry for `/magic-link` in Phase 7.*

Taken the recommended way. **Supabase Auth now sends no email at all** — there
are zero `auth.signUp` and zero `signInWithOtp` callsites left in the repo, so
both of its templates are unreachable. Every email the product sends goes
through `lib/email.ts` → Resend.

| path | before | after |
|---|---|---|
| `/forgot-password` | placeholder whose only content was a button to `/magic-link` | real self-service page: issues a Resend token link |
| `/magic-link` | the actual recovery mechanism | **deleted**, 308 → `/admin/login` |
| `/verify-otp` | redirect to `/magic-link` | 308 → `/admin/login` |
| Staff recovery | Supabase magic link, or an admin-issued link | one mechanism, two entry points |

**The trap the handoff flagged is closed.** An earlier revision of the phase 6-9
branch deleted `/forgot-password` outright and replaced the login link with
"Ask an admin" — which would have left a sole locked-out admin with no way in
short of the Supabase dashboard. `/forgot-password` is now a working page, and
`lib/supabase/proxy.ts` keeps it publicly reachable, which it must be: anyone
using it has no session by definition.

`issueStaffPasswordLink` (`lib/staff-password-link.ts`) is the single
implementation, shared by `/forgot-password` and the admin surfaces from
#205/#208, so the two cannot drift on token lifetime, single-use semantics or
what the email says.

Two security properties the self-service route needs and the admin one did not:

- **No account enumeration.** The page is public and emails an address the
  caller chooses, so it answers identically whether the address is staff, is
  not staff, or is suspended. A truthful "that isn't a staff account" would
  make it a staff-directory oracle. Covered by tests.
- **Rate limited** — 5 requests per IP per 15 minutes, checked before anything
  is issued. It is the obvious lever for mailbombing a colleague or probing
  addresses.

Kept, per the handoff's constraints: the SMTP config (costs nothing, and is the
break-glass if a Supabase dashboard recovery mail is ever needed), the
`safeRelativePath` guard on both callbacks, and staff invitations on Resend
rather than `inviteUserByEmail`.

`/auth/callback` survives with its guard intact. It has no routine caller now,
but Supabase can still issue a link for a staff auth user from the dashboard,
and the guard is what makes that safe.

---

## Verified against production (corrections to the audit)

The audit was written believing the Supabase credentials were unusable. They are
not — the following was measured directly, and it changes the plan.

### There are no customer accounts. At all.

| dataset | rows |
|---|---|
| `accounts` — total | 15 |
| `accounts` — **staff** | **15** |
| `accounts` — **customer** | **0** |
| `deals` | 0 |
| `documents` where `owner_kind='account'` | 0 |
| `dsr_requests` | 0 |
| `saved_searches` | 0 |
| `referrals` | 0 |
| `tour_requests` | 0 |
| `saved_properties` | 2 |
| `recently_viewed` | 2 |
| `enquiries` with `account_id` set | 1 |

Every `accounts` row belongs to a staff member (the row is created by the
`handle_new_user` trigger for any auth user, staff included). The 2 saved
properties, 2 recently-viewed and 1 linked enquiry are all from internal
testing.

**Consequences, and they are large:**

- **D4 (remediate existing personal data) is essentially void.** There is no
  customer PII to anonymise or export. The obligation continues for *future*
  data and for the 290 newsletter subscribers, but there is no backlog and no
  affected user to notify.
- **D5 (Deal Room) and D6 (KYC) are forward-looking only.** With 0 deals and 0
  account documents there is nothing to preserve read-only — the question is
  purely whether staff need a way to create buyers and collect KYC in future.
- **Phase 8 (data remediation) collapses to a no-op** beyond a confirming query.
- **Phase 9 (schema destruction) is far safer than the audit assumed** — these
  tables are empty, so dropping them destroys nothing. It is still last, and
  still optional.

### No DB-driven navigation points at the account surface

Checked live, not just in migrations: `megamenu_items`, `megamenu_featured_tiles`,
`megamenu_tabs` and every `pages.blocks` document contain **zero** hrefs matching
`/account`, `/sign-in`, `/sign-up`, `/magic-link`, `/forgot-password` or
`/reset-password`.

So pre-flight item **2d is cleared**, and `e2e/megamenu-links.spec.ts` will not go
red for invisible reasons. Editors could still add such a link by hand later;
nothing enforces it.

### Pre-flight 2c is cleared

The counts above are that reconnaissance. No further credential work is needed
before Phases 8–9.

### Still true, and still the whole difficulty

The four traps were each verified by hand in this worktree:

```
app/[locale]/(public)/_components/filter-bar.tsx:21   saveCurrentSearch   from @/app/(account)/_actions
components/brand/save-button.tsx:8           toggleSavedProperty from @/app/(account)/_actions
```
`rm -rf "app/(account)"` breaks the **public** build.

```
app/[locale]/(staff-auth)/admin/login/_form.tsx:10    signInAction  from @/app/[locale]/(public)/(auth)/_actions
components/brand/cms-user-pile.tsx:14        signOutAction from @/app/[locale]/(public)/(auth)/_actions
components/brand/public-mega-nav-mobile.tsx:18  signOutAction
components/brand/account-menu.tsx:16            signOutAction
```
`rm -rf "app/[locale]/(public)/(auth)"` breaks **staff sign-in and sign-out**.

```
app/[locale]/(admin)/admin/deals/_actions.ts:73       if (!enquiry.account_id) return …
supabase/migrations/0012_deal_room.sql:71    buyer_account_id uuid not null … on delete restrict
```
No customer accounts means **no new deal can ever be created** — and nothing
fails at build time to warn anyone.

```
supabase/migrations/0011_dsr.sql:33          account_id … on delete cascade
```
`DELETE FROM accounts` would destroy the DSR audit trail. Never hard-delete —
though with 0 `dsr_requests` today there is nothing yet to lose.

---

# Removal plan — customer accounts (`app/(account)/` + customer auth)

**Status: COMPLETE.** Executed 2026-07-30/31 across PRs #210, #211, #212, #213,
#214, #216 and #218. All ten decisions resolved; see ADR-0005 for the summary
and the reasoning that outlives this document.

*(Original status: proposal, needs sign-off.)* Nothing in this plan is executed until §1 (decisions) and §2 (exemptions) are answered in writing.

**Governing rule for the whole plan:** *app code first, schema last.* Every account table is read or written by surviving **public** or **staff** code, so any migration that lands before the app-side edit takes down the public marketplace or a cron. Schema destruction is Phase 9 and is optional.

---

## 0. What this actually is

The audit's headline finding is that "customer accounts" is not a subtree — it is a cross-cut. Verified in this worktree:

```
app/[locale]/(public)/_components/filter-bar.tsx:21   import { saveCurrentSearch } from "@/app/(account)/_actions";
components/brand/save-button.tsx:8           import { toggleSavedProperty } from "@/app/(account)/_actions";
```

`rm -rf "app/(account)"` fails `npm run build` on the **public** tree, not the account tree.

```
app/[locale]/(staff-auth)/admin/login/_form.tsx:10    import { signInAction, type AuthState } from "@/app/[locale]/(public)/(auth)/_actions";
components/brand/cms-user-pile.tsx:14        import { signOutAction } from "@/app/[locale]/(public)/(auth)/_actions";
```

`rm -rf "app/[locale]/(public)/(auth)"` breaks **staff sign-in and staff sign-out**.

So the removal is ~10 PRs, of which only two are deletions of the account tree itself. The rest are decoupling, replacement, and compensation for staff features whose only input was the customer surface.

---

## 1. DECISIONS THE CLIENT MUST MAKE (blocking)

No phase past Phase 2 starts without these. Each has a recommendation, but the decision is not mine.

| # | Decision | Why it can't be inferred | Recommendation |
|---|---|---|---|
| **D1** | **The public save/heart button and "Save search".** Remove entirely, or keep as an anonymous/localStorage feature? | `components/brand/save-button.tsx` renders on every listing card (`components/brand/listing-card.tsx:140`) on home, `/buy/search`, `/rent/search`, `/off-plan/search`, `/commercial`, `/exclusive`, `/new-this-week`, `/price-drops`, `/areas/[slug]`, `/agents/[slug]`, and the PDP action row. `filter-bar.tsx:97-142` is the **only** entry point for creating a saved search anywhere in the product. This is public UX, not account UX. | **Remove both.** A signed-out-only marketplace can't persist saves server-side, and a localStorage heart that silently loses state on device change is worse than no heart. If the client wants it kept, that becomes a separate build (anonymous cookie-scoped shortlist), not part of this removal. Note `app/api/shortlist/route.ts` already exists and may be the seam. |
| **D2** | **PDPL DSR capability.** `/account/data-export` and `/account/data-deletion` are the *only* implemented right-of-access and right-to-erasure paths. `app/[locale]/(admin)/admin/settings/backups/page.tsx:26-34` only **counts** `dsr_requests`; it has no fulfilment UI (its own copy at :170 says "separate from individual /account/data-export"). The published privacy notice names those exact URLs (`app/[locale]/(public)/legal/_layout.tsx:91-96` on all three legal pages, `legal/privacy/page.tsx:278,285`, `legal/terms/page.tsx:164`). | **A replacement must ship before or with the removal.** Cheapest defensible option: a public unauthenticated DSR form writing `dsr_requests` + keeping the 24h email-token confirm (`lib/dsr.ts:14-17`), plus a staff fulfilment action reusing `buildDataExport()` and the `anonymise_account` RPC. Second option: `mailto:` the DPO (already at `legal/_layout.tsx:82`) + a staff-side fulfilment action. Doing nothing is a compliance regression, not a cleanup. Legal copy must change in the same PR. |
| **D3** | **`/sign-in` disposition:** keep as the customer-facing shell, 301 → `/admin/login`, or 404? | 22 non-account references, including `lib/auth.ts:42` (`requireSignedIn` → every admin server action), `lib/supabase/proxy.ts:81` (non-admin gate fallback), `app/auth/callback/route.ts:27,30,37`, `app/[locale]/(public)/sso/[provider]/callback/route.ts:24,32`, `app/[locale]/(public)/(auth)/reset-password/_actions.ts:71`, and `app/[locale]/(staff-auth)/admin/login/_form.tsx:111` ("Not staff? Customer sign-in"). | **Delete the page, repoint every reference to `/admin/login`, and add a permanent redirect `/sign-in → /admin/login`** so old bookmarks and in-flight emails land somewhere sane. Do **not** 404 it — `lib/auth.ts:42` would then send anonymous admin hits to a 404 instead of a login. |
| **D4** | **Existing personal data in `accounts`.** Anonymise, retain as-is, or export-then-anonymise? | The rows hold `first_name, last_name, nationality, residency_status, preferred_language, marketing_opt_in, kyc_status` and anchor PII across enquiries, viewings, messages, valuations, tour_requests. Deleting the feature deletes the *access path* while leaving the data and the PDPL duty. **Hard-deleting is forbidden:** `dsr_requests.account_id` is `ON DELETE CASCADE` (`0011_dsr.sql:33`) — a `DELETE FROM accounts` destroys the entire history of DSR fulfilment, i.e. the compliance evidence. | **Run `anonymise_account(user_id)` for every non-staff account row as an explicit, logged step**, after offering affected users an export. Never `DELETE`. Also decide whether `accounts.marketing_opt_in` (the stored consent record) is retained as consent evidence before Phase 9 drops the column. |
| **D5** | **Does the admin Deal Room stay openable?** With no customer accounts, `app/[locale]/(admin)/admin/deals/_actions.ts:73` (`if (!enquiry.account_id) return …`) never passes, because `account_id` is only populated for signed-in enquirers. `deals.buyer_account_id` is `not null references accounts(user_id) on delete restrict` (`0012_deal_room.sql:71`). **No new deal can ever be created.** | This is the highest-severity finding in the whole audit and the client may not realise they are choosing it. Either (a) build a staff-side "create buyer record" surface that inserts an `accounts` row (Phase 5), or (b) accept that Deals becomes read-only for existing rows and hide the Create-deal affordance. Recommend (a). |
| **D6** | **KYC intake.** `documents WHERE owner_kind='account'` (passport / Emirates ID / proof of funds, 7-year AML retention) can only be created by `app/(account)/account/documents/`. After removal: `/admin/settings/compliance` KYC counter counts only legacy rows, `/api/admin/kyc-review` has no new input, `lib/queries/deal-gate.ts:46-48` blocks `mou → deposit` on "Buyer KYC missing" **forever**, and `lib/queries/documents.ts:57` (which UNIONs deal docs with the buyer's account vault) silently renders half-empty. | Build a staff **upload-on-behalf-of-buyer** path in Phase 5, or a tokenised one-off upload link. Otherwise the KYC pipeline and the deal stage gate are dead with no compile error to warn anyone. |
| **D7** | **Newsletter.** Survives untouched? | Confirmed **not** account-gated: public signup (`app/[locale]/(public)/_components/newsletter-signup.tsx`, mounted on home / `/insights` / article pages), token confirm + unsubscribe are public routes, and every write goes through a service-role client so no account RLS policy is involved. 290 live rows, Mailchimp two-way synced. | **Yes, survives.** Only `app/(account)/account/newsletter/` (the signed-in preference page) and `unsubscribeFromAccount` (`app/[locale]/(public)/_actions/newsletter.ts:245`) are account-only. Separately flag: `listNewsletterSubscribers` (`lib/queries/newsletter.ts:22`) has **zero callers** — there is no admin newsletter view, so after this change the client has no in-CMS window onto the one customer dataset they're keeping. Recommend a small `/admin/newsletter` list as a follow-up. |
| **D8** | **AI Concierge anonymous cap.** `app/api/concierge/route.ts:127` caps anonymous sessions and tells the user *"Sign in to continue."* With no customer sign-in, every user is permanently anonymous and the Concierge becomes unusable past N turns with no escape. | Raise/remove `MAX_ANON_TURNS` and rewrite the copy to hand off to a human advisor. Nothing errors at build time, so this is easy to ship broken. |
| **D9** | **`/sign-up` and the first-admin bootstrap.** `supabase/seed.sql:8` and `docs/HANDOVER.md:218` document `/sign-up` + `scripts/promote-staff.sh` as the way to create the **first** staff user. `/staff-invite` requires an already-authenticated admin. | Replace the bootstrap with a service-role script (or a seeded auth user) **before** deleting `/sign-up`, or a fresh environment at handover has no way to create its first admin. |
| **D10** | **Does Supabase Auth keep sending email at all?** After `/sign-up` goes, the only remaining Supabase-sent email is the magic link — which exists solely for staff recovery (see Phase 7). Keep it, or retire the Supabase mailer entirely in favour of the Resend token flow? | Two delivery systems are live and independent. Our own mail goes through `lib/email.ts` → Resend. Supabase Auth's mailer is separate, has its own templates that exist **only** in the Supabase dashboard, and is governed by `site_url` / `uri_allow_list` rather than by anything in this repo. Since 2026-07-31 it is configured with custom SMTP pointing at Resend (`scripts/configure-auth-email.sh`). Meanwhile `app/[locale]/(admin)/admin/agents/_actions.ts:166-208` already implements a full Resend-delivered staff password link, proven end to end in production. So staff recovery has **two** working implementations, and one of them is redundant. | **Retire the Supabase mailer.** Repoint `/forgot-password` at the Resend token flow, drop `/magic-link`, and Supabase Auth stops sending email entirely — one delivery system, no dependency on Supabase redirect config, and the auth-email rate limit stops mattering. Keep the SMTP config in place regardless: it costs nothing and is the fallback if a Supabase-dashboard recovery email is ever needed. **If instead the magic link is kept**, its Supabase template must be rewritten by hand — custom SMTP changed the envelope sender, not the branding. |

---

## 2. Pre-flight requirements (before Phase 0)

**2a. Locked-file exemption.** Project memory records that `components/brand/*`, `components/ui/*` and `lib/queries/properties*` are do-not-edit shared files whose edits get reverted. This removal **cannot** be done without editing seven of them:

| File | Why it must change |
|---|---|
| `components/brand/save-button.tsx` | imports `@/app/(account)/_actions` (build break) |
| `components/brand/listing-card.tsx:131-160` | renders the heart; note `:147-154` renders a **decorative non-clickable heart when `propertyId` is absent**, so "stop passing propertyId" leaves a dead glyph on every card |
| `components/brand/public-mega-nav.tsx:17,135` | `AccountMenu` mount + `/account/saved` button, sitewide |
| `components/brand/public-mega-nav-mobile.tsx:18,214,249` | `signOutAction`, "Saved properties", "Sign in" |
| `components/brand/account-menu.tsx:88-101` | five `/account/*` links |
| `components/brand/public-nav.tsx:7,50` | dead code, same links |
| `lib/queries/properties.ts:9-27` | `getSavedPropertyIds()` |

**Get this exemption in writing, naming these seven files, or the work is reverted.**

**2b. Verify at least two active admins exist** before Phase 7 touches password recovery. Staff recovery today runs entirely through customer pages: `/admin/login` → `/forgot-password` → `/magic-link` → `/auth/callback` → `/account/saved`. If there is one admin and they get locked out mid-migration, the only remaining path is a Supabase-dashboard recovery email.

**2c. Live DB reconnaissance.** *(Updated 2026-07-31 — partly unblocked.)* The
`SUPABASE_ACCESS_TOKEN` in `.env.local` is **not** stale: it authenticates
against the Management API for project `ztxbguvmwpqccxuqwdqa` (which backs
production), and was used on 2026-07-31 to read and change the live auth config
(see `scripts/configure-auth-email.sh`). Table-row counts still need a SQL path
rather than the Management API. Before Phase 8 or 9, someone must produce counts
for: `accounts` (split staff vs customer), `saved_properties`, `saved_searches`, `recently_viewed`, `referrals`, `comparisons`, `tour_requests`, `dsr_requests`, `documents WHERE owner_kind='account'`, and `deals` (they pin `accounts` rows via `on delete restrict`).

**2d. Check live `megamenu_links.href` in prod.** Every migration is clean — zero `/account`, `/sign-in`, `/sign-up` hrefs across all of `supabase/migrations/` (only three prose comments). But `/admin/megamenu` and `/admin/navigation` are live editors, and `e2e/megamenu-links.spec.ts` reads hrefs from the DB and fails on any 404 — a spec that goes red for reasons invisible in the diff.

---

## 3. Phases

Each phase is one PR. Phases 0–2 are reversible and safe to land immediately. Nothing after Phase 2 lands without the relevant decision.

---

### Phase 0 — Safety net + free dead code
*Risk: none. Reversible. No behaviour change.*

**The suite cannot currently protect the staff trap.** `app/[locale]/(public)/(auth)/_actions.ts` has **no test file**, and `playwright.config.ts` has no `globalSetup` and no `storageState` project — **no e2e test ever authenticates, as customer or staff.** You can break `/admin/login` and the full CI gate may still pass. Fix the harness before touching the code.

**Add**
- Unit spec for `signInAction` (staff branch + non-staff branch + `pickPostSignInPath` interaction).
- Playwright smoke: `/admin/login` renders, has email+password+submit, and its `Forgot?` and footer links resolve (no 404).
- Optional but valuable: an authenticated Playwright project (storageState) for a staff user, so later phases have real verification.

**Delete**
- `components/brand/public-nav.tsx` — dead code, zero importers repo-wide (only prose comments in `app/(account)/layout.tsx:11`, `public-mega-nav.tsx:26`, `account-menu.tsx:20`). Already tracked in `docs/FOLLOWUPS.md:82`. This also removes the second importer of `account-menu.tsx`, simplifying Phase 6.

**Edit**
- `CLAUDE.md:123`, `docs/PROJECT_UNDERSTANDING.md:130,160` — drop `PublicNav` from the brand component list.

**Verify:** full CI gate. New specs pass. Manual `/admin/login` sign-in.

---

### Phase 1 — Decouple staff auth from the customer auth module
*Risk: medium (touches the staff door). No deletions. Fully reversible.*
**Traps addressed: 1 (staff auth).**

**Edit (move, don't delete)**
- Move `app/[locale]/(public)/(auth)/_actions.ts` → a group-neutral location (e.g. `app/_actions/auth.ts`). Repoint all four importers: `app/[locale]/(staff-auth)/admin/login/_form.tsx:10`, `components/brand/cms-user-pile.tsx:14`, `components/brand/account-menu.tsx:16`, `components/brand/public-mega-nav-mobile.tsx:18`, plus the three customer pages. Keep `signInAction`, `signOutAction`, `AuthState` byte-identical in behaviour.
- `lib/auth-redirect.ts:39,42` — repoint the non-staff branches away from `/account` (to `/` or, per D3, `/admin/login`). **Keep `safeRelativePath` untouched — it is the open-redirect guard.** Update `lib/auth-redirect.test.ts:7,28,36-46,62`; keep the staff branch and the guard cases.
- `app/auth/callback/route.ts:49` — `next ?? "/account/saved"` → `pickPostSignInPath(...)` or `"/"`. Update the docstring at `:9`.
- `app/[locale]/(public)/sso/[provider]/callback/route.ts:21` — same default.

**Verify:** CI gate; manual staff sign-in **and sign-out** from the CMS user pile; manual magic-link round trip landing somewhere real; `e2e/admin-rbac.spec.ts` still green (anon `/admin` → `/admin/login`).

---

### Phase 2 — Lift the two shared server actions out of the doomed route group
*Risk: low. No behaviour change. This is the PR that makes `rm -rf "app/(account)"` possible later.*

**Edit**
- Move `toggleSavedProperty` and `saveCurrentSearch` out of `app/(account)/_actions.ts` into a neutral module (e.g. `app/_actions/saved.ts`). Repoint `components/brand/save-button.tsx:8` and `app/[locale]/(public)/_components/filter-bar.tsx:21`. Leave `updateSavedSearchAlert` / `deleteSavedSearch` where they are — they die with the tree.
- Drop the now-meaningless `revalidatePath` targets only where the path is being removed later; leave them for now to keep the diff behaviour-neutral.

**Verify:** CI gate; heart toggles and "Save search" still work signed-in (needs a customer session — see §5); anonymous heart still pushes to `/sign-in?redirect=…`.

> After Phase 2, the account route group has **zero** inbound imports from outside itself. That is the checkpoint.

---

### Phase 3 — Remove the public save/heart + save-search affordances *(requires **D1**)*
*Risk: medium — this is visible public UX on nearly every page.*
**Traps addressed: 3 (public save surface).**

**Delete**
- `components/brand/save-button.tsx` and the newly-relocated `toggleSavedProperty` / `saveCurrentSearch`.
- `app/[locale]/(public)/_components/saved-ids-provider.tsx`, `app/[locale]/(public)/_components/listing-card-saveable.tsx`, `app/api/saved-property-ids/route.ts`, `lib/queries/saved-ids.ts`.
- `lib/saved-search-alerts.ts`, `lib/saved-search-alerts.test.ts`, `app/api/cron/saved-search-alerts/route.ts`, `app/api/cron/saved-search-alerts-diff/route.ts`.

**Edit**
- `components/brand/listing-card.tsx:131-160` — remove the heart from all three variants **including the decorative no-`propertyId` branch at :147-154**. Overlay keeps Compare + Verified pill + price-drop badge.
- All six `SavedIdsProvider` / `ListingCardSaveable` mount sites: `app/[locale]/(public)/page.tsx:194,204`, `areas/[slug]/page.tsx:367,377`, `agents/[slug]/page.tsx:347,361`, `_components/curated-grid.tsx:76,86`, `_components/search-list.tsx:112,196,233`, and the docstring in `_components/marketing/map-listing.ts:12`.
- `app/[locale]/(public)/p/[slug]/_components/action-row.tsx` — 5 controls → 4 (drop Save; Compare/Share/Send-to-advisor are unaffected).
- `app/[locale]/(public)/_components/filter-bar.tsx:21,68,97-142` — remove the Save-search button and the `isAuthed` read.
- `lib/queries/properties.ts:9-27` — remove `getSavedPropertyIds`; remove its call sites `app/[locale]/(public)/p/[slug]/page.tsx:22,200,322,609`. **Locked file — needs the §2a exemption.**
- `vercel.json` — delete the three cron entries at `:5`, `:9`, `:25`. **Leaving them means Vercel invokes 404s three times a day plus every 15 minutes** (ADR-0003's silent-failure gap). Cron count 15 → 12. (`CLAUDE.md` claims 13; it was already wrong.)
- `e2e/lead-lifecycle.spec.ts:49-54` — remove both saved-search endpoints from `CRON_ROUTES` (it currently asserts they fail closed 401/503).
- `docs/HANDOVER.md:200`, `docs/decisions/ADR-0003-*.md:36,40,44` — cron list.
- `app/[locale]/(public)/tools/compare/page.tsx:433` and `_components/picker-drawer.tsx:76` — remove the "Open saved properties" links.
- `app/api/concierge/route.ts:124-128` — per **D8**.

**Do NOT** drop `saved_properties` / `saved_searches` / `recently_viewed` in this PR. Schema is Phase 9.

**Verify:** CI gate. Re-run the indirect guards that cover these surfaces since nothing asserts the heart directly: `e2e/a11y.spec.ts` (scans exactly the four routes that mounted `ListingCardSaveable`, wcag2aa, no disabled rules), `e2e/marketplace.spec.ts:20-24` (clicks `a[href^='/p/']` inside the saveable card — likely needs a selector update), `e2e/view-toggle.spec.ts`, and `npx lhci autorun` (accessibility floor 0.9 on `/`, `/buy`, `/p/...`). Visual check of the card overlay on all three variants and the PDP action row.

**Upside to tell the client:** `app/[locale]/(public)/p/[slug]/page.tsx` declares `revalidate = 60` (:115) but calls `getSessionUser()` (:196), `getSavedPropertyIds()` (:201) and `recordView()` (:209) — cookie reads that force per-request rendering. Removing them lets the PDP genuinely cache. `e2e/buy-cache.spec.ts:8-9` documents that this exact win was already taken for `/buy/search`.

---

### Phase 4 — Replace the PDPL DSR capability *(requires **D2**)*
*Risk: legal. Lands **before** Phase 6, never after.*
**Traps addressed: 6 (PDPL).**

**Add**
- Public, unauthenticated DSR request route (export + erasure), writing `dsr_requests` and reusing the existing 24h email-token confirm pattern (`lib/dsr.ts:14-17`) so the confirm handler no longer sits behind the `/account` gate.
- Staff fulfilment action reusing `buildDataExport()` (`lib/dsr.ts`) and `admin.rpc("anonymise_account", …)`, wired into `/admin/settings/backups` so its pending/fulfilled/expired StatCards (`page.tsx:26-34`) stay live instead of going permanently zero.

**Edit**
- `app/[locale]/(public)/legal/_layout.tsx:91-96`, `legal/privacy/page.tsx:278,285`, `legal/terms/page.tsx:164`, `app/[locale]/(public)/data-deleted/page.tsx:24,48` — repoint to the new mechanism. Keep the 30-day response promise (`privacy/page.tsx:310-314`) satisfiable.
- Counsel drafts `docs/drafts/PRIVACY_POLICY_DRAFT.md:139,141`, `TERMS_OF_SERVICE_DRAFT.md:34,128`.
- `e2e/dsr.spec.ts` and `e2e/legal-pages.spec.ts:27,30` — **retarget, do not delete.** These two specs are the tripwire that caught this problem; they earn their keep. Note `e2e/dsr.spec.ts:13-31` is the repo's **only** coverage of the public `app/[locale]/(public)/data-deleted` page (success copy + `?reason=expired` branch) — preserve that block.
- `lib/dsr.ts` / `lib/dsr-templates.ts` — **keep and re-home**, do not delete. The archive shape (`lib/dsr.ts:36-44`) covers enquiries, viewings, messages and `newsletter_subscription` — data about leads and the 290 newsletter subscribers **who never had an account** and whose records survive this whole exercise. The PDPL obligation outlives the accounts feature.

**Verify:** end-to-end DSR request → token → export download, and request → token → anonymise, both as an anonymous visitor. Legal pages have no dead links. `e2e/dsr.spec.ts`, `e2e/legal-pages.spec.ts` green.

---

### Phase 5 — Compensate the staff features that lose their only input *(requires **D5**, **D6**)*
*Risk: this is a build, not a removal. Sequence it before Phase 6 so Deals never has a broken window.*
**Traps addressed: 2 (enquiries are a staff feature).**

**Add**
- Staff "create buyer record" surface inserting an `accounts` row, so `deals.buyer_account_id` (not-null FK) can be satisfied without customer self-signup. Then either relax or re-plumb the gate at `app/[locale]/(admin)/admin/deals/_actions.ts:73` and the `buyer_account_id` writes at `:98,:124`, plus the conditional Create-deal button at `app/[locale]/(admin)/admin/enquiries/[id]/page.tsx:226`.
- Staff upload-on-behalf-of-buyer for `owner_kind='account'` documents — an admin equivalent of `createAccountDocumentUpload` (`lib/documents-storage.ts:77`), whose only caller today is the account tree and which asserts `user.id === ownerUserId` at `:103`. Without this, `lib/queries/deal-gate.ts:46-48` blocks `mou → deposit` on "Buyer KYC missing" permanently and `/admin/settings/compliance/page.tsx:36-40` counts only legacy rows.

**Edit**
- `lib/queries/documents.ts:57` — decide whether `listDocumentsForDeal` keeps UNIONing the buyer's account vault (it should, for legacy rows).

**Verify:** create a deal from an enquiry end-to-end; upload buyer KYC as staff; advance a deal through `mou → deposit → noc_pending`. This needs a staff login (§5).

---

### Phase 6 — Delete the account route tree
*Risk: high blast radius, but by now every inbound edge has been cut. This is the load-bearing PR.*
**Traps addressed: 3, 6 (both already neutralised upstream).**

**Delete**
- `app/(account)/` entirely: `layout.tsx`, `_components/account-sidebar.tsx`, `_actions.ts` (residue), and all of `account/{page,saved,alerts,viewings,enquiries,documents,profile,referrals,newsletter,data-export,data-deletion}` including both `confirm/[token]` route handlers.
- `components/brand/account-menu.tsx`.
- Account-only libs: `lib/queries/referrals.ts`, `lib/schemas/account-profile.ts`, and the account-only exports `listEnquiriesForUser` (`lib/queries/enquiries.ts:209`), `listTourRequests` (`lib/queries/tour-requests.ts:74`), `listRecentlyViewed`, `getMyNewsletterSubscription` (`lib/queries/newsletter.ts:45`), `unsubscribeFromAccount` (`app/[locale]/(public)/_actions/newsletter.ts:245`), `createAccountDocumentUpload` (`lib/documents-storage.ts:77`) — *unless Phase 5 re-homed the last one for staff use*.
- `lib/types/sprint-8.ts:13-30` (the `ReferralStatus` / `ReferralRow` block) **only**. **Do not delete the file** — it is imported by `app/api/cron/brn-validation/route.ts:20`, `/admin/settings/compliance`, `/admin/settings/integrations` and eight `lib/queries/*` modules.
- `e2e/account-alerts.spec.ts`, `e2e/account-documents.spec.ts`, `e2e/account-enquiries.spec.ts`, `e2e/account-profile.spec.ts` (four one-test files, each a bare anon-redirect assertion).
- `lib/email-templates.ts:640-668` `viewingReminderTemplate` — has **no caller anywhere**; the email arm of viewing reminders was never wired. Free deletion.

**Edit (must not be missed — none of these produce a compile error)**
- `lib/supabase/proxy.ts:73-81` — remove the `isAccount` branch (`:75`) from the combined gate. **Do not collapse the ternary at `:81` in a way that changes the `/admin` branch** — `e2e/admin-rbac.spec.ts:15` asserts anon `/admin` → `/admin/login`.
- `components/brand/public-mega-nav.tsx:17,135,140` and `public-mega-nav-mobile.tsx:18,214,240,247-252` — remove the "Saved" button, the `AccountMenu` mount, and the mobile "Saved properties" item. Per **D3**, keep or repoint the "Sign in" / signed-in-as / Sign out block — a staff member browsing public pages currently has no other sign-out control on the public header. **Locked files.**
- `lib/email-templates.ts` — five customer-facing URLs, all sent by **surviving staff actions**: `:249,:266` (`cta: "/account/documents"` in the buyer MoU/deposit emails, sent from `/admin/deals`), `:415` (post-valuation nurture day 7, from a surviving cron), `:525` (KYC approved), `:549` (KYC rejected). **The rejection email is the worst — it tells a customer to re-upload at a URL that will 404, leaving no way to complete KYC.** Rewrite copy to whatever Phase 5 / D6 decided. Update `lib/email-templates.test.ts:249`.
- `app/api/admin/kyc-review/[id]/approve/route.ts:106` (`link: "/account/profile"`) and `reject/route.ts:128` (`link: "/account/documents"`) — dead notification deep links.
- Stale no-op `revalidatePath` calls in surviving code: `app/[locale]/(admin)/admin/deals/[id]/_actions.ts:328`, `app/[locale]/(admin)/admin/enquiries/[id]/_actions-viewing.ts:202,244`, `app/[locale]/(public)/_actions/newsletter.ts:194,234,275`.
- `app/[locale]/(public)/_actions.ts:72-97` — the auth-aware client that stamps `account_id: user?.id ?? null` becomes always-null dead weight. **Keep the nullable column** (see below); simplify the lookup only if D5 doesn't need it.
- `lib/queries/recently-viewed.ts` — drop `listRecentlyViewed`; keep `recordView` or remove it *together with* its call at `app/[locale]/(public)/p/[slug]/page.tsx:38,210`.
- `lib/auth.ts:30,42` and `lib/auth.test.ts:55-56,78-79` — per D3, the `requireSignedIn` redirect target. **This test currently asserts the broken behaviour into place; it must be updated, not deleted.**
- `app/robots.ts:14` — drop `/account` from the disallow list; keep `/admin` and `/api`.
- `e2e/newsletter.spec.ts:52-54` — remove the one `/account/newsletter` case from an otherwise-public spec.
- `app/[locale]/(public)/data-deleted/page.tsx` — per D2, either keep as the new deletion landing or delete as an orphan.
- Docstring debris: `lib/deals.ts:238`, `lib/hooks/use-session-email.ts:12`, `app/[locale]/(public)/p/[slug]/_components/schedule-viewing.tsx:14`, `lib/queries/tour-requests.ts:34`, `app/[locale]/(staff-auth)/admin/login/_form.tsx:19`.

**Deliberately kept:** `lib/queries/enquiries.ts` (staff), `lib/queries/documents.ts`, `lib/documents-storage.ts`, `app/api/documents/[id]/download/route.ts`, `lib/deals.ts`, `lib/queries/deal-gate.ts`, `lib/notifications.ts`, `lib/hooks/use-session-email.ts`, `app/[locale]/(public)/_actions/newsletter.ts`, `lib/queries/tour-requests.ts::createTourRequest`, `app/api/cron/viewing-reminders` (it notifies the **staff** agent, never emails a customer — the name misleads), `app/api/cron/post-valuation-nurture`.

**Verify:** CI gate; crawl the site for 404s (or run `e2e/megamenu-links.spec.ts` after the §2d prod check); manual staff sign-in/sign-out; `/admin/deals`, `/admin/enquiries`, `/admin/settings/backups`, `/admin/settings/compliance` all render; legal pages clean; send one of each rewritten email to a test inbox.

---

### Phase 7 — Retire the customer auth pages *(requires **D3**, **D9**)*
*Risk: high — this is the phase that can lock staff out.*
**Traps addressed: 1 (staff auth), plus the unflagged staff-recovery trap.*

**Keep — these are staff-reachable, not customer-only:**
- `/forgot-password` — linked from `app/[locale]/(staff-auth)/admin/login/_form.tsx:78`.
- `/magic-link` — the only content of `/forgot-password` is a button to it (`forgot-password/page.tsx:19`); it is the sole self-service staff password-recovery path.
- `/reset-password` — the `type=recovery` landing from `app/auth/callback/route.ts:44`; reachable by any `auth.users` row including staff, e.g. from a Supabase-dashboard recovery email.
- `next.config.ts:56-60` (`/verify-otp → /magic-link`) — **must survive as long as `/magic-link` does**, or legacy emailed deep links 404.
- `lib/supabase/proxy.ts:27-30` allowlist entries for `/forgot-password`, `/reset-password`, `/magic-link`, `/verify-otp`.

**Recommended:** *move* these four pages into `app/[locale]/(staff-auth)/` and restyle them as staff surfaces, rather than leaving staff recovery living in a route group named `(auth)` under `(public)`. That is a rename PR, not a delete.

**Delete**
- `app/[locale]/(public)/(auth)/sign-up/page.tsx` + `signUpAction` — **only after D9's replacement bootstrap exists.** Remove the dead `type='signup'` branch at `app/auth/callback/route.ts:23`, the link at `sign-in/page.tsx:82`, and `"/sign-up"` from `lib/supabase/proxy.ts:26`. Update `supabase/seed.sql:8` and `docs/HANDOVER.md:218`.
- `app/[locale]/(public)/(auth)/sign-in/page.tsx` per D3, plus a `next.config.ts` permanent redirect `/sign-in → /admin/login`.

**Edit**
- Every `/sign-in` reference: `lib/auth.ts:42`, `lib/supabase/proxy.ts:81`, `app/auth/callback/route.ts:27,30,37`, `app/[locale]/(public)/sso/[provider]/callback/route.ts:24,32`, `app/[locale]/(public)/(auth)/reset-password/_actions.ts:57,71`, `app/[locale]/(public)/data-deleted/page.tsx:48`, `app/[locale]/(staff-auth)/admin/login/_form.tsx:111`, `components/brand/public-mega-nav-mobile.tsx:249`, `lib/auth.test.ts:56`.
- `app/[locale]/(public)/sso/[provider]/callback/route.ts` — unreferenced Sprint-2 shell with no sibling `page.tsx`; safe to delete outright once nothing links it.

**Verify (mandatory manual, in this order, with a second admin standing by):** staff sign-in; staff sign-out from the CMS pile; `/admin/login` → `Forgot?` → `/magic-link` → email → callback → lands on a real page; admin-triggered staff password link (`app/[locale]/(admin)/admin/agents/_actions.ts` → `/staff-invite?purpose=reset`); a fresh `/staff-invite` acceptance end-to-end.

**Email delivery mechanics — read before touching any of the above** *(added 2026-07-31, requires **D10**)*

There are two independent email systems, and the phases above only affect one of them.

| | Sender | What it carries | Affected by this removal? |
|---|---|---|---|
| `lib/email.ts` → Resend | `RESEND_FROM_ADDRESS` | staff invitations, staff password links, enquiry acks, cron mail, DSR, newsletter | No. Staff invites were deliberately moved **off** `inviteUserByEmail` onto our own token flow precisely so they don't depend on Supabase redirect config. **Do not move them back.** |
| Supabase Auth's own mailer | Supabase SMTP (now Resend) | sign-up confirmation, magic link | Yes — both. `/sign-up` is deleted in this phase; the magic link's fate is **D10**. |

Consequences, in order of how easy they are to get wrong:

1. **`/sign-up`'s deletion kills the "Confirm signup" email.** That template lives only in the Supabase dashboard. Don't spend time restyling it — it becomes dead the moment the page goes.
2. **The magic link is not customer UX.** It is the sole self-service staff recovery path (`/admin/login` → `/forgot-password` → `/magic-link`), and there are **zero** `resetPasswordForEmail` callsites repo-wide. Deleting it as "customer auth" locks staff out. Phase 7 already says keep it; D10 is about replacing it deliberately rather than keeping it by default.
3. **`uri_allow_list` and `site_url` only matter while `/auth/callback` is reachable.** Both were empty/localhost in production until 2026-07-31, which is why every auth email had been shipping a localhost link. If D10 retires the Supabase mailer, `/auth/callback` loses its last real caller and the `type='recovery'` and `type='magiclink'` branches can go with it.
4. **`safeRelativePath` in `app/auth/callback/route.ts` must survive** any rewrite of that route. It guards `next` against open redirect, and it is load-bearing *because* the callback is allow-listed. §4 already says not to touch it; this is the reason.
5. **The `rate_limit_email_sent` cap applies only to the Supabase mailer.** It was 2/hour project-wide until 2026-07-31 (now 60). Resend-delivered mail was never subject to it, so nothing in the Resend path needs re-testing against it.

If D10 goes the recommended way, Phase 7's "Keep" list shrinks: `/magic-link`, the `/verify-otp → /magic-link` redirect at `next.config.ts:56-60`, and their `lib/supabase/proxy.ts:27-30` allowlist entries all become deletable, and `/forgot-password` becomes a thin page pointing at the Resend flow instead of a button to `/magic-link`.

---

### Phase 8 — Remediate existing personal data *(requires **D4**)*
*Risk: irreversible on data. Do not combine with Phase 9.*

**Do**
- Take a verified backup / export first.
- Offer affected data subjects an export (via the Phase 4 mechanism) before anonymising, if the client's counsel requires it.
- Run `public.anonymise_account(user_id)` for each non-staff `accounts` row, as a documented migration or a logged script, recording the run. **Never `DELETE FROM accounts`** — `dsr_requests.account_id` cascades (`0011_dsr.sql:33`) and would destroy the compliance audit trail.
- Note that `anonymise_account` deliberately does **not** touch `documents` — KYC files under 7-year AML retention (`admin/settings/backups/page.tsx:57-61`) stay. Confirm that's intended.

**Verify:** row-level spot check that PII columns are nulled/tokenised and `deleted_at`/`anonymised_at` are set; `dsr_requests` history intact; `/admin/deals` still renders buyer names for **staff-created** records and degrades gracefully where anonymised.

---

### Phase 9 — Schema destruction *(OPTIONAL, behind an explicit go/no-go)*
*Risk: highest. Nothing here is required for the feature removal. Recommendation: **defer indefinitely** — dead tables cost nothing, and every one of these has a runtime dependency that a blind drop breaks silently.*

**Absolutely must survive:**
- **`public.accounts`** and **`handle_new_user()` + `on_auth_user_created`** (`0001_core.sql:335-352`). Staff are `auth.users`; `0010_admin_polish.sql:88-93` explicitly documents that `on_auth_user_accept_invitation` runs *after* the trigger that creates the accounts row. Drop the table while the trigger lives and **every staff invite acceptance fails at the Postgres level** (the trigger's INSERT raises and rolls back the `auth.users` insert). `scripts/seed-demo-content/seeds/01-agents.ts:43` calls `auth.admin.createUser` 12 times, so `npm run seed:demo` breaks too. `deals.buyer_account_id` is `not null … on delete restrict` (`0012_deal_room.sql:71`). **Accounts is a staff-infrastructure table now.** (Corollary: it keeps accruing staff rows, so its PDPL surface never reaches zero.)
- **`enquiries.account_id`** — still selected by the shared `getEnquiryById` (`lib/queries/enquiries.ts:134,160`), copied into `viewings.account_id` by `admin/enquiries/[id]/_actions-viewing.ts:78,95`, and required by the deal-creation path. Trap 2: enquiries is a staff feature.
- **`enquiries_own_select`** (`0006:188-189`) — **do NOT drop.** It looks like a customer-only read policy but it is the only policy that lets `insert().select("id")` return a row on the authenticated client in `app/[locale]/(public)/_actions.ts:124-134`. Drop it and the **public enquiry form silently fails** for anyone holding a residual customer session or an invited-but-not-yet-activated staff member. Same mechanism for **`valuation_requests_own_select`** (`0008:126-127`) vs `app/[locale]/(public)/tools/valuation/_actions.ts:150-162`.
- **`dsr_requests`**, **`anonymise_account`**, the anonymise extensions (`0011:101-126`, `0037`), **`notifications_select_own` / `notifications_update_own`** (`0010:167-170` — the *staff* bell), **`audit_log_staff_insert`**, **`licenses`** holder policies, **`documents_staff_all_*`** (`0012:200-219`), the `documents` bucket row, and `deal_buyer_account()`.

**Genuinely dead and droppable, in strict order, in a migration that also rewrites `anonymise_account` in the same transaction:**

1. Drop the customer-only RLS policies that have no live consumer: `conversations_own_select`, `messages_own_select`, `viewings_own_select`, `newsletter_own_select` / `newsletter_own_update`, `dsr_own_select`, `mortgage_inquiries_own_select`, `deals_buyer_select`, `documents_owner_account_select`, `documents_owner_deal_select`, the five `comparisons_own_*` + `comparisons_staff_select`, and the three `storage.objects` account/deal-buyer policies (`0012:222-251` — already dead, since both upload and download go through service-role signed URLs). **Keep `documents_owner_account_insert` if Phase 5 kept a user-scoped upload path.**
2. Drop `mortgage_inquiries.account_id` — **only after** step 1 removes `mortgage_inquiries_own_select`; Postgres refuses to drop a column an RLS policy depends on.
3. Drop `referrals` (+ `referral_status` enum) and `comparisons` — zero app readers.
4. Drop `saved_properties`, `saved_searches`, `recently_viewed` — **only after Phase 3 shipped and the three crons are gone.**
5. Drop `accounts.nationality`, `residency_status`, `preferred_language`, `marketing_opt_in`, `deleted_at`, `anonymised_at` (+ the `accounts(deleted_at)` index from `0011:26-27`, + `account_language` / `account_residency_status` enums) — **only if D4 released `marketing_opt_in` as consent evidence.** Keep `first_name`, `last_name`, `kyc_status`, `kyc_verified_at`: all four are read by `/admin/deals` (`lib/queries/deals.ts:37,109`, `deals/[id]/_actions.ts:158-160`) and `/api/admin/kyc-review`.

**Non-obvious hazards for this phase:**
- `anonymise_account` is plpgsql, so relations resolve at **run time**: dropping any of these tables/columns leaves a function that creates fine and then **throws on the next erasure request** — a silent failure on a legally-required path. Rewrite it in the same migration, every time.
- `reviews.account_id`: `scripts/seed-demo-content/seeds/04-reviews.ts:52` sends `account_id: null` in an upsert payload. Drop the column and `npm run seed:demo` dies with PGRST204 at the reviews step — the handover seeder. Fix that line first.
- Name-based sweeps are dangerous: `valuation_requests.marketing_opt_in` (`0008_tools.sql:55`) is a **different, live, public-tool** column written by `app/[locale]/(public)/tools/valuation/_actions.ts:105`.
- `app/[locale]/(admin)/admin/settings/backups/page.tsx:78` hardcodes the retention string "Saved properties, searches, comparisons, recently viewed" — a **regulatory-facing** admin page that becomes factually wrong. Copy edit, not a compile break.
- Migrations are immutable: everything above is a **new forward migration** with `drop policy` / `drop column`, never an edit to `0008`/`0011`/`0012`. `0038_function_hardening.sql:10-12` names the old account action as the "only legitimate caller" of `anonymise_account` — note the new caller in the replacement migration rather than editing history.
- Regenerate `db/types.ts` (`npm run db:types`) and re-run the full gate after each step.
- **Blocked today:** per project memory the Supabase PAT is stale (401) and MCP cannot reach project `ztxbguvmwpqccxuqwdqa`. No DDL can be applied until that's refreshed.

---

### Phase 10 — Documentation
`CLAUDE.md` (route groups, `(account)` group, brand components, cron count, project status), `docs/PROJECT_UNDERSTANDING.md`, `docs/HANDOVER.md`, `docs/FOLLOWUPS.md`, and a new ADR recording *why* customer accounts were removed and what replaced the DSR path — the next contributor will otherwise re-derive this audit from scratch.

---

## 4. Explicitly DO NOT TOUCH

> **Superseded in one place.** This list was written while Deals and KYC were
> expected to survive. **D5/D6 later resolved to remove both**, so `lib/deals.ts`,
> `lib/documents-storage.ts` and `app/api/documents/[id]/download/route.ts` were
> deliberately deleted in Phase 5/6 and have been struck from the list below.
> Everything else here was verified still present after Phase 10.

- `app/[locale]/(staff-auth)/` — the staff door, other than repointing its `/forgot-password` and `/sign-in` links.
- `app/staff-invite/` and `lib/staff-invitations.ts` — staff onboarding.
- `public.accounts`, `handle_new_user()`, `on_auth_user_created`, `on_auth_user_accept_invitation`.
- `enquiries` (table, admin queries, Kanban, KPIs), `enquiries.account_id`, `enquiries_own_select`, `valuation_requests_own_select`, `conversations` / `messages` staff policies.
- `dsr_requests`, `anonymise_account`, `0011`/`0037` anonymise functions.
- `newsletter_subscribers` and every public newsletter path (`subscribeToNewsletter`, `confirmNewsletterToken`, `unsubscribeNewsletterToken`, both token routes, the Mailchimp webhook).
- `megamenu_tabs` / `megamenu_columns` / `megamenu_links` — this is the **entire public nav** for every page; verified clean of account hrefs, needs **no** data migration.
- `components/brand/public-footer.tsx`, `components/brand/mobile/*`, `mobile-tab-bar.tsx` — verified: zero `/account`, `/sign-in`, `/sign-up` links.
- `app/_consent/`, `lib/consent.ts`, `lib/consent-cookie.ts` — cookie consent touches no database and has zero account coupling.
- `lib/supabase/{server,browser,admin,public}.ts`, `lib/auth.ts::requireRole` (26 admin importers), `lib/audit.ts`, `lib/env.ts`, `lib/types/sprint-8.ts` (the file), `lib/notifications.ts`, `app/api/notifications/*`, `app/api/shortlist/route.ts`.
- The 12 surviving crons, especially `viewing-reminders` (staff-facing despite the name) and `post-valuation-nurture`.
- `notifications_select_own` / `notifications_update_own`, `audit_log_staff_insert`, `licenses` holder policies — same `auth.uid()` shape as the account policies, entirely different owners. **Do not sweep `auth.uid()` policies by pattern.**
- In tests: `lib/deals.test.ts:322-331` (path-traversal guard) and `lib/documents-storage.test.ts:32-42` (the only "anon gets nothing" test) both assert **through `ownerKind: 'account'`**. Re-point them at a surviving `ownerKind`; deleting them silently removes security coverage. Also false positives, leave alone: `lib/preferences/preferences.test.ts` (cookie-based), `lib/consent.test.ts`, `lib/schemas/newsletter.test.ts`, `lib/staff-invitations.test.ts:197` ("suspended account" is a staff row).

---

## 5. What cannot be verified from here — be honest with the client

1. **No staff login available in this environment.** Every staff-path claim in Phases 1, 5, 6 and 7 is verified by reading the import graph, not by signing in. `playwright.config.ts` has no auth setup, so **no automated test authenticates at all**. The CI gate (`lint && typecheck && test:run && build`) can pass with `/admin/login` broken. Manual staff sign-in/sign-out verification after Phases 1, 6 and 7 is **mandatory, not optional**, and Phase 7 should be done with a second admin standing by.
2. **No customer login either**, so the heart toggle and Save-search happy paths in Phase 2 cannot be regression-tested here — only the anonymous branches.
3. **No live database access.** The PAT is stale (401), MCP resolves the wrong projects, no psql/CLI. Every schema claim comes from `supabase/migrations/*.sql` + `db/types.ts` + code. Row counts, actual `deals` rows pinning `accounts`, and the real state of `documents WHERE owner_kind='account'` are unknown. Phases 8 and 9 are blocked on credentials.
4. **Live `megamenu_links.href` is unverified.** Migrations are clean, but `/admin/megamenu` is a live editor and `e2e/megamenu-links.spec.ts` fails on any 404 from DB-sourced hrefs.
5. **Email deliverability of rewritten templates** can't be checked without Resend creds; send-to-test-inbox is a manual step in Phase 6.
6. **`enquiries.account_id` and `enquiries_own_select` have zero test coverage** — a repo-wide grep for `account_id`/`accountId` across all `*.test.ts(x)` returns nothing. The suite stays green whichever way that decision goes. It rests entirely on manual review.

---

## 6. Out-of-scope bugs found en route (log, don't fix here)

- `app/api/cron/viewing-reminders/route.ts:47-53` queries `viewings.scheduled_for`, a column that does not exist (it is `starts_at` — `0006_lead_engine.sql:128`, `db/types.ts:3054`). **The hourly cron has been failing into Sentry.**
- `saved-search-alerts-diff` casts frequency to `"daily"` and runs the daily sweep every 15 minutes, competing with the 04:00 cron for the same rows — a live duplicate-email bug its own comment admits. Phase 3 deletes it, which incidentally fixes it.
- `lib/queries/newsletter.ts:22` `listNewsletterSubscribers` has zero callers; there is no `/admin/newsletter` page. Staff have no UI over the 290 rows (see **D7**).
- `app/(account)/account/documents/page.tsx:70` redirects with `?next=` while `lib/supabase/proxy.ts:82` and every other consumer use `?redirect=`. The `next` param is never read. Pre-existing; dies with Phase 6.
- `CLAUDE.md` says 13 cron jobs; `vercel.json` declares **15**. Already stale before this change.