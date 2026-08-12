/**
 * /developers — the developer-partners index.
 *
 * Only the copy is editable here. The 30-card grid is rendered from the
 * hardcoded directory in `app/[locale]/(public)/developers/_data.ts`, which carries each
 * developer's slug, name, one-line blurb and logo PNG. It is deliberately NOT
 * modelled as a list field: a list takes over the whole set as soon as one item
 * is added (so a single hand-typed card would blank the other twenty-nine), and
 * there is no logo-upload path for a card typed in the editor.
 *
 * Every `defaults` value is the copy the page rendered before it became
 * editable, so an un-edited page renders byte-identically to before.
 */
import type { MasterPageDef } from "../types";
import { text, eyebrow, heading, body } from "../fields";

export const DEVELOPERS_PAGE: MasterPageDef = {
  key: "developers",
  label: "Developers",
  path: "/developers",
  description:
    "The developer-partners index. Card content comes from the developer directory in code.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "Eyebrow, headline and standfirst at the top of the page.",
      locked: true,
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        text("title_emphasis", "Emphasised tail", {
          max: 60,
          optional: true,
          help: "Rendered in italic at the end of the headline.",
        }),
        body({ key: "sub", label: "Sub-headline" }),
      ],
      defaults: {
        eyebrow: "Developers",
        // Rendered as two lines; the line break is the newline below and the
        // emphasised tail is italicised by the page.
        title: "The developers\nshaping",
        title_emphasis: "the UAE.",
        sub: "Direct relationships with the region's leading developers give Bazar clients early access to landmark communities, new launches, and off-plan opportunities.",
      },
    },
    {
      key: "directory",
      label: "Our partners",
      description:
        "Heading and intro above the grid of developer cards, plus the link label on each card.",
      dataNote:
        "The cards themselves — every developer's name, one-line blurb and logo — come from the developer directory maintained in code, sorted alphabetically. Each card links to that developer's own profile page.",
      fields: [
        eyebrow(),
        heading(),
        body(),
        text("card_cta", "Card link label", {
          max: 60,
          optional: true,
          help: "Shown at the foot of every developer card.",
        }),
      ],
      defaults: {
        eyebrow: "Our partners",
        heading: "Working with leading developers across the UAE.",
        body: "Access to established communities, new launches, luxury residences, and investment opportunities across Abu Dhabi, Dubai and the wider UAE.",
        card_cta: "View developments",
      },
    },
  ],
};
