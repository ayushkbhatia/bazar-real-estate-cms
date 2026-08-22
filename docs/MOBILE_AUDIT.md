# Mobile Optimization Audit — Public Front-End

**Date:** 2026-08-22
**Scope:** every public (non-admin) surface — `app/[locale]/(public)/**`, `components/brand/**`, `lib/page-builder`, `lib/forms`, `lib/master-pages`, `app/globals.css`, `app/_consent`. Admin CMS and `(staff-auth)` explicitly excluded.
**Benchmark:** 393×852 (iPhone 16), verified against a production build and against live `www.bazarrealestate.ae`.

---

## 1. Verdict

The June 2026 mobile build (PRs #109–#114) **holds structurally**. Across 72 route loads at 393px — 38 English routes, 16 detail pages, 18 Arabic RTL routes — there is **zero horizontal overflow**, **zero `100vh` misuse**, and the nav and filter drawers lock scroll, trap focus, and close on ESC correctly. That is a genuinely good result and it should not be re-litigated.

What failed is everything the mobile build did not encode as a rule. It was applied to *routes*, never to the *shared layer*, so the ~155 commits that landed afterward — the Arabic/RTL epic, the Page Builder, the Forms Manager, a dozen new pages — re-introduced the same four defects over and over, because nothing made the wrong thing fail. Two numbers tell the whole story: **8 of the 13 mobile primitives built for that effort have zero consumers anywhere in the repo**, and **Playwright has exactly one project, `Desktop Chrome`**. A responsive single-tree architecture whose entire correctness argument is CSS breakpoints has, in practice, no breakpoint coverage in CI.

So this is both stories at once — regression *and* never-covered — and the never-covered half is worse, because it includes the site-wide chrome that sits on every route.

**Worst single surface:** `/developments`. Desktop `px-12` gutters plus an ungated `grid-cols-2` plus a card-internal `grid-cols-3` compound down to **18px-wide stat columns** holding content that needs 34–51px. The entire off-plan catalogue is unreadable on a phone. Critically, it **clips rather than overflows**, so no `scrollWidth` heuristic would ever have caught it — including mine.

**Highest-leverage fix:** the CI net that does not exist. Every finding below is currently un-gated.

---

## 2. How to read this report

Findings carry a confidence tier. This matters: of the audit's 273 raw findings, **42 were refuted** by adversarial review and several more failed to reproduce when I tested them live. Severity without provenance would be misleading.

| Tier | Meaning |
|---|---|
| **A — Measured** | I reproduced it at 393px against a production build or live production. Numbers in this report are measured, not estimated. |
| **B — Code-verified** | Read in source by an auditor and confirmed by an independent adversarial reviewer. Not reproduced at runtime. |
| **C — Single-source** | One auditor, unverified. Treat as a lead, confirm before acting. |

**Method.** A 14-agent fan-out read the codebase (254 agents total including adversarial verifiers; 273 raw findings, 42 refuted, 231 confirmed, 189 after deduplication). Separately, I ran Playwright probes at 393px measuring geometry, computed styles, network payloads, fixed-element stacking, focus behaviour, and scroll locking. Where the two disagree, **the measurement wins** and the discrepancy is recorded in §9.

---

## 3. What is already correct — do not re-audit

Establishing this is as valuable as the defect list, because it bounds the work.

- **No horizontal overflow on any public route**, English or Arabic, index or detail. *(Tier A, 72 route loads)*
- **Viewport units are deliberately correct.** The only `100vh` in the tree is a `lg:block` desktop aside; `globals.css:494` ships `.min-h-dvh-safe` with a comment explaining the iOS URL-bar collapse. *(Tier A)*
- **Zoom is not disabled** — no `maximumScale`/`user-scalable` in `app/[locale]/layout.tsx:164`. *(Tier A)*
- **Nav drawer and filter drawer are correct**: body scroll locked, focus trapped 25/25, ESC closes. *(Tier A)*
- **`components/ui/input.tsx:11` gets the mobile rule right** — `text-base … md:text-sm`. The primitive is not the bug; the overrides are.
- **MapLibre is correctly lazy on `/buy/search`** grid view. *(Tier A)*
- **`quality={100}` on floor plans is justified** — line drawings ring at 1:1 without it; rationale documented at `p/[slug]/_components/floor-plan-viewer.tsx:17`.
- **The grid-blowout gotcha is well guarded** where it was known — `[&>*]:min-w-0` and `minmax(0,…)` appear with explanatory comments in `renders-gallery.tsx`, `lp/_render.tsx`, `insights/page.tsx`, `lead-band.tsx`.
- **Page Builder `/lp/<slug>` and `pages/[slug]` are clean** — `_render.tsx:284` wraps the document in `overflow-x-clip [&>*]:min-w-0`.
- **`partners/page.tsx` is the model file** — `fluid()` + `px-4 md:px-12` throughout. Use it as the reference when fixing others.
- **The RTL guard G-5 is holding** for physical Tailwind *classes* — a grep across six route trees returns nothing.

---

## 4. Measured baseline

All figures from a production build (`npm run build && npm run start`) at 393×852, iPhone 14 Pro emulation.

| Measurement | Result |
|---|---|
| Routes probed for overflow (EN + AR) | 72 loads, **0 with overflow** |
| Distinct sub-44px touch targets | **194** |
| Distinct sub-16px form controls | **22 field classes**, 13–15px |
| Home hero video transfer | **18.5 MB × 2 = ~37 MB per visit** |
| `<Image fill>` usages with a `sizes` attribute | 58 / 58 (but see §6.3 — present ≠ correct) |
| Raw `<img>` on mobile-visible routes | **4** (+2 legitimate in `opengraph-image.tsx`) |
| Playwright mobile-viewport projects | **0** |
| Lighthouse mobile runs | **0** |

---

## 5. Critical findings

### 5.1 Home hero video — ~37 MB per mobile visit — Tier A

Verified on **live production**, not just locally:

```
URL:            .../media/brand/68a1f4a9-…-bazar_video_graded_b_subtle.mp4
content-length: 19,373,164  (18.5 MB)
cache-control:  no-cache
```

It autoplays on mobile with `preload="auto"` (`hero-video-bg.tsx:69`), and a production build issues **two full-range `206` responses** for it on a single page load — ~37 MB. At a typical 20 Mbps UAE 4G link that is roughly 15 seconds of saturated downlink competing with the LCP image and the search widget's JS.

Three things compound it:

1. **The documented budget is stale.** `hero-video-bg.tsx:35` states the mobile data cost is *"an explicit product choice, not an oversight"* — a decision I respect. But it was made against a **~15 MB** clip (the bundled `public/hero/home-hero.mp4` is 15.4 MB). An **editor uploaded a replacement through the CMS** and production now serves 18.5 MB. Nothing caught the change.
2. **The cost is editor-controlled and unbounded.** The trade-off was accepted at one size; the CMS accepts any upload with no size cap and no alert.
3. **`cache-control: no-cache`** is the Supabase bucket default, so repeat visitors re-download it. (This affects *repeat* visits only — see below.)

**The doubling is not root-caused.** Three hypotheses were tested and all three refuted:

| Hypothesis | Test | Result |
|---|---|---|
| `no-cache` forces a refetch | A/B, identical bytes, correct `Range` handling, header the only variable | **Refuted** — 2 full fetches in both arms |
| Video attributes (`preload`/`autoplay`/`loop`) | 4 attribute combinations in isolation | **Refuted** — 1 full fetch every time |
| React inserts `<video>` then `<source>` separately | 3 insertion orders including the proposed `src=` fix | **Refuted** — 2 requests in all three, *including the fix* |

Also ruled out: component remounting (1 `<video>` in the DOM, never remounted), duplicate SSR markup (no `<video>` in server HTML), and preload links (none). The two requests fire **1 ms apart**.

Treat this as a **timeboxed investigation**, not a known fix. Do not ship a "fix" on the `<source>` theory — it was tested and does not work.

### 5.2 `/developments` collapses to 18px columns — Tier A

```
narrow grid: 3 cols, min track 18px | mt-5 pt-5 border-t border-bz-border grid grid-cols-3 gap-4
CLIPPED: needs 119px got 87px  "Manchester City Yas Residences" | serif text-[32px] mt-2 leading-tight
CLIPPED: needs 162px got  87px "Ohana Development·Yas Island"   | eyebrow flex items-center gap-2
CLIPPED: needs  34px got  18px "AED 2.0M"                       | serif text-[20px] leading-tight
```

`developments/page.tsx:43` uses bare `px-12`; `:67` forces `grid-cols-2` with no mobile base; each card then runs a `grid-cols-3` stat row inside an 87px box. "AED 2.0M" is rendered at `text-[20px]` into an **18px** column.

This is the report's most important structural lesson: **it clips, it does not overflow.** My own `scrollWidth <= innerWidth` probe reported this page clean. Any CI guard needs a *minimum-usable-column-width* assertion, not just an overflow assertion.

### 5.3 Search filter bar becomes unclickable — Tier A

After a 900px scroll on `/buy/search`:

```
header:      y=0  h=72  (sticky, z-40)
filter bar:  y=0  h=61  (sticky, z-20)
Filters button at y=16 → hit-test returns  svg  (the header), not the button
```

Two sticky elements both claim `top-0`. The header wins on z-index, so **the only entry point to the mobile filter sheet is unreachable after one scroll** on every search route. (`filter-bar.tsx:258`, header at `public-mega-nav.tsx:125`.)

### 5.4 Cookie banner covers the primary CTA — Tier A

`fixed inset-x-0 bottom-0 z-50`, measured **227px tall on a 660px viewport — 34% of the screen**. On the home page it covers the bottom half of the hero search widget **including its submit button** on first visit. Its three action buttons are **28px tall** (`size="sm"` → `h-7`) — the smallest touch targets on the public site — and it uses `pb-4` rather than `pb-bar-safe`, putting Accept/Reject in the iOS home-indicator strip. (`cookie-banner.tsx:55,164`)

It also sits above the `z-40` floating CTA dock. *(Tier B — the dock renders off-screen at rest and reveals on scroll, so the overlap is state-dependent; the report's blanket "completely covers" is too strong.)*

### 5.5 Property gallery lightbox — no scroll lock, no focus trap — Tier A

```
bodyOverflow:  visible
scroll leaked: true  (0 → 600 behind the open lightbox)
focus trap:    3/15 inside
aria-modal:    "true"   ← declared, nothing enforces it
```

`p/[slug]/_components/gallery.tsx:145` hand-rolls its dialog instead of using `components/brand/mobile/bottom-sheet.tsx`, whose own header comment notes it uses Radix "so we get scrim, focus trap, scroll-lock and ESC for free". Two other overlays copied this file's pattern.

### 5.6 iOS input zoom on every lead form — Tier A

**22 distinct field classes measured at 13–15px.** Every text input under 16px causes iOS Safari to zoom the viewport on focus. This is the entire conversion funnel.

| Size | Field | Routes |
|---|---|---|
| 13.5px | Home hero search input | `/` |
| 13px | Home hero selects (×2) | `/` |
| 13.5px | `first_name` / `email` / `phone` / `message` | 7 landing routes |
| 13px | Search filter bar input, number, select | 4 search routes |
| 14px | `/services/sell` wizard (6 controls) | seller lead form |
| 14px | Concierge composer | `/concierge` |

**Root cause is precise and counterintuitive:** `components/ui/input.tsx:11` is *already correct* — `text-base … md:text-sm` (16px mobile, 14px desktop). Seven app-level files override it back down with hardcoded `text-[13.5px]` at all breakpoints: `form-renderer.tsx`, `filter-bar.tsx`, `more-filters-drawer.tsx`, `hero-search.tsx`, `lead-gate.tsx`, `_chat.tsx`, `list-property-form.tsx`. The convention existed, was discoverable, and still lost.

There are **~830 hardcoded arbitrary `text-[Npx]` values** in the public tree, none responsive. `components/ui/select.tsx:47` is a genuine primitive-level bug — flat `text-sm`, no `md:` branch.

### 5.7 MapLibre ships to phones that never render a map — Tier A/B

*Tier A:* eagerly loaded (~1.8 MB raw) on **property detail** and **area guides** — the two heaviest mobile templates — for a map below the fold. `/buy/search` grid view gets this right, so the correct pattern already exists in-repo at `_components/area-map/area-map-lazy.tsx:10`.

*Tier B:* statically imported on 5 mobile-visible routes total, including `/contact` and `/about` (`contact/_components/hq-map-canvas.tsx:4`), plus a `hidden lg:block` aside on search that boots a full instance phones never see (`search-list.tsx:374`).

### 5.8 Remaining criticals — Tier B

- **Mobile CTA dock covers page content on ~38 of ~40 routes** — only 2 reserve space for it (`floating-cta-rail.tsx:121`).
- **Nav drawer renders at 75% width (295px of 393px)** with the page visible beside it, and its only close control measures **0×0** — screen-reader only, no visible close button on touch *(Tier A for both measurements)* (`public-mega-nav-mobile.tsx:243`).
- **Development units table**: 9 `<th>` inside `overflow-hidden` with no scroll container and no mobile tree (`_units-table.tsx:61`). Code confirmed; **did not reproduce at runtime** — the table did not render on the development with inventory, so the failure mode (clip vs. squeeze) is unconfirmed.
- **MapLibre has no `cooperativeGestures`** — a one-finger drag traps page scroll (`map-view.tsx:57`).
- **Language toggle is a 30×24px tap target** — the only language control on a phone, on all 37 routes *(Tier A)* (`locale-toggle.tsx:106`).
- **Mobile list view requests ~1200px images for 116px thumbnails**, 24 per page (`listing-card.tsx:175`).
- **8 of 13 mobile primitives have zero consumers** (`components/brand/mobile/index.ts`).

---

## 6. Systemic root causes

These six patterns generate most of the 189 findings. Fixing them is worth more than fixing pages.

### 6.1 No touch-target floor exists in the design system

`components/ui/button.tsx:25` offers `default h-8` / `sm h-7` / `lg h-9` / `icon size-8`. **No size reaches 44px.** That single fact generates **64 touch-target findings** across every cluster; four auditors independently rediscovered it as "a finding in my area".

Worst by reach *(Tier A)*:

| Size | Element | Routes |
|---|---|---|
| 32×24 / 30×24 | EN / العربية toggle | 37 |
| 18px tall | every footer nav link | 23 |
| 31px | social pills | 29 |
| 28px | cookie Accept / Reject / Customize | all |
| 28px | search Filters / More filters / view toggle | search |
| 32×32 | shortlist heart on cards | 6 |
| 16×16 | dual-range slider thumbs | forms |

A single `@media (pointer: coarse) { [data-slot="button"] { min-height: 44px } }` in `globals.css` closes the majority without touching a shared component.

### 6.2 `px-4 md:px-12` is a convention with no enforcement

Bare `px-12` — a quarter of a 393px viewport lost to padding — appears in `curated-grid.tsx` (3 routes), `property-faq.tsx`, `developments/page.tsx`, `careers/page.tsx`, `press/page.tsx`, `legal/_layout.tsx` (3 legal routes + `/ar`), `footer-trust.tsx` (**every public page**), `status/page.tsx`, `sitemap`, `data-deleted`, and both newsletter token pages.

It correlates almost perfectly with unscaled display type (`text-[80px]`, `text-[72px]`, `text-[64px]`, `text-[56px]` with no `md:` step) — the same authors missed both, because both live on the same line of JSX. `_components/marketing/fluid.ts` already solves the type half; nobody outside `marketing/` knows it exists.

### 6.3 "Has a `sizes` attribute" was never "has the right `sizes`"

All 58 `<Image fill>` usages declare `sizes`. That is presence, not correctness: `listing-card.tsx:175` declares `sizes="100vw"` for a **116px** slot — wrong by roughly 10×, on the default mobile search view, 24 cards per page.

Separately, four raw `<img>` tags serve unoptimized Supabase originals to phones — `agents/page.tsx:80`, `agents/[slug]/page.tsx:149`, `_components/advisor-of-month.tsx:32` (on the home page), `tools/compare/page.tsx:482`. Each carries an `eslint-disable-next-line @next/next/no-img-element`, so the lint rule already knew and was silenced.

### 6.4 Sticky/fixed chrome is authored per-component with no shared offset token

`public-mega-nav.tsx:125` is `sticky top-0 z-40 h-[72px]` at *every* breakpoint. `filter-bar.tsx:258` is `sticky top-0 z-20`. `developments/[slug]/page.tsx:850` is `sticky top-0 z-[5]`. Both losers become permanently invisible on mobile, and `scroll-mt-16` anchor offsets were tuned against a number that no longer matches.

The same absence explains safe-area drift: `.pb-bar-safe` exists at `globals.css:488` and is used by `bottom-sheet.tsx` and the CTA rail — but **not** by the nav drawer footer, the cookie banner, the more-filters drawer, or any of the three full-screen image overlays, all of which are `fixed` under `viewportFit: "cover"`.

A single `--bz-header-h` token plus a documented z-index ladder eliminates four findings and prevents the next.

### 6.5 shadcn primitives bake physical direction into their *prop API*, invisible to the RTL guard

`lib/rtl/no-physical-utilities.test.ts` (G-5) catches physical Tailwind *classes* and is holding well. But `<SheetContent side="right">` is a **prop**, not a class, and `components/ui/sheet.tsx:65` compiles it to `right-0` + `border-l` + `slide-in-from-right-10`.

So the site's **primary mobile navigation flies in from the physical right while its `ms-auto` hamburger sits at the physical left under `/ar`** — and G-5 passes. Same defect in `picker-drawer.tsx:119`.

Related RTL-on-mobile findings: the phone field has no `dir="ltr"`, so `+971` renders as `971+` on every Arabic lead form (`form-renderer.tsx:718`); the cookie banner's entire prose is hardcoded English on `/ar`; and G-13's literal guard never scans top-level `components/brand/*.tsx`, so the mobile chrome's English strings are invisible to CI.

### 6.6 Overflow has two failure modes; only one was ever guarded

The blowout gotcha (`min-width:auto` on grid items) is well understood and well guarded. The *worse* pattern is silent: content that **clips inside an ancestor `overflow-hidden`** instead of pushing the page wide — `/developments` (18px columns), `_units-table.tsx`, `investment-metrics.tsx`, `verdict-band.tsx`.

**A `scrollWidth <= innerWidth` assertion catches none of these.** My own probe proved it by reporting `/developments` clean. Any CI guard needs a minimum-track-width assertion too.

### 6.7 Nothing in CI runs at a mobile viewport — and the gap was known and deferred

- `lighthouserc.cjs:60` — `preset: "desktop"`, `throttlingMethod: "provided"`, with an in-file comment conceding *"Mobile-emulation pass lives in Phase 7f tooling"*. It never shipped.
- `playwright.config.ts:29` — one project, `Desktop Chrome`. Only 3 of 43 specs set a phone viewport, each ad hoc and per-incident.
- `e2e/a11y.spec.ts:21` — axe never runs at a phone viewport, and the phone renders different markup than what is scanned.
- `eslint.config.mjs:59` — the rule banning UA-sniffing in the landing-page renderer is **dead**; its glob still points at the pre-i18n path.

A `performance ≥ 0.65` floor on an unthrottled desktop passes comfortably while a 4G phone downloads 37 MB of hero video plus ~1.8 MB of MapLibre it will never render.

---

## 7. Phased remediation plan

Ordering principle: **the net first** (so later phases cannot silently regress), **then the shared layer** (so the per-page list shrinks before anyone opens a page file), **then breakage by user impact**. All phases respect the locked approach — responsive single tree, `md` chrome breakpoint, no UA detection.

### Phase 0 — Mobile CI net · S/M · ships first

`playwright.config.ts`, new `lighthouserc.mobile.cjs`, new `e2e/mobile-geometry.spec.ts`, CI workflow.

Adds a Playwright `mobile` project on `devices["iPhone 13"]`, a mobile Lighthouse job, and one geometry spec over 33 routes (EN + AR) at 390px asserting:

- **(a)** `documentElement.scrollWidth <= innerWidth` — blocking immediately (already green everywhere)
- **(b)** every resolved grid track ≥ 60px, and no element with `scrollWidth > clientWidth + 8` under an `overflow: hidden` ancestor — **this is the assertion that catches `/developments`**
- **(c)** no focusable text control with computed `font-size < 16px` — report-only, blocking after Phase 2
- **(d)** every visible button/link/checkbox ≥ 44×44 with a short allowlist — report-only, blocking after Phase 8

*Why first:* everything after is protected, and (a)–(d) define "done" for the phases that follow.

### Phase 1 — Shared primitives & tokens · S · closes ~40 findings

`app/globals.css` primarily; `components/ui/dialog.tsx`, `components/ui/sheet.tsx` if permitted (see §10).

- `@media (pointer: coarse) { [data-slot="button"] { min-height: 44px } }` — closes the bulk of §6.1
- `--bz-header-h: 72px` token — unblocks Phase 3
- `@media (max-width:767px){ .bzmap__ctrls button{width:44px;height:44px} }`
- `.bz-prose pre { overflow-x: auto }`
- `max-h-[90dvh] overflow-y-auto` on `DialogContent`; logical `side="end"` variant on `SheetContent`
- Extend G-5 to flag `side="left"|"right"`

### Phase 2 — 16px form-control sweep · S · mechanical

Seven files, uniform pattern `text-[16px] md:text-[<existing>]`. Nothing above `md` changes. Closes all 13 `ios-input-zoom` findings — every lead form, both FormRenderer variants, search filters, seller wizard, concierge composer. Turns on assertion (c).

*Highest defect-per-line-changed ratio in the report, zero layout risk.*

### Phase 3 — Site-wide chrome · M

`cookie-banner.tsx`, `public-mega-nav-mobile.tsx`, `public-mega-nav.tsx`, `footer-trust.tsx`, `layout.tsx`, `filter-bar.tsx:258`, `developments/[slug]/page.tsx:850`.

Fixes the unclickable filter bar (§5.3), the cookie banner (§5.4), the RTL drawer side, the 0×0 close control, the 75% drawer width, the hamburger and List targets, `FooterTrust`'s `px-12`, and the floating `LocaleToggle`.

*These are on **every** route — highest real-user impact per line changed.*

### Phase 4 — Layout collapses and clipped content · M/L

`developments/page.tsx` (**critical**), `careers/`, `press/`, `legal/_layout.tsx`, `curated-grid.tsx`, `verdict-band.tsx`, `dbr-gauge.tsx`, `valuation-wizard.tsx`, `property-faq.tsx`, `status/page.tsx`, `price-block.tsx`.

Adopt `fluid()` from `_components/marketing/fluid.ts` for unscaled display type rather than hand-picking breakpoints. Flip assertion (b) to blocking per route as each lands.

### Phase 5 — Tables and horizontal overflow · M

`_units-table.tsx`, `investment-metrics.tsx`, `commute-time-tool.tsx`, `trend-chart.tsx`.

Prefer the `RowCard`/`KeyValueList` stack below `md` where data is per-entity — `_payment-plan.tsx:289` is the in-repo reference — and `overflow-x-auto` + `min-w-[…]` only where a true matrix must stay a matrix. **Re-confirm the units-table failure mode first** (§5.8).

### Phase 6 — Mobile performance · M

`hero-video-bg.tsx`, `map-embed.tsx`, `area-map-detail.tsx`, `hq-map-canvas.tsx`, `search-list.tsx:374`, `listing-card.tsx:175,328`, `agents/page.tsx:80`, `advisor-of-month.tsx:32`, `tools/compare/page.tsx:482`.

`area-map-lazy.tsx:10` is the in-repo pattern for every dynamic-import fix. **Include a timeboxed spike on the video double-fetch (§5.1)** — do not assume a fix.

### Phase 7 — Overlays, sheets and gestures · M

`gallery.tsx` (**§5.5**), `floor-plan-viewer.tsx`, `floor-plan-lightbox.tsx`, `map-view.tsx:57`, `more-filters-drawer.tsx:336`, `picker-drawer.tsx:119`.

Prefer replacing hand-rolled dialogs with `components/brand/mobile/bottom-sheet.tsx`, which already gets scrim, focus trap, scroll-lock and ESC free from Radix.

### Phase 8 — Residual touch targets, hover-only, typography · M · flips the last gate

Everything `pointer: coarse` cannot reach — hand-rolled `h-7`/`h-8`/`h-9` chips and segmented controls, native checkboxes with no `size-*`, the two hover-only affordances (developer marquee never pauses on touch; "Enlarge" invisible on touch), sub-14px body copy.

Prefer swapping to the `Chip` / `SegmentedControl` primitives — that is what they were built for, and it permanently shrinks this list. End of phase: flip assertion (d) to blocking.

---

## 8. Verification strategy

**Constraint that shapes everything:** CI e2e and lhci run against the **live production Supabase/CMS** — an editor's content change can redden `main` with no commit. So every mobile assertion must be a **geometry invariant, never a content assertion**. Never assert on copy, counts, or a specific listing.

**Playwright** — new project (strip `defaultBrowserType`; `e2e/search-view-mobile-default.spec.ts:24` documents why):

```ts
{ name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: undefined } }
```

**Targeted specs, one per behavioural phase:**

- *Phase 3* — with the banner open at 393px, assert the CTA dock's box does not intersect it; assert the filter bar's `y >= 72` after `page.mouse.wheel(0, 900)` **and that hit-testing its Filters button returns that button**; on `/ar`, assert the drawer's `x` matches the hamburger's side.
- *Phase 5* — assert the units table's container has `scrollWidth > clientWidth` **and** `overflow-x: auto` (scrolls rather than clips).
- *Phase 6* — `page.on("request")` on a property detail route; assert no `/maplibre|mapbox-gl/` request before the Location section scrolls into view. Pick the slug off `/buy/search` so there is no CMS coupling.
- *Phase 7* — open the lightbox, wheel 500px, assert `window.scrollY` unchanged; assert `document.activeElement` stays inside the dialog.

**Lighthouse** — `lighthouserc.mobile.cjs`, same URLs, own floor. Note there is **no `preset: "mobile"`** — Lighthouse accepts only `perf`/`experimental`/`desktop`, and mobile emulation is the *default*; passing one fails the run before it scores anything. `lighthouserc.cjs` opts out of that default via `preset: "desktop"`. Land non-blocking, measure three runs, set the floor 5 points under the observed minimum. Add two **resource-budget** assertions that are content-independent and would each have caught a finding alone: `resource-summary:media:size` (the hero video) and `resource-summary:script:size` (static MapLibre). Byte budgets are the right instrument — a category score absorbs a 37 MB video behind runner noise; a budget cannot.

**vitest** — cheap, CMS-free, every commit:

- Extend G-5 to fail on `side="left"|"right"` in JSX under the public roots.
- Fail on `className` containing `px-12` without a matching `px-4` or `md:px-12` in the same string.
- Fail on `text-[Npx]` where `N < 16` on an `<input|<textarea|<select` element.
- Assert the coarse-pointer rule exists in `globals.css`, so a future `npx shadcn add button` cannot silently drop the floor.
- Fix the dead UA-sniffing ESLint glob (`eslint.config.mjs:59`).

---

## 9. Corrections and non-findings

Recorded because a finding list without its refutations invites re-work.

**Claims I made during this audit and then withdrew after measuring:**

| Claim | Status |
|---|---|
| Nav/filter drawers lack a focus trap | **Wrong** — 25/25 contained, ESC works. My probe had selected the cookie banner, which is the first `[role="dialog"]` in document order. The real offender is the **gallery lightbox** (§5.5). |
| Zero raw `<img>` in the public tree | **Wrong** — 4 exist. My grep pattern `"<img "` had a trailing space; all are formatted `<img\n`. |
| Image handling is clean (58/58 `sizes`) | **Misleading** — presence ≠ correctness (§6.3). |
| `quality={100}` is wasteful | **Wrong** — floor plans only, documented rationale. |
| `no-cache` causes the video double-fetch | **Wrong** — disproved by A/B (§5.1). |

**Agent findings that failed to reproduce at runtime** (Tier C — do not action without re-confirming):

- `/press` rows "collapse to ~97px" — measured clean, no narrow track.
- `/tools/mortgage` DBR gauge "pushes the page into horizontal scroll" — measured clean, page overflow 0.
- `/careers` "Why" band "overflows the viewport" — **downgrade to medium**: 3 columns at a 67px minimum track. Cramped, not overflowing.
- `/tools/compare` investment-metrics "two columns unreachable" — page overflow 0 with 4 real listings; a degenerate 1px track suggests an empty-state artifact rather than the described failure.
- Development units table — code confirmed, but no `<table>` rendered on the development that has inventory.

**42 findings were refuted by adversarial review**, several with better reasoning than the original claim. Two worth noting because they document real safeguards: the home mortgage slider's "4px touch target" is actually ~16px (Chromium's native shadow slider overflows the 4px border box and *is* hit-tested, verified by trusted clicks); and directional lucide chevrons *do* mirror under RTL via an unlayered `[dir="rtl"] .lucide-chevron-*` rule at `globals.css:889`.

---

## 10. Open questions

1. **Is `components/ui/*` genuinely off-limits?** The single highest-leverage fix is a 44px floor on `Button`. The plan routes around it with a `globals.css` rule touching no shared file — but `DialogContent`'s `max-h-[90dvh]` and the logical `side="end"` Sheet variant genuinely need `components/ui/dialog.tsx` and `sheet.tsx`. Repo memory records that the original mobile build was granted an explicit exception to edit shared chrome in place. **Does that exception still stand?** It decides whether Phase 1 is four files or forty, and whether Phase 3 can touch `public-footer.tsx` / `public-mega-nav.tsx` at all.

2. **The hero video — remove on mobile, re-encode, or investigate first?** Poster-only below `md` is cheapest and safest. A mobile encode keeps the effect but still costs 2–4 MB on cellular for decoration behind a scrim. Separately: should the CMS enforce an upload size cap, given an editor already pushed it past the documented budget unnoticed? This is a brand/product call, not an engineering one.

3. **`/developments` on a phone: one-up or two-up?** One-up (`grid-cols-1 md:grid-cols-2`) is the correct fix and makes `sizes` correct as a side effect. Two-up requires a full card redesign — the 3-stat row cannot survive an 88px box.

4. **`/exclusive`, `/new-this-week`, `/price-drops` take no `locale` param, never call `setRequestLocale`, and hardcode English metadata.** Intentional carve-out, or did the i18n epic miss them? Decides whether the curated-grid fixes need an Arabic pass.

5. **`DrawAreaTool` and `CommuteTimeTool` render unconditionally on mobile as non-functional placeholders**, and `draw-area-tool.tsx:58` shows internal roadmap copy — *"Polygon drawing lands with Mapbox in Sprint 12"* — to the public. They cost ~470px of an 852px viewport before the first result card. Hide below `md`, hide entirely, or ship?

6. **PDPL touch-target sign-off.** The cookie banner's Reject/Accept sit 8px apart at 28px tall, and the valuation marketing-consent checkbox is a ~13px default glyph. These are consent controls where a mistap records the opposite of the visitor's intent. Does compliance want a stricter minimum (e.g. 48px + enforced separation) than the 44px used elsewhere?

7. **What mobile Lighthouse floor is acceptable to block on?** The desktop floor was softened to 0.65 for runner noise; a throttled mobile run will start materially lower. Recommend landing non-blocking and ratcheting — but blocking on it at all is your call.

---

## Appendix — counts

| | |
|---|---|
| Auditors / total agents | 14 / 254 |
| Raw findings | 273 |
| Refuted by adversarial review | 42 |
| Confirmed | 231 |
| After deduplication | **189** |
| Critical / High / Medium / Low | 23 / 62 / 84 / 20 |

**By category:** touch-target 64 · performance 19 · typography 16 · layout-collapse 15 · ios-input-zoom 13 · fixed-chrome 11 · tooling-gap 11 · overflow 10 · rtl-mobile 10 · a11y-mobile 9 · dual-tree 8 · hover-only 2 · viewport-units 1

**Files with the most findings:** `form-renderer.tsx` 14 · `public-mega-nav-mobile.tsx` 8 · `cookie-banner.tsx` 5 · `developments/page.tsx` 5 · `public-mega-nav.tsx` 5 · `valuation-wizard.tsx` 5 · `globals.css` 5
