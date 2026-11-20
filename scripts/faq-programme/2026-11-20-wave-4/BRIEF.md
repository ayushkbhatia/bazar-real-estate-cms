# Wave 4 brief: developer-profile FAQs (bazarrealestate.ae/developers/<slug>)

Repo root: /Users/ayushkbhatia/bazar-real-estate-cms/.claude/worktrees/yc-founder-video-script-2dde78
Env: `--env-file=../../../.env.local` from the repo root (read-only use).

**Read `scripts/faq-programme/2026-11-20-wave-1/BRIEF.md` first.** It sets the standard, the
checker, the Arabic rules and the payload basics. Approved models: the project FAQs in
`scripts/faq-programme/2026-11-20-wave-2/payload.json` and the pilot in `wave-0/payload.json`.

## What buyers ask about a developer
"Is <Developer> a reliable developer?", "Who owns <Developer>?", "What projects does
<Developer> have in Abu Dhabi?", "Does <Developer> deliver on time?", "Is <Developer> listed?",
"What payment plans does <Developer> offer?", "Where is <Developer> building now?",
"Does <Developer> build in Abu Dhabi?" (for Dubai or northern-emirates developers),
"Can foreigners buy from <Developer>?", "Is <Developer> escrow-protected?".

Answer reliability questions with **verifiable facts only**: founding year, ownership or listing
(stock exchange and ticker), completed and delivered communities, official sales and handover
figures from the developer's own releases or financial results, and ADREC/RERA registration.
Never "best", "most trusted", "reliable" as a verdict, "No.1" or "leading". Say what the record
shows and let the reader judge. No reviews or complaints, no lawsuits, no rumours.

## How many
- Developers with published projects on our site: **8** FAQs. At least two must be about their
  projects on our site, named, with DB price, handover and area.
- Developers with no published project on our site: **6** FAQs. Include whether they build in
  Abu Dhabi (and what), so the page answers the obvious "Does X build in Abu Dhabi?".

## Facts and storage
- Page: `{ "kind": "faqdoc", "slug": "developer-<slug>", "name": "<Developer name>",
  "route": "/developers/<slug>", "pageSlug": "subpage/faq/developer-<slug>", "sources": [...],
  "faq": [...] }`
- The checker traces figures against the `developers` row (founded_year, description, stats)
  and the developer's PUBLISHED projects (`developments` with `published_at` not null, plus their
  unit types). Everything else goes in `sourcedNumbers` with a note naming the source.
- Read the live profile at https://www.bazarrealestate.ae/developers/<slug> (the description is
  there) and don't contradict it. If it is wrong, report it.
- Only name projects that are published on our site when you say "available through Bazar". Other
  projects (e.g. Emaar's Dubai communities) can be named as the developer's portfolio, sourced.
- Unpublished/demo project rows exist (Bayviews, Bulgari Residences, Six Senses Residences,
  Mandarin Oriental, Saadiyat Lagoons, Mamsha Al Saadiyat, Solaya, Reem Hills Phase 4). Never
  present those DB rows as on sale.

## Known data issues already reported, so don't re-report them
- The Wadi and Brabus Island: the DB says Reportage. Both are Cosmo Developments projects (a
  Flag Holding / Reportage joint venture), "powered by Reportage". On Reportage's page say so.
- Sobha City Abu Dhabi is in Al Bahia, though the DB files it under Yas Island.
- Fay Hills (Taraf) is in Masdar City per Taraf/Masdar, though the DB says Khalifa City.
- Radisson Residences: the developer is Royal Development Holding (Emirates Stallions / IHC).
- Reem Hills is Q Properties / Modon, not Aldar.

## Check, then stop
`node --env-file=../../../.env.local scripts/faq-programme/run.mjs scripts/faq-programme/2026-11-20-wave-4/<batch>`
Repeat until it prints PASS. **NEVER `--write`. Never PATCH, POST or DELETE. Never edit run.mjs or
anything outside your batch folder.**

## Final message (short)
The checker's PASS line; per developer: FAQ count and one line on what the record shows; errors on
the live profile (description, founding year, logo/name); sources (URLs).
