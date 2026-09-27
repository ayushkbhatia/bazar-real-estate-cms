# Internal links in articles

An article on `/insights` can link to the site's own **area guides**
(`/areas/<slug>`), **projects** (`/developments/<slug>`) and **listings**
(`/p/<slug>-<reference>`) — as many times as it likes, anywhere in the body, in
English and in Arabic. Two forms:

| Form | What the reader sees | How the editor makes one |
|---|---|---|
| **Block** — *card* | A card between paragraphs: photograph, name, where it is, a line of live facts (price, beds, handover, homes for sale), a call to action | Put the cursor in the paragraph the card should follow → **Internal link** → pick → *Card* |
| **Block** — *compact* | A one-line strip with a thumbnail, for a "see also" | Same, pick *Compact* — or flip an existing card with its Card/Compact toggle |
| **Text link** | Ordinary underlined words in a sentence | Select the words → **Internal link** → pick → *Text link* |

The design handoff asked for "embedded listing cards (special block that
renders a listing card given a property reference)"
(`05-cms-pages.md` §Blog editor). This is that, widened to the three things an
editorial piece about Abu Dhabi property actually talks about.

---

## The one idea: link the record, not the URL

Every internal link stores the **record's id** — never just a URL, never a
copy of its name or price. The public page looks each record up when it
renders. So:

- a **renamed** project or area still links — the href is rebuilt from the
  current slug;
- a **repriced** listing shows today's price on the card;
- an **unpublished or deleted** record makes its card disappear and turns its
  text link back into plain words — no 404s, no dead cards, nothing for an
  editor to hunt down;
- a record **published later** makes its card appear, with no edit to the
  article.

Nothing about an internal link needs a deploy or a migration: it lives in the
article body (`articles.body_html` / `body_html_ar`), so adding one is a CMS
save and the article page revalidates (ISR, 300 s).

## Storage

Both forms live inside the stored HTML. The sanitiser
(`lib/article-html.ts`) validates and canonicalises them on save *and* on
render, like everything else in a body.

```html
<!-- a block: an empty div whose attributes are its whole content -->
<div data-internal-link="development"
     data-id="33333333-0000-0000-0000-000000000008"
     data-variant="card"
     data-label="Saadiyat Lagoons"></div>

<!-- a text link: an ordinary <a>, plus the record -->
<a href="/areas/yas-island" data-link-kind="area"
   data-link-id="0d4c6b8e-5a1f-4e2b-9c3d-7f8e9a0b1c2d">Yas Island</a>
```

- `data-internal-link` / `data-link-kind` — `area` | `development` | `property`.
- `data-id` / `data-link-id` — the record's uuid, lowercased.
- `data-variant` — `card` (default) | `compact`.
- `data-label` — the record's name when the block was written. **Editor-only**:
  it is how the editor can still say *which* listing a block points at after
  that listing is unpublished. The public card never prints it.
- A text link's `href` is the path it had when written — the fallback for the
  one case the live lookup cannot answer (the database not replying), not a
  second source of truth.

A block has no text in it, which is what keeps it out of the excerpt, the
reading time and the Arabic translation walker: `lib/i18n/mt/html.ts` copies a
block it has nothing to translate verbatim, attributes and all.

## Rendering

`app/[locale]/(public)/insights/[slug]/page.tsx`:

1. `articleBodyLinkRefs(body)` — every record the body links, once, read from
   the **same sanitised markup** the renderer draws (`lib/internal-links/extract.ts`
   uses html-react-parser's own `htmlToDOM`, so the two cannot disagree).
2. `resolveInternalLinks(refs, locale)` — **at most one query per kind**, plus
   a head-count per linked area, whatever the article holds; beside the
   related-articles read, not after it. Public client and the site's own
   publication filters (a project needs `published_at`; a listing needs
   `status = 'published'` and no `deleted_at`). Every string is folded to the
   page's locale before it is shaped — proven by
   `lib/internal-links/resolve.fold.test.ts`.
3. `renderArticleBody(body, { lookup, renderBlock })` draws each block with
   `InternalLinkCard` and rewrites each link.

The lookup answers three ways, and the difference matters:

| `lookup.get(ref)` | Meaning | Block | Text link |
|---|---|---|---|
| a record | live and public | card | link to the record's href **today** |
| `null` | looked up, not public | nothing | the words, unlinked |
| `undefined` | could not look it up | nothing | link to the **stored** href |

A failed read degrades the article rather than 500-ing it — the rule
`lib/queries/read-failure.ts` gives for anything that renders a section.

Any other link to a path on this site (`href="/…"`) is also drawn through the
locale-aware `Link`, so a reader on `/ar` stays on `/ar`. Links elsewhere are
left exactly as authored.

## The card

`app/[locale]/(public)/insights/[slug]/_components/internal-link-card.tsx`. A
server component; every word is either the record's (already in the reader's
language) or from `messages/*/editorial.json` → `internalLink`, reusing the
`listing`, `development.card` and `search.type` keys the rest of the site
prints. Prices and sizes go through `PriceText` / `AreaText`, so they follow
the visitor's currency and unit.

