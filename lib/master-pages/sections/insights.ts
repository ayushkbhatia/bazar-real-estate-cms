/**
 * Master-page sections for /insights — The Bazar Brief index.
 *
 * This page is a live feed: the articles, their categories, the counts on the
 * chips and the featured lede are all published records. What an editor owns
 * here is the copy wrapped around that feed — the masthead, the subscribe
 * panel beside the lede, and the empty state.
 *
 * Every `defaults` value is the copy the page rendered before it became
 * editable, character for character, so an un-edited page is byte-identical.
 */
import type { MasterPageDef } from "../types";
import { area, body, eyebrow, heading, link, text } from "../fields";

export const INSIGHTS_PAGE: MasterPageDef = {
  key: "insights",
  label: "Insights",
  path: "/insights",
  description:
    "The Bazar Brief index — masthead, subscribe panel, and the copy around the live article feed.",
  sections: [
    {
      key: "hero",
      label: "Masthead",
      description: "The page title and the one-line description under it.",
      locked: true,
      fields: [eyebrow(), heading(), body()],
      defaults: {
        eyebrow: "Insights",
        heading: "The Bazar Brief.",
        body: "Long-form market analysis, advisor field notes, and the occasional contrarian take. One email every Wednesday.",
      },
    },
    {
      key: "featured",
      label: "Lead article + subscribe panel",
      description:
        "The big lead article, with the dark newsletter sign-up card beside it.",
      locked: true,
      dataNote:
        "The lead article is always the most recently published one (in the selected category). Only the subscribe card's wording is editable here.",
      fields: [
        eyebrow({ label: "Subscribe · eyebrow" }),
        heading({ label: "Subscribe · heading" }),
        body({ label: "Subscribe · body" }),
      ],
      defaults: {
        eyebrow: "Subscribe to the brief",
        heading: "One email every Wednesday.",
        body: "A short briefing on the week's Abu Dhabi deals, advisor commentary, and one chart worth sitting with.",
      },
    },
    {
      key: "categories",
      label: "Category filter",
      description: "The row of category chips that filters the article list.",
      dataNote:
        "The categories and the article counts come from published articles — a category with no articles is hidden automatically.",
      fields: [
        text("all_label", "First chip label", {
          max: 40,
          help: 'The chip that clears the filter. The total count is appended after it — "All · 24".',
        }),
      ],
      defaults: {
        all_label: "All",
      },
    },
    {
      key: "articles",
      label: "Article grid",
      description:
        "The grid of articles, and what to say when there aren't any yet.",
      locked: true,
      dataNote:
        "Articles come from the blog — write and publish them under Blog. The grid shows the 24 most recent, newest first.",
      fields: [
        area("empty_body", "Empty state · message", {
          max: 240,
          optional: false,
          help: "Shown only when nothing is published. Write {category} where the filtered category name should appear; it disappears when no filter is on.",
        }),
        text("empty_cta_label", "Empty state · button label", {
          max: 60,
          optional: true,
        }),
        link("empty_cta_href", "Empty state · button link"),
      ],
      defaults: {
        empty_body: "We haven't published any {category} insights yet.",
        empty_cta_label: "View all categories",
        empty_cta_href: "/insights",
      },
    },
  ],
};
