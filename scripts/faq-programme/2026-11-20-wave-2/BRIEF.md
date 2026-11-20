# Wave 2 brief: project-page FAQs (bazarrealestate.ae/developments/<slug>)

Repo root: /Users/ayushkbhatia/bazar-real-estate-cms/.claude/worktrees/yc-founder-video-script-2dde78
Env: run from the repo root with `--env-file=../../../.env.local` (Supabase URL and service-role key). Use it read-only.

**Read `scripts/faq-programme/2026-11-20-wave-1/BRIEF.md` first.** It sets the standard, the
checker rules, the Arabic rules, the freehold caution and the payload shape. This brief changes only
what is specific to projects.

## Goal
For each project in your batch, write **10 FAQs** (8 is the floor for a thin pre-launch project) in
English **and** Arabic. Output goes to `scripts/faq-programme/2026-11-20-wave-2/<batch>/payload.json`.
Each page entry is `{ "kind": "development", "slug", "name", "sources", "faq" }`. Project pages
have no `pageSlug`.

## The model
Use the two approved pilot projects in `scripts/faq-programme/2026-11-20-wave-0/payload.json`,
`sei-saadiyat` and `manchester-city-yas-residences`. Match their structure, tone, length and
Arabic.

## A curated set REPLACES the generated FAQ entirely
While `developments.meta.faq` is empty, the page shows a generated set, from
`app/[locale]/(public)/developments/[slug]/_components/development-faq.tsx` (`synthFaq`). It covers:
developer, location, handover, payment plan, unit types, whether foreigners can buy, and escrow.
Your set replaces it, so it must still answer those basics, in this order of priority:
1. Who is the developer of <Project>?
2. Where is <Project> located? Give the area, plus 1–2 drive times taken from the area page's `nearby` band.
3. What is the starting price? Use the DB `starting_price`.
4. Unit types and sizes, from the `development_unit_types` rows and `bedrooms_text`.
5. Payment plan, from the DB `payment_plan`. If the web disagrees, follow the DB and report it.
6. Handover date, from the DB `handover_date`, as a quarter or month and year.
7. Can foreigners buy? Base it on the area's freehold status, which Wave 1 already researched:
   read the area's FAQ in `scripts/faq-programme/2026-11-20-wave-1/payload.json`.
8. Golden Visa. Be precise for this project: say which unit types or prices reach AED 2M. If the
   starting price is under AED 2M, say so. Off-plan buyers must have paid AED 2M, and a mortgaged
   property needs at least AED 2M of equity.
9. One or two that are distinctive to this project: the brand (branded residences: what the brand
   operates on site), signature amenities, the masterplan context, the views.
10. One from: escrow and buyer protection (Abu Dhabi off-plan payments go into a project escrow
    account regulated by ADREC; cite the law correctly), an off-plan mortgage (ADREC requires 50%
    paid; see the pilot), resale before handover, service charges (only if sourced), or a
    rental-yield outlook (sourced, "indicative, not guaranteed").

## Existing curated FAQs: keep what is right
Four projects already hold editor-written `meta.faq`: bayviews-saadiyat (2),
breeze-by-trace (5), jw-marriott-residences (8) and radiant-legacy (5). Read those first.
Keep any question and fact in them that is still correct, reworded to the standard if needed, so
nothing the client wrote is silently dropped. Report anything in them that you found to be wrong.
The script backs up the old value before it writes.

## DB facts for a project
- `developments` row: name, starting_price, handover_date, total_units, payment_plan,
  bedrooms_text, meta (description, amenities and so on), and the developer through `developer_id`.
- `development_unit_types` where `development_id` = the row's id: label, beds,
  size_from_ft2, size_to_ft2. Floor plans are attached to unit types.
- The area page `pages.slug = subpage/area/<area slug>`, for drive times.
- The live page at https://www.bazarrealestate.ae/developments/<slug>.
The checker traces figures against the row, its unit types and its area page. Any other figure
goes in `sourcedNumbers`, with a note.

## Known data issues already reported, so do not re-report them
- reem-hills-phase-4: the DB names Aldar, but Reem Hills is Q Properties / Modon. Don't name the
  developer in the answer; say it is "part of the Reem Hills community", and flag it again only
  if you find more.
- al-hamra: Bloom markets it as "Alhambra". Use "Alhambra, also listed as Al Hamra" and follow
  the DB price and handover.
- al-ghadeer-gardens: total_units is 352 in the DB, but the launch said 437. Use 437.
- rimas: the DB has 316 units; the launch said 167 villas. Use the launch figure, worded "villas".
- brabus-island: sources disagree on the developer. Name it "Brabus Island by Cosmo Developments,
  powered by Reportage" only if a primary source (Zawya, brabus.com) supports that.

## Check, then stop
`node --env-file=../../../.env.local scripts/faq-programme/run.mjs scripts/faq-programme/2026-11-20-wave-2/<batch>`
Repeat until it prints PASS.

**NEVER pass `--write`. Never PATCH, POST or DELETE anything. Never edit run.mjs or any file
outside your batch folder.**

## Final message (short)
- The checker's PASS line and warning count.
- Per project: FAQ count; which of DB price, plan and handover the web confirms or contradicts.
- New data errors, and anything wrong in the existing curated FAQs.
- Sources (URLs).
