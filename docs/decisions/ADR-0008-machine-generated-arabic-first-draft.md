# ADR-0008: A machine-generated Arabic first draft for curated surfaces

Date: 2026-08-17
Status: Accepted
Deciders: Engineering, Client

Amends [ADR-0007](ADR-0007-arabic-locale-routing-and-content-storage.md) §4.

> Numbered 0008, not 0009. The content plan referred to this as "ADR-0009"
> throughout; 0008 was never taken, and a gap in the sequence is a worse
> artefact than a renamed reference.

## Context

ADR-0007 §4 says: *"machine translation for listings, hand-authored everywhere
else"*, and its Context is blunt about why — curated surfaces *"are where the
client's brand voice lives, and a machine translation of those is not
acceptable."*

That reasoning was sound and remains sound. What changed is that nobody wrote
the Arabic.

Measured before this work started: **twelve Arabic values existed in the entire
seed layer**, all of them in `lib/master-pages/sections/contact-qr.ts`, which
was bilingual before the epic began. Every other curated field was blank. The
machinery around them was complete — `twins.ts` derived the input, the editor
rendered it, `applyLocale` folded it on read — and all of it resolved to
English, because the fold falls back per field exactly as §5 designs.

So the practical choice was never "machine draft versus hand-authored". It was
"machine draft versus nothing", and nothing had held for the entire epic. A
client cannot review a blank field, cannot correct a blank field, and cannot
tell a blank field from one nobody has got to yet.

## Decision

### 1. Generate a first draft for curated surfaces, once

Master pages, area and development sub-pages, form copy and field labels, the
navigation, and search-appearance metadata get machine-generated Arabic as a
**first draft the client edits**, not as a published voice.

This is the narrowest possible amendment to §4. §4 forbids machine translation
as the finished article; it does not speak to what a human starts from. The
distinction only holds if the draft is genuinely treated as a draft, which is
what the rest of this ADR is for.

### 2. The client's edit always wins, structurally

A stored value beats a generated one everywhere:

- master pages — `fillArabic` runs inside `mergeValues` and writes only into
  twins that are still blank;
- forms — `fillFormArabic` runs after `mergeCopy`/`mergeFields`, same rule;
- flat columns — the record translator skips any row whose `_ar` is non-empty.

There is no path by which a generated string overwrites an authored one. The
moment an editor touches a field, this ADR stops applying to it.

### 3. Generated Arabic is committed source, not a production write

For everything held in a jsonb document, the draft lives in
`lib/master-pages/arabic/master.json` and is applied at merge time. It is
reviewed as a pull-request diff before it is live, reverted with `git revert`,
and checked in CI with no credentials.

Records are the exception and for a reason: a property's title belongs to a
row, changes when an advisor edits the listing, and already has a real column
with an editor pointed at it. Putting that in a repo file would invent a second
source of truth for a field that has one.

### 4. Nothing ships that has not survived the gates

Every generated string passes, in order:

- the nineteen structural checks in `lib/i18n/mt/validate.ts`, plus five added
  during this work for failures the first four hundred strings produced —
  `label-leak`, `punctuation-added`, `orphan-tail`, `self-repeat`,
  `dangling-preposition`;
- a **round trip**: the Arabic is translated back to English by a model told
  nothing about the domain and never shown the source, and a second model
  compares the two English strings.

Calibrated against 177 human-approved catalogue entries, 60 deliberately
mismatched pairs, and 8 failures this project has actually shipped:
**8/8 known-bad caught, 60/60 mismatches rejected, 19–25% false positives.**

A string that fails any gate is **not written**. It renders English — the §5
fallback — and appears on a review list. Coverage is the price; correctness is
not.

### 5. What is still never machine-translated

Unchanged from ADR-0007, and re-affirmed:

- visitor-authored `reviews`, at any confidence;
- anything carrying a price, a permit number or a regulatory identifier
  (`PROTECTED_FIELDS`, now including `dld_plot_number`, `escrow_account` and
  `development_units.plot_number`);
- `/legal/*`, which is the client's own text;
- **area, development and developer names**, which are hand-curated in
  `lib/i18n/mt/proper-nouns.ts` with a source per entry and masked out of every
  model call.

### 6. The navigation moved from `hand` to `machine`

`megamenu_*` columns were `strategy: "hand"` in `lib/i18n/domains.ts`. Nobody
wrote any, and an English menu across the top of an otherwise Arabic page is
worse for review than a draft the client corrects. The registry now says
`machine`, because it should describe what happens rather than what was
intended.

### 7. Arabic is served but not indexed

`LOCALES` includes `ar`; `app/[locale]/layout.tsx` emits `robots: noindex` for
it and `robots.ts` disallows `/ar`. Removing those two is the launch, and it is
a separate decision from making the pages exist — deliberately, because an
indexed URL is far harder to withdraw than a deployed one.

## Consequences

**The client reviews prose, not blanks.** That is the entire point, and it is
worth roughly 2,200 strings of head start.

**No "machine-written" badge.** Decided with the client. Generated Arabic lands
as ordinary content, so a reviewer may reasonably assume it was authored.
Provenance is still recorded (`by`, `model`, `at`), and the per-run output lists
what was generated — but the honest statement is that this ADR and the run logs
are the only record, and that is the accepted cost of the no-badge decision.

**Quality is uneven and the gates cannot see all of it.** The round trip catches
meaning drift; it cannot catch register, and it cannot catch a typo that leaves
a real word. `/home`'s form heading shipped as `الجحث` for `البحث` — one
character, passing every check. **The client's review is the real gate.** No
part of this replaces it.

**Coverage is not completeness.** Master pages 86%, sub-pages 89%, forms 72%,
metadata 94%, navigation 115/126 — against live content, not defaults. The
remainder is English on the page and on a list.

**The provider is not fixed.** `MtClient` is a six-field interface; the run that
completed Phase 6 used Qwen2.5-72B through the Hugging Face router after the
Anthropic key was revoked mid-session. Calibration is per-provider and recorded
with the numbers.

## What would make this decision wrong

- If the client reads the draft and finds it a net negative — that correcting
  machine Arabic costs more than writing from blank. That is a real possibility
  for the terse labels, where the round trip is weakest, and it is the specific
  thing to ask them.
- If ADREC or DLD require Arabic listing disclosures. That reclassifies this
  from enhancement to compliance and the machine/human split has to be revisited
  with a lawyer rather than an engineer. Still unanswered — it was
  ADR-0007's open question 1 and remains open.

## References

- [ADR-0007](ADR-0007-arabic-locale-routing-and-content-storage.md) — the
  locale architecture this amends, §4 in particular.
- [docs/I18N.md](../I18N.md) — how to add Arabic to a new surface.
- `lib/master-pages/arabic.ts` — why the store is keyed by English.
- `lib/i18n/mt/backtranslate.ts` — the semantic gate and its calibration.
- `lib/i18n/mt/proper-nouns.ts` — the 94 hand-curated names, with sources.
- `lib/i18n/no-runtime-mt.test.ts` — the guard that keeps a model off every
  render path, so none of this needs a key in production.