- It renders inside `.bz-prose`, whose `a` rule would make the whole card blue
  and underlined; the prose rules live in `@layer components`, so the card's
  utilities win without `!important`.
- The title is not a heading. The article's h2/h3 are its outline.
- Logical utilities only; the arrow flips under `dir="rtl"`; every
  data-supplied value is `<bdi>`-isolated.

## The editor

`app/[locale]/(admin)/admin/blog/`:

- **`_article-editor.tsx`** — the **Internal link** toolbar button, and what it
  means depends on the cursor: on a block → edit it; inside an internal text
  link → re-point it; over selected words → offer to link them; anywhere else
  → insert a block. The ordinary **Link** button, on an internal link, opens
  the picker too, so retyping a URL can never silently orphan the record.
- **`_internal-link-dialog.tsx`** — the picker. Areas / Projects / Listings
  tabs with counts; type to filter; ↑/↓ to move, Enter or a double-click to
  insert. It speaks the shared picker vocabulary from `admin/_fields`: rows
  are `OptionBody` and matching is `filterRecordOptions` — the same photo,
  reference, facts and price the page builder's listing picker shows, and the
  same search ("5 bed", a reference, "13.3m"), because three live listings
  share a title and only those tell them apart. On top of that it ranks a
  record *named* what was typed first ("yas island" → Yas Island, not the
  community inside it).
- **`_link-targets.ts`** — the options, built with the shared shapers
  (`developmentSeedItem`, `propertySeedItem`) plus the record id a link
  stores. Only published records — the same readers the public pages use — so
  a block can never be pointed at something whose card would draw nothing.
- **`_internal-link-view.tsx`** — the block as the editor draws it: which
  record, which variant (with a Card/Compact toggle), edit, remove, and a drag
  grip to move it. A block whose record is no longer published says so in
  place: *"Not live — … hidden on the site."*
- Inserting puts the block **after** the paragraph the cursor is in (never
  splitting a sentence) and replaces an empty line; `lib/tiptap/internal-link.ts`.
- Internal text links have a dashed underline in the editor, so they are
  distinguishable from links to other sites.

## Arabic

Nothing on a card needs translating — the record supplies the Arabic name and
the catalogue supplies the labels. What can drift is **placement**, because the
Arabic body is its own document and replaces the English one on `/ar`.

- The Arabic editor has the same **Internal link** button.
- When the English links records the Arabic body does not, the Arabic section
  says so — *"The English links 2 pages the Arabic body does not"* — with a
  button that copies the missing blocks across. Placement is by position: the
  block that follows the 4th paragraph-level block in the English goes after
  the 4th in the Arabic, which is exact for a body produced by the
  translation walker (it translates block by block). It never moves or removes
  anything already in the Arabic, and adds a record only if no Arabic block
  links it, so it is safe to press twice. `lib/internal-links/mirror.ts`.
- A blank Arabic body is not served — `/ar` falls back to the English one,
  blocks and all — so the notice only appears once the Arabic has words.
- Text links are carried across by the translation walker (it masks inline
  tags and restores them verbatim); an editor can add or re-point them in the
  Arabic editor like any other.

## Adding a fourth kind

Say, advisors (`/agents/<slug>`):

1. `INTERNAL_LINK_KINDS` in `lib/internal-links/model.ts`.
2. A loader and a shaper in `resolve.ts` (plus its fold proof), and a variant
   of `ResolvedInternalLink` in `types.ts`.
3. Picker options in `admin/blog/_link-targets.ts` (a shaper in
   `admin/_fields/record-seeds.ts` if other pickers want the kind too), and a
   tab in `KIND_META` (`_internal-link-dialog.tsx`).
4. A branch in `useCardParts` (`internal-link-card.tsx`) and any catalogue keys
   it needs, with Arabic and `_provenance.json` entries.

The sanitiser, the node, the extractor and the renderer need nothing: they
validate against the kind list.

## Tests

| Spec | Pins |
|---|---|
| `lib/tiptap/internal-link.test.ts` | where a block lands; the save → sanitise → reopen round trip; one `link` extension (StarterKit v3 bundles its own); internal text links keep no `target` through a reopen |
| `lib/article-html.test.ts` | blocks and text links survive the sanitiser, canonicalised; junk is dropped |
| `lib/article-body.test.tsx` | the three lookup answers, for blocks and for text links; site paths through the locale-aware `Link`; other sites untouched |
| `lib/internal-links/resolve.fold.test.ts` | one query per kind; `null` vs `undefined`; every string folds to Arabic with no twin leak |
| `lib/internal-links/mirror.test.ts` | Arabic placement, idempotence, never moving what is there |
| `lib/internal-links/walker.test.ts` | the translation walker sends no block to the model and restores blocks and text-link records byte for byte |
| `admin/blog/_link-targets.test.ts` | picker options are the shared pickers' shapes plus the id |
| `admin/blog/_internal-link-dialog.test.tsx` | the picker's modes, ranking, keyboard, and same-titled listings told apart |
