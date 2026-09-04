/**
 * /partners — the banking and regulatory partner index.
 *
 * WHY THIS FILE EXISTS
 *
 * `/partners` was the last public marketing page with no master page at all.
 * Every word on it was a literal in `partners/page.tsx`: the hero, both group
 * headers, the closing band, and the `export const metadata`. So an editor had
 * no way to change any of it — and, because the master-page system is also
 * where Arabic twins live, `/ar/partners` rendered the whole page in English
 * under `lang="ar"` in an RTL layout. Title, headline and all three
 * sub-headings. `/ar/developers`, which has had a master page since it was
 * built, is fully Arabic; this page sat beside it in the nav reading English.
 *
 * This mirrors `DEVELOPERS_PAGE` deliberately — same shape, same posture — so
 * the two sibling pages are edited the same way.
 *
 * WHAT IS AND IS NOT EDITABLE
 *
 * The page's own copy is editable. The partner CARDS are not: each
 * institution's name, one-line tag and logo come from `ECOSYSTEM_PARTNERS` in
 * `_components/partners-data.ts`, for the same two reasons the developer
 * directory gives — a list field takes over the whole set as soon as one item
 * is added, so a single hand-typed card would blank the others, and there is
 * no logo-upload path for a card typed in the editor. `dataNote` says so on
 * the section itself rather than leaving an editor to discover it.
 *
 * The two group sections are bound to a `category` in code (`banking`,
 * `regulatory`), which is what selects the cards under each heading. The
 * section supplies the words; the category stays where the filter is. Both are
 * `locked` for the same reason `/developers`'s hero is: the page renders them
 * in fixed JSX order, so offering a hide switch the page ignores would be a
 * lie in the admin UI.
 *
 * Every `defaults` value below is the literal the page rendered before this
 * change, verbatim, so an un-edited page renders byte-identically to before.
 */
import type { MasterPageDef } from "../types";
import { text, eyebrow, heading, body } from "../fields";

export const PARTNERS_PAGE: MasterPageDef = {
  key: "partners",
  label: "Partners",
  path: "/partners",
  description:
    "The banking and regulatory partner index. Card content comes from the partner list in code.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "Eyebrow, headline and standfirst at the top of the page.",
      locked: true,
      /*
       * Three headline fields rather than the two every other master page
       * uses.
       *
       * The registry's usual shape is `title` + `title_emphasis`, where the
       * emphasis is an italic TAIL — "…advised properly.", "…since 2005.".
       * This headline italicises a word in the MIDDLE: "The institutions
       * *behind* every deal." Neither the tail pattern nor `headlineParts`
       * (which italicises the last word of a single field) can express that.
       *
       * So the emphasis gets a lead and a tail around it. Leaving `title_tail`
       * blank degrades exactly to the tail pattern every other page uses, so
       * this generalises the convention rather than competing with it — an
       * editor who wants the ordinary look simply empties the last box.
       */
      fields: [
        eyebrow(),
        text("title", "Headline · before the italic", { max: 80 }),
        text("title_emphasis", "Headline · italic word", {
          max: 60,
          optional: true,
          help: "Rendered in italic in the middle of the headline.",
        }),
        text("title_tail", "Headline · after the italic", {
          max: 80,
          optional: true,
          help: "Leave blank to end the headline on the italic word.",
        }),
        body({ key: "sub", label: "Sub-headline" }),
      ],
      defaults: {
        eyebrow: "Our Partner Ecosystem",
        title: "The institutions",
        title_emphasis: "behind",
        title_tail: "every deal.",
        sub: "Beyond our developer relationships, Bazar works alongside the region's leading banks and regulatory authorities — so financing, compliance, and registration are handled end to end.",
      },
    },
    {
      key: "banking",
      label: "Banking group",
      description: "Heading and intro above the finance partners.",
      locked: true,
      dataNote:
        "The cards under this heading — every bank's name, one-line tag and logo — come from the partner list maintained in code. This section is the words around them.",
      fields: [eyebrow(), heading(), body()],
      defaults: {
        eyebrow: "Finance",
        heading: "Banking & finance",
        body: "Direct mortgage and home-finance relationships that get our clients competitive rates and faster approvals.",
      },
    },
    {
      key: "regulatory",
      label: "Regulatory group",
      description: "Heading and intro above the regulatory partners.",
      locked: true,
      dataNote:
        "The cards under this heading come from the same code-maintained partner list, filtered to the regulatory authorities.",
      fields: [eyebrow(), heading(), body()],
      defaults: {
        eyebrow: "Regulation",
        heading: "Regulatory & government",
        body: "The authorities that license, regulate, and register real estate across Abu Dhabi and the wider UAE.",
      },
    },
    {
      key: "cta",
      label: "Closing band",
      description: "The dark band at the foot of the page and its two buttons.",
      locked: true,
      /*
       * Labels only, no `link` fields. Both destinations are structural — the
       * contact page and the sibling developer index — and a `cta_href` an
       * editor can point anywhere is how a marketing page ends up with a
       * button to a 404. `/developers` takes the same line with its card link.
       */
      fields: [
        eyebrow(),
        heading(),
        text("cta_label", "Primary button", { max: 60, optional: true }),
        text("cta2_label", "Secondary button", { max: 60, optional: true }),
      ],
      defaults: {
        eyebrow: "Work with us",
        heading: "Backed by the right people at every step.",
        cta_label: "Talk to an advisor",
        cta2_label: "Our developers",
      },
    },
  ],
};
