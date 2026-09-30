# Bazar mortgage CMS — screen handoff

A screen-by-screen handoff for the mortgage team's CMS screens (C1–C6). The website screens (W1–W8) are in the separate front-end handoff.

## How this package works
This zip holds one zip per screen, plus a foundations zip that every screen depends on.

| Zip | Contents | PLAN phase | Size |
|---|---|---|---|
| `00-foundations.zip` | Routes, permissions, CMS shell changes, tokens, shared components, promise clock, data and actions, formatting, accessibility, shared strings, gaps, journey map, SPEC.md | 4 | L |
| `C1-requests-queue.zip` | C1 · Requests queue | 4 | M |
| `C2-preapproval-file.zip` | C2 · Pre-approval file, in review | 4 (bank sending in 6) | M |
| `C3-document-viewer-accept.zip` | C3 · Document viewer, accept | 5 | L |
| `C4-document-viewer-reupload.zip` | C4 · Document viewer, request re-upload | 5 | M |
| `C5-decision.zip` | C5 · Decision, pre-approve and notify | 6 | L |
| `C6-consultancy-request.zip` | C6 · Consultancy request, contact and book | 4 | M |

Size is for one developer working with Claude Code: S = under half a day, M = about a day, L = two days or more.

Each screen zip contains:
- `README.md` — the screen plan: route, purpose, layout with measurements, components, copy deck, behaviour and states, data and actions, permissions, accessibility, edge cases, acceptance criteria, tests, open questions, build steps and a Claude Code prompt
- `<screen>-2x.png` — the design at 2× (2880px wide)
- `strings.en.json` — every string on the screen, keyed and verbatim
- `reference/` — the design source; `index.html` renders the screen on its own

## Where to begin
1. Unzip into your repo as `docs/mortgage/cms/`, next to `SPEC.md` and `PLAN.md` from the mortgage module handoff.
2. Unzip `00-foundations.zip` and build it first.
3. Build in PLAN order: C1, C2 and C6 (Phase 4), then C3 and C4 (Phase 5), then C5 (Phase 6). C3 and C4 are two states of one viewer, so build them together.
4. Use one Claude Code session per zip. Paste the prompt at the end of its README, review the plan, then let it build.

The screens need the Phase 1 domain module (`transition()`, `slaStatus()`, `checklists.ts`) and the Phase 2 file endpoint. The Phase 1 seed reproduces the data in the PNGs, which makes visual comparison straightforward.

## Rules for every screen
- The designs are HTML references. Rebuild them inside the existing CMS shell with the app's components and tokens; don't copy the JSX.
- Copy is final. Take it from `strings.en.json`; values in `{braces}` are filled at runtime. Names, references, amounts and times in the PNGs are seed data.
- Only mortgage advisers and the Head of mortgages can open these screens (SPEC §7). The signed-in user in the PNGs ("Mariam Al-Hashimi · Admin") is placeholder shell data.
- Status changes go through `transition()`; deadline maths stays in `sla.ts`; documents load only through the logged file endpoint.
- The PNGs use the moss accent. Use the app's live tokens.
- Desktop only (designed at 1440px, minimum 1280px).

## Gaps to close before build
These aren't designed. 00-foundations §13 lists them all with the phase that needs each one.
- Choosing banks after "Accept application", recording a bank response, and the Decline mode on C5.
- Entering each statement's period on C4.
- Reassign, claim, edit applicant, and the "Request documents" picker on C2.
- Marking a consultation held, no-show or cancelled on C6.
- The partner banks admin page, empty and loading states, and the breached-clock state.

## Viewing the reference
Browsers block scripts loaded from `file://`, so serve the folder: run `npx serve reference` inside any screen folder and open the URL it prints. React, Babel and the fonts load from the internet.
