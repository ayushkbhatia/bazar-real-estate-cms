# Wave 1 brief — area-guide FAQs (bazarrealestate.ae/areas/<slug>)

Repo root: /Users/ayushkbhatia/bazar-real-estate-cms/.claude/worktrees/yc-founder-video-script-2dde78
Env: `--env-file=../../../.env.local` from the repo root (Supabase URL + service-role key). Read-only use only.

## Goal
For each area in your batch, write 8–10 FAQs (10 where the area has enough to say; 8 is fine
for thin areas with no projects/listings) in English **and** Arabic, shaped like what property
buyers actually type into Google and ask ChatGPT/Perplexity/Gemini/Claude, so the answers get
quoted. Output: `scripts/faq-programme/2026-11-20-wave-1/<batch>/payload.json`.

## Read first
- `scripts/faq-programme/2026-11-20-wave-0/payload.json` — the approved pilot. Saadiyat Island and
  Yas Island are the model for structure, tone, length, and Arabic register. Match them.
- `scripts/faq-programme/run.mjs` — the checker. Its rules are the standard.
- The area's live page data: `pages` row `slug = subpage/area/<slug>` (`blocks`: hero, stats,
  map, landmarks, communities, nearby, why, faq …) and `developments` where `area_id` = the area,
  plus `properties` counts. Query Supabase REST with the service key (GET only).
  Also look at the live page https://www.bazarrealestate.ae/areas/<slug>.

## The standard
1. Question = a real search query ("Can foreigners buy property in Al Reem Island?",
   "How much is rent in Khalifa City?", "Is Masdar City a good place to live?").
   Must end with "?" / "؟". No pronoun openers.
2. First sentence answers it on its own (≤ 45 words) — an AI engine may quote only that.
   Then specifics. Target 250–500 chars per English answer, max 1200.
3. Every figure is traceable: either it is in the DB for that page (stats band, nearby times,
   development prices/units/handover) or it is listed in `sourcedNumbers` with a note naming
   the source. The checker blocks untraced figures. Prefer DB figures; where the DB and the web
   disagree, follow the DB and report the disagreement in your final message.
4. No claims: no "best", "guaranteed", "No.1", "risk-free", "highest yield", "assured"
   (and Arabic الأفضل / مضمون). "Returns are not guaranteed" is fine.
5. Page-specific: each answer must say something only true of THIS area. Standard topics
   (freehold, Golden Visa, fees) must carry area facts (which communities, which price points),
   never a generic paragraph with the name swapped — the checker flags that.
6. Arabic: Modern Standard Arabic, natural, not word-for-word. No Latin letters inside Arabic
   except E10, E11, E12, ADGM, DARI, ADREC. Same figures as the English. Place names in the
   Arabic the page itself uses (`name_ar` fields) where present.
7. No markdown links (renderer not shipped yet).

## Freehold — be careful
Foreign freehold in Abu Dhabi exists only in designated investment areas (Law No. 3 of 2015 as
amended 2019; u.ae list). Several areas in this wave (e.g. Al Falah, Al Rahba, Al Shamkha,
Al Shawamekh, Shakhbout City, Mohammed Bin Zayed City, Khalifa City, Al Bahia, Mussafah) are
mostly or partly NOT open to non-UAE nationals, or only specific master-developed communities
inside them are (e.g. Alreeman in Al Shamkha). Research each one; say exactly which communities
are open, or that ownership is limited to UAE nationals (and GCC where true), or that buyers
should confirm a plot's status on DARI. Never assert freehold you can't source.

## Topic menu (pick what fits each area; not all apply)
freehold / who can buy · price per ft² + 12-month change (DB stats) · rent level (DB) ·
off-plan projects selling now (DB developments) · named communities · Golden Visa at AED 2M
(adro.gov.ae; mortgaged property needs ≥ AED 2M equity; off-plan needs AED 2M paid) ·
families / schools · commute times (DB nearby band) · lifestyle / beaches / retail ·
rental yield (only from a source, phrased as indicative, "not guaranteed") ·
service charges (only sourced) · fees (2% DARI registration; show it on a real DB price) ·
villa vs apartment mix · handover dates · area vs neighbouring area.

## Payload shape (exactly)
```json
{
  "wave": "1",
  "batch": "<batch>",
  "written": "2026-11-20",
  "sourcedNumbers": [2019, 2000000],
  "sourcedNotes": { "2019": "Abu Dhabi real estate law amendment (u.ae)", "...": "..." },
  "pages": [
    { "kind": "area", "slug": "<slug>", "name": "<Area display name, e.g. Al Reem Island>",
      "pageSlug": "subpage/area/<slug>",
      "sources": ["DB: … bands used", "u.ae — …", "…"],
      "faq": [ { "q": "…?", "a": "…", "q_ar": "…؟", "a_ar": "…" } ] }
  ]
}
```

## Check, then stop
Run from the repo root:
`node --env-file=../../../.env.local scripts/faq-programme/run.mjs scripts/faq-programme/2026-11-20-wave-1/<batch>`
Iterate until it prints PASS. Warnings about Arabic numbers written as words are fine; fix any
others you reasonably can.

**NEVER pass `--write`. Never PATCH/POST/DELETE anything. Never edit run.mjs or any file outside
your batch folder.** The lead writes to production after merging all batches.

## Final message (short)
- PASS/FAIL line from the checker and warning count.
- Per area: FAQ count, and one line on freehold status as you found it, with source.
- Every DB-vs-web disagreement or page data error you noticed (wrong drive time, mislabelled
  image, wrong Arabic, etc.) — these go to the client, not fixed by you.
- Sources list (URLs).
