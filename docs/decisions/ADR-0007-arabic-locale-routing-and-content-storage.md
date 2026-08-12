# ADR-0007: Arabic locale — URL shape, string layer, and content storage

Date: 2026-08-12
Status: Accepted
Deciders: Engineering, Client

## Context

The site serves a market where Arabic is an official language, and it is
English-only. There is no i18n layer of any kind: `app/layout.tsx` hardcodes
`<html lang="en">` with no `dir` attribute, ~2,600 UI strings are literals in
JSX, 51 tables hold English-only text, and the stylesheet is written in
physical direction utilities — 400 occurrences of `ml-`/`pr-`/`left-` against
exactly one logical utility repo-wide.

Three isolated bilingual spots already exist and were built without a shared
layer: `/ar/legal/privacy` (a hand-written Arabic page), `LegalDocFrame`'s
`locale` prop, and `contact-qr`, which carries 14 hand-declared `*_ar` fields
pinned by a test. [docs/FOLLOWUPS.md](../FOLLOWUPS.md) explicitly recorded that
a third instance should trigger adopting a real i18n layer. This is that point.

Two content populations need opposite treatments. Property listings number in
the hundreds and grow weekly, so hand-authoring Arabic per field is not
operationally viable. Curated surfaces — master pages, developments and areas
sub-pages, navigation, and Page Builder landing pages — are where the client's
brand voice lives, and a machine translation of those is not acceptable.

## Decision

### 1. URL shape: `app/[locale]/`, English unprefixed, Arabic at `/ar/*`

English keeps every URL it has today (`/buy`); Arabic is prefixed (`/ar/buy`),
via next-intl's `localePrefix: "as-needed"` plus a proxy rewrite.

Rejected alternatives:

- **Cookie-only, same URLs.** Google indexes one language per URL, so the
  Arabic site would be invisible to search in its target market, and no Arabic
  link would be shareable. It also forces a `cookies()` read in the root
  layout, which takes ~40 currently-static routes fully dynamic — a cost this
  project already measured and refused once (see the docblock in
  `lib/preferences/provider.tsx`).
- **Subdomain `ar.bazarrealestate.ae`.** Equivalent SEO, but splits analytics
  and cookie state across origins and adds DNS and a second Vercel domain to a
  handover project.
- **Both locales prefixed** (`/en/buy` + `/ar/buy`). Cleanest internally, but
  costs 82 permanent redirects and discards the existing URL equity.

### 2. Strings: next-intl, for code strings only

Message catalogues cover the ~2,600 JSX literals, ~90 zod messages and the
`toast()` calls. They are **never** pointed at DB-backed content, which would
create two writable copies of every CMS string and break the registry-over-DB
contract that `lib/master-pages` and `lib/forms` are built on.

next-intl over a hand-rolled `t()` for one reason that outweighs the rest:
Arabic has six plural categories. A hand-rolled helper gets "N bedrooms" wrong
on the highest-traffic surfaces on the site, and no English-reading reviewer
would catch it.

### 3. Content: inline Arabic twins, derived from `FieldDef`

The Arabic value sits immediately beside its English sibling, at whatever depth
the sibling lives — a column beside a column, a `<key>_ar` key beside a `<key>`
key inside any jsonb bag, including inside a list item.

For the two document systems (master/sub pages, and the Page Builder) the twins
are **derived from the field definitions, not declared**. This is the decisive
property: all 16 master pages, both live subpage kinds and all 16 catalogue
blocks gain Arabic from one change, and so does every section added afterwards.
`contact-qr`'s 14 hand-declared twins are preserved by a precedence rule, so
the existing convention becomes the first citizen of the general one rather
than a special case to migrate.

Rejected: **a polymorphic `content_translations` ledger.** Its main
justification was that adding columns to `properties` would cost extra queries
on the detail route. That turned out to be false — `fetchPropertyExtras` in
`app/[locale]/(public)/p/[slug]/page.tsx` is a documented escape hatch that already
fires on every render and already selects columns the shared field list omits,
so twin columns cost zero additional round-trips. The ledger also cannot
address a list item stably by `field_path`, and it makes an Arabic full-text
search column impossible.

