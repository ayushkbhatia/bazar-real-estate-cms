/**
 * /off-plan/launches — every published project on one page.
 *
 * WHY THIS PAGE EXISTS
 *
 * The rail under the New Projects map ends in "View every launch", and that
 * link used to open `/off-plan/search` — the property search, filtered to
 * off-plan listings. A visitor who had been browsing project cards landed on
 * individual units instead, and the only complete list of projects,
 * `/developments`, was reachable from neither the rail nor its header.
 *
 * WHAT IS AND IS NOT EDITABLE
 *
 * The cards are the projects themselves: name, developer, area, starting
 * price, bedrooms, handover date, labels and cover image all come from each
 * development's record, and a project published tomorrow appears on its own.
 * This document owns the words around the grid and the order it leads with —
 * nothing else, which is the point of a page that is "just the list".
 *
 * THE ORDER
 *
 * Newest first, the order `listPublishedDevelopments` already returns. The
 * "Lead with" list pins projects above that, in the order picked, and a row
 * switched off takes its project out of this page (and only this page). It
 * has no seed button on purpose: loading all twenty-eight would pin every one
 * of them, and the next project published would land at the bottom instead of
 * the top. See `orderLaunches` in lib/developments/launch-order.ts.
 *
 * THE ARABIC
 *
 * Hand-declared beside each English sibling, as `agents.ts` does. It follows
 * the house style the client has already published on /off-plan — "launches"
 * as المشاريع المطروحة, "browse" as استعرض — and the glossary for the terms
 * it binds (على الخارطة, خطة السداد, التسليم). A first draft in the sense of
 * ADR-0008; the client's edit wins, because `mergeValues` never overwrites a
 * twin that holds a value.
 */
import type { MasterPageDef } from "../types";
import { area, body, ctaPair, eyebrow, heading, text, toggle } from "../fields";

/** The page's public path — the rail's "view all" link points here. */
export const LAUNCHES_PATH = "/off-plan/launches";

export const LAUNCHES_PAGE: MasterPageDef = {
  key: "launches",
  label: "All launches",
  path: LAUNCHES_PATH,
  description:
    "Every published off-plan project in one grid — where the rail's “View every launch” link on New projects leads. The cards are the projects' own records; this page owns the words around them and the order they lead with.",
  sections: [
    {
      key: "hero",
      label: "Header",
      // The hints live here rather than in each field's `help`: a capped field
      // draws its character counter in help's place (see docs/FOLLOWUPS.md).
      description:
        "The link back to New projects — clear its label to drop the link — then the eyebrow, headline and intro above the grid.",
      locked: true,
      fields: [
        text("back_label", "Back link", { max: 60, optional: true }),
        eyebrow(),
        heading({ key: "title", label: "Headline", max: 120 }),
        body({ key: "sub", label: "Intro", max: 400 }),
      ],
      defaults: {
        back_label: "New projects",
        back_label_ar: "المشاريع الجديدة",
        eyebrow: "New launches",
        eyebrow_ar: "مشاريع جديدة",
        title: "Every launch in Abu Dhabi.",
        title_ar: "جميع المشاريع المطروحة في أبوظبي.",
        sub: "Every off-plan project on Bazar in one place — starting prices, bedroom mixes and handover dates at a glance. Open any project for its payment plan and floor plans.",
        sub_ar: "جميع المشاريع على الخارطة لدى بازار في مكان واحد — الأسعار الابتدائية وتوزيع غرف النوم ومواعيد التسليم في لمحة. استعرض أي مشروع للاطلاع على خطة السداد ومخططات الطوابق.",
      },
    },
    {
      key: "grid",
      label: "Project grid",
      description:
        "The cards — three to a row on a desktop, two on a phone — and the line shown in their place while no project is published.",
      // The list is the page. Hiding it would publish a header over nothing.
      locked: true,
      dataNote:
        "Every published development appears here on its own, newest first. Its name, developer, area, starting price, bedrooms, handover date, labels and cover image come from that project's record, so they are edited on its project page.",
      dataLink: { label: "Developments", href: "/admin/pages/sub/development" },
      fields: [
        {
          key: "pinned",
          label: "Lead with",
          kind: "list",
          itemLabel: "project",
          max: 30,
          help: "Pick the projects that should open the grid, in order — everything else follows, newest first, and a project published tomorrow still appears on its own. Switch a row off to leave that project out of this page.",
          fields: [
            toggle("enabled", "Show this project"),
            {
              key: "slug",
              label: "Project",
              kind: "select",
              optionsKey: "developments",
              placeholder: "Choose a development",
            },
          ],
        },
        area("empty", "When nothing is published", {
          max: 240,
          optional: false,
        }),
      ],
      defaults: {
        pinned: [],
        empty: "New launches are on their way. Check back soon, or speak to an advisor about what's coming to market.",
        empty_ar: "مشاريع جديدة في الطريق. عُد إلينا قريبًا، أو تحدّث إلى أحد مستشارينا عمّا سيُطرح في السوق.",
      },
    },
    {
      key: "closing",
      label: "Closing prompt",
      description: "A line and a button under the grid, for the visitor who hasn't found it yet.",
      fields: [heading(), body({ max: 300 }), ...ctaPair("Button label")],
      defaults: {
        heading: "Looking for something specific?",
        heading_ar: "تبحث عن مشروع بعينه؟",
        body: "Our off-plan desk hears about launches before they reach the market. Tell us what you're after and we'll shortlist the projects worth your time.",
        body_ar: "يطّلع مكتب المشاريع على الخارطة لدينا على المشاريع قبل طرحها في السوق. أخبرنا بما تبحث عنه، وسنرشّح لك المشاريع التي تستحق وقتك.",
        cta_label: "Speak to an advisor",
        cta_label_ar: "تحدّث إلى مستشار",
        cta_href: "/contact",
      },
    },
  ],
};
