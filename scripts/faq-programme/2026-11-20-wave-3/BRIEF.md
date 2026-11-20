# Wave 3 brief: landings, guides, service pages and tools

Repo root: /Users/ayushkbhatia/bazar-real-estate-cms/.claude/worktrees/yc-founder-video-script-2dde78
Env: `--env-file=../../../.env.local` from the repo root (read-only use).

**Read `scripts/faq-programme/2026-11-20-wave-1/BRIEF.md` first.** It sets the standard, the
checker, the Arabic rules and the payload basics. This brief adds only what is different here.
The approved models are the pilot area and project FAQs in
`scripts/faq-programme/2026-11-20-wave-0/payload.json`.

## What these pages are for
These are the "how do I…" pages that AI engines cite most: buying process, fees, mortgages for
expats, off-plan risks, renting rules, Golden Visa, tax residency, KYC, snagging, conveyancing,
valuation. The questions are **intent-wide, not place-specific**: "How much are the fees to buy
property in Abu Dhabi?", "Can expats get a mortgage in Abu Dhabi?", "How does Ejari / Tawtheeq
work?" (Abu Dhabi uses **Tawtheeq** for tenancy registration; do not say Ejari, which is Dubai),
"What is a snagging inspection?". Abu Dhabi first; say "UAE" only where the rule is federal.

Write 8–10 per page (up to 12 on the big landings: home, buy, rent, off-plan).

## Do not repeat the page; complement it
Each page already has body copy. Read it first and answer what it **doesn't**, or answer the most
searched question more directly than the body does. Never contradict it. If the body is wrong,
report that instead of following it.
- Guides: `messages/en/guides.json` (+ `messages/ar/guides.json`); routes `app/[locale]/(public)/guides/<slug>/page.tsx`.
- Services: `lib/seeds/services.ts` (each service's copy) and the `ServicePage` component under
  `app/[locale]/(public)/services/_components/`; `consultation` and `manage` are master pages
  (`pages.slug = master/consultation`, `master/manage`).
- Tools: `messages/en/tools.json`; routes under `app/[locale]/(public)/tools/`.
- Landings: their `pages` row (`master/<key>`): read every section, not only the FAQ.
- Also look at the live page at https://www.bazarrealestate.ae/<route>.

## Existing landing FAQs: keep what's right
The 9 landings already have 6–10 FAQs each, written by the client or seeded from the client's
copy. Read them. Keep every question and fact that is still correct, reworded to the standard,
so nothing the client wrote is silently dropped. Add the missing high-intent questions. Report
anything wrong you find in them.

## Payload: two page kinds
1. **Landing** (FAQ section already in its master document):
   `{ "kind": "page", "slug": "<key>", "name": "<label>", "route": "/buy",
     "pageSlug": "master/<key>", "sectionKey": "faq" | "faqs", ... }`
   `sectionKey` is `faqs` for home, areas and services, and `faq` for the rest. Check the row.
2. **FAQ document** (guides, service pages, tools: new store, rendered by a code change in
   progress): `{ "kind": "faqdoc", "slug": "<key>", "name": "<page title>",
   "route": "/guides/golden-visa", "pageSlug": "subpage/faq/<key>", ... }` with key
   `guide-<slug>`, `service-<slug>` or `tool-<slug>` (e.g. `guide-golden-visa`,
   `service-snagging`, `tool-valuation`).

These pages hold few DB figures, so almost every number goes in `sourcedNumbers` with a note naming
the source (government page, law, bank rule, or "page copy: <file>"). Regulatory facts come from
primary sources wherever possible: ADREC/DARI (adrec.gov.ae, dari.ae), DMT (dmt.gov.ae),
ADRO (adro.gov.ae), the Central Bank (centralbank.ae) for mortgage LTV caps, the FTA (tax.gov.ae)
for tax residency, u.ae, and the Wave 0–2 sources. Use figures already established in Waves 0–2
(2% DARI registration, AED 2M Golden Visa, ADREC 50% for off-plan mortgages, escrow under Law
No. 3 of 2015 as amended by Law No. 2 of 2025, effective 2 August 2025) with the same wording.

Do not quote Bazar's own commission or fees unless the page copy states them.

## Check, then stop
`node --env-file=../../../.env.local scripts/faq-programme/run.mjs scripts/faq-programme/2026-11-20-wave-3/<batch>`
Repeat until it prints PASS. **NEVER `--write`. Never PATCH, POST or DELETE. Never edit run.mjs or
anything outside your batch folder.**

## Final message (short)
The checker's PASS line; per page: FAQ count and the main questions added; anything wrong in the
page body or existing FAQs; sources (URLs).