### 4. Machine translation for listings, hand-authored everywhere else

`properties.{title, short_description, description}` and image alt text are
machine-translated, auto-published, and badged in the CMS as machine-written so
staff can refine them. Editing the English source marks the Arabic stale and
re-queues it. Everything curated is hand-authored.

Visitor-authored `reviews` are **never** translated: presenting a machine
translation of a customer's words as their words misrepresents them.

Permit numbers, BRN/ORN, escrow references, prices, legal pages and consent
copy are never machine-translated, enforced by their absence from the target
registry and asserted by a test.

### 5. Missing Arabic falls back to English, per field, in place

Wrapped in `<span lang="en" dir="ltr">` so it stays bidi-correct. Never hidden,
never blocking publish, never `noindex`.

Hiding a section breaks the "exactly one H1" invariant the Page Builder
enforces. Blocking publish is worse: `lib/page-builder/publishability.ts`
records that this project already removed gates that "were blocking listings
that were otherwise ready", and CI reads live production Supabase, so a
content-dependent gate can redden `main` with no commit behind it. After
handover, with no Anthropic key set, a blocking gate would stop every listing.

### 6. The CMS stays English and LTR, permanently

Pinned by a proxy redirect from `/ar/admin/*`. It is 155 physical direction
utilities, 58 directional icons, dnd-kit pixel arithmetic and recharts, for
five internal staff. Keeping it LTR is also what makes every `[dir="rtl"]` rule
in `globals.css` provably inert inside the CMS, which is what keeps the blast
radius of the RTL work small.

## Consequences

- All 82 existing English URLs, all 38 `revalidate` exports and the existing
  cache canary survive unchanged. This was the constraint the URL decision was
  chosen to satisfy, and it is verified by `scripts/ci/assert-static-routes.mjs`.
- Every `revalidatePath()` call naming a public route had to move behind
  `revalidateLocalised()` **before** the segment landed, because under
  `[locale]` a bare call names a cache key that no longer exists and silently
  no-ops. Enforced by `lib/i18n/revalidate.test.ts`.
- The proxy matcher excludes only paths containing a dot, so all 28 route
  handlers are matched by the proxy and needed an explicit non-localised guard.
- Adding a locale means a migration (twin columns, a `locale` CHECK constraint)
  and a message catalogue, not a config flag. That is deliberate: it keeps
  `db/types.ts` honest and keeps the fallback chain reviewable.
- `Locale` moved from `lib/preferences/types.ts` to `lib/i18n/locales.ts`, which
  distinguishes locales the code *knows* (`ALL_LOCALES`) from locales it
  currently *serves* (`LOCALES`). The second is the kill switch: once `/ar` is
  indexed, un-shipping it is a 410-and-Search-Console exercise rather than a
  flag flip, so the flag has to exist before launch.

## Open questions carried into implementation

Recorded here so they are not silently decided by engineering:

1. Whether ADREC/DLD require Arabic listing disclosures in Abu Dhabi — the one
   question that would reclassify this from enhancement to compliance.
2. Who authors and signs off the Arabic, and whether an agency needs a
   CSV export/import path.
3. Whether the Bayut and Property Finder syndication feeds require Arabic.
4. Whether the 29LT Bukra licence (already vendored for `/contact-qr`) covers
   site-wide pageviews, or whether IBM Plex Sans Arabic is the permanent choice.

## References

- [docs/I18N.md](../I18N.md) — how to add Arabic to a new component, section,
  block, form field, table or route.
- [ADR-0001](ADR-0001-postgres-fts-with-meilisearch-fallback.md) — the search
  layer an Arabic FTS column has to coexist with.
- [ADR-0006](ADR-0006-currency-aed-usd-only.md) — the preferences layer whose
  `Locale` reservation this cashes in.
