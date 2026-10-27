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
 * The page's own copy is editable here. The partner CARDS are site-owned
 * content — the same institutions render in the logo strip on the home page
 * and on /about — so they live in the section library
 * (/admin/pages/sub/section/partners). This page's editor draws that same
 * document under "Partner cards" (client, Oct 2026: editors look for the cards
 * on the page they sit on), saving to the library rather than to this page.
 *
 * (They were not editable at all until Sprint 15: every name, tag and logo was
 * a literal in `ECOSYSTEM_PARTNERS`, which also meant `/ar/partners` printed
 * all seven institutions in English — a card with no registry has no Arabic
 * twin. See `lib/master-pages/library.ts`.)
 *
 * The two group sections are bound to a `category` in code (`banking`,
 * `regulatory`), which is what selects the cards under each heading. The
 * section supplies the words; the category stays where the filter is. They are
 * NOT locked: the page renders its sections in document order now, so hiding a
 * group or swapping the two does what the switch says it does. A group whose
 * category has no cards drops out on its own.
 *
 * Every `defaults` value below is the literal the page rendered before this
 * change, verbatim, so an un-edited page renders byte-identically to before.
 */
import type { MasterPageDef } from "../types";
import { text, eyebrow, heading, body, image } from "../fields";

export const PARTNERS_PAGE: MasterPageDef = {
  key: "partners",
  label: "Partners",
  path: "/partners",
  description:
    "The banking and regulatory partner index. The cards themselves are the shared partner list, edited under Sections.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "Eyebrow, headline and standfirst at the top of the page.",
      locked: true,
      fields: [
        eyebrow(),
        text("title", "Headline", { max: 80 }),
        text("title_emphasis", "Headline · italic tail", {
          max: 60,
          optional: true,
          help: "Rendered in italic at the end of the headline.",
        }),
        body({ key: "sub", label: "Sub-headline" }),
      ],
      defaults: {
        eyebrow: "Our Partner Ecosystem",
        title: "The institutions",
        title_emphasis: "behind every deal.",
        sub: "Beyond our developer relationships, Bazar works alongside the region's leading banks and regulatory authorities — so financing, compliance, and registration are handled end to end.",
      },
    },
    {
      key: "banking",
      label: "Banking group",
      description: "Heading and intro above the finance partners.",
      dataNote:
        "The cards under this heading — every bank's name, one-line tag and logo — are edited under Partner cards at the foot of this page. They are the site's one partner list, so the same institutions ride the logo strip on the home page and /about. This section is the words around them.",
      dataLink: {
        label: "Edit the partner cards",
        href: "/admin/pages/master/partners#partner-cards",
      },
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
      dataNote:
        "The cards under this heading come from the same shared partner list, filtered to the ones marked Regulatory & government.",
      dataLink: {
        label: "Edit the partner cards",
        href: "/admin/pages/master/partners#partner-cards",
      },
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
        image(
          "image",
          "Background image",
          "Fills the dark band, under a dark scrim so the white heading and buttons stay legible. Leave unset to keep the plain dark band.",
        ),
      ],
      defaults: {
        eyebrow: "Work with us",
        heading: "Backed by the right people at every step.",
        cta_label: "Talk to an advisor",
        cta2_label: "Our developers",
        image: { media_id: null, alt: null, label: null },
      },
    },
  ],
};
