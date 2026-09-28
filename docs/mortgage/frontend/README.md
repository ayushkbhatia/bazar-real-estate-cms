# Bazar mortgage application — front-end handoff

A screen-by-screen handoff for the applicant-facing mortgage screens on the website (W1–W8). The CMS screens (C1–C6) aren't included.

## How this package works
This zip holds one zip per screen, plus a foundations zip that every screen depends on.

| Zip | Contents | Size |
|---|---|---|
| `00-foundations.zip` | Shell, tokens, shared components, wizard state, upload engine, API client, formatting, analytics, accessibility, responsive rules, shared strings, journey map, SPEC.md | L |
| `W1-choose-service.zip` | W1 · Choose service | S |
| `W2-personal-details.zip` | W2 · Personal details | M |
| `W3-consultancy-review.zip` | W3 · Consultancy · review & request | S |
| `W4-consultancy-received.zip` | W4 · Consultancy · request received | S |
| `W5-documents-salaried.zip` | W5 · Salaried documents | M |
| `W6-documents-business-owner.zip` | W6 · Business Owner documents, every upload state | S |
| `W7-application-received.zip` | W7 · Application received | S |
| `W8-secure-reupload.zip` | W8 · Re-upload from a secure link | L |

Size is for one developer working with Claude Code: S = under half a day, M = about a day, L = two days or more.

Each screen zip contains:
- `README.md` — the screen plan: route, entry and exit, layout with measurements, components, copy deck, behaviour and states, data, analytics, accessibility, responsive rules, edge cases, acceptance criteria, tests, open questions, build steps and a Claude Code prompt
- `<screen>-2x.png` — the design at 2× (2880px wide)
- `strings.en.json` — every string on the screen, keyed and verbatim
- `reference/` — the design source; `index.html` renders the screen on its own

## Where to begin
1. Unzip into your repo as `docs/mortgage/frontend/`, next to `SPEC.md` and `PLAN.md` from the mortgage module handoff.
2. Unzip `00-foundations.zip` and build it first.
3. Then build the screens in order: W1 → W2 → W3 → W4 → W5 → W6 → W7 → W8. W5 and W6 share one route and one set of components.
4. Use one Claude Code session per zip. Paste the prompt at the end of its README, review the plan, then let it build.

## How this fits PLAN.md
- 00-foundations and W1–W7 belong to **Phase 3** (website intake). W8 and the invite landing belong to **Phase 5**.
- The screens call APIs built in Phases 1–2. To start the front end sooner, build against mocked handlers (MSW) that follow the contract in 00-foundations §8, then switch to the real API when Phase 2 is merged.

## Rules for every screen
- The designs are HTML references. Rebuild them with the app's components and tokens; don't copy the JSX.
- Copy is final. Take it from `strings.en.json`; values in `{braces}` are filled at runtime. Names, references and dates in the PNGs are sample data.
- Path A/B/C labels are internal. Never show them to applicants.
- Only desktop (1440px) is designed. The responsive rules in each README are proposals to confirm with design.
- The PNGs use the moss accent. Use the app's live tokens (the navy/teal recolour replaces moss).
- English only. Build RTL-ready and keep every string in the message files.
- No PII in URLs, logs or analytics.

## Gaps to close before build
These aren't designed. Each README lists the ones that affect it.
- Validation and upload error copy (only the oversize message exists).
- W8: code entry, invalid or expired link, already-sent link and the success state.
- The invite landing for links sent from CMS C6.
- W1 with nothing selected, and an Exit confirmation.
- Tablet and mobile layouts.

## Viewing the reference
Browsers block scripts loaded from `file://`, so serve the folder: run `npx serve reference` inside any screen folder and open the URL it prints. React, Babel and the fonts load from the internet.
