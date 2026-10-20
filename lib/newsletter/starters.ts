/**
 * Starting points for a new newsletter.
 *
 * "New newsletter" can open on a blank page or on a layout already filled
 * with what is new on the site — the latest listings, project launches and
 * articles, as featured blocks — in both editions. The layout is code (it is
 * a template, like a page's sections); what fills it is the live catalogue,
 * picked when the draft is made and editable like any other block. The few
 * words a starter writes are scaffolding, and the one sentence only the team
 * can write is a bracketed placeholder that blocks sending until it is
 * replaced (`placeholderProblems`).
 *
 * Pure. The action looks the records up and hands them in.
 */

import { featureAttrs, type EmailFeatureBlock, type FeatureKind, type FeatureLayout } from "@/lib/content-assets/email-feature";
import type { CampaignDraft } from "./campaign";

export const STARTERS = ["blank", "digest", "listings", "launches", "insights"] as const;
export type Starter = (typeof STARTERS)[number];

export const STARTER_META: Record<Starter, { label: string; hint: string }> = {
  blank: { label: "Blank", hint: "An empty page in the editor." },
  digest: {
    label: "Monthly digest",
    hint: "A featured project, the four newest listings and the latest three articles.",
  },
  listings: { label: "New listings", hint: "The six newest listings, two to a row." },
  launches: { label: "Project launches", hint: "The three newest projects, a card each." },
  insights: { label: "From Insights", hint: "The four latest articles." },
};

export function isStarter(value: unknown): value is Starter {
  return typeof value === "string" && (STARTERS as readonly string[]).includes(value);
}

export type StarterRecord = { id: string; name: string };
export type StarterPicks = Record<"property" | "development" | "article", StarterRecord[]>;

/** How many of each kind a starter wants — what the action fetches. */
export const STARTER_NEEDS: Record<Starter, Partial<Record<keyof StarterPicks, number>>> = {
  blank: {},
  digest: { development: 1, property: 4, article: 3 },
  listings: { property: 6 },
  launches: { development: 3 },
  insights: { article: 4 },
};

const PLACEHOLDER = {
  en: "[Write a line or two introducing this issue.]",
  ar: "[اكتب سطرًا أو سطرين تقدّم بهما هذا العدد.]",
};

/** A bracketed placeholder a starter left, still unreplaced. */
const PLACEHOLDER_RE = /\[(?:Write|اكتب)[^\]]*\]/;

export function hasPlaceholder(text: string | null | undefined): boolean {
  return PLACEHOLDER_RE.test(text ?? "");
}

type Copy = {
  subject: Record<Exclude<Starter, "blank">, string>;
  preheader: Record<Exclude<Starter, "blank">, string>;
  heading: Record<"intro" | "project" | "projects" | "listings" | "articles", string>;
  button: string;
};

const COPY: Record<"en" | "ar", Copy> = {
  en: {
    subject: {
      digest: "This month at Bazar",
      listings: "New on the market this week",
      launches: "New project launches in Abu Dhabi",
      insights: "Reading from Bazar Insights",
    },
    preheader: {
      digest: "New listings, project launches and reading from the Abu Dhabi market.",
      listings: "The newest homes on Bazar, hand-picked by our advisors.",
      launches: "The latest off-plan launches, with prices and handover dates.",
      insights: "Our latest guides and market reading.",
    },
    heading: {
      intro: "New this month",
      project: "Featured project",
      projects: "New launches",
      listings: "New on the market",
      articles: "From Insights",
    },
    button: "Talk to an advisor",
  },
  ar: {
    subject: {
      digest: "هذا الشهر في بازار",
      listings: "جديد في السوق هذا الأسبوع",
      launches: "إطلاقات مشاريع جديدة في أبوظبي",
      insights: "مختارات من رؤى بازار",
    },
    preheader: {
      digest: "عقارات جديدة وإطلاقات مشاريع وقراءات من سوق أبوظبي.",
      listings: "أحدث العقارات على بازار، يختارها مستشارونا.",
      launches: "أحدث المشاريع على الخارطة، مع الأسعار ومواعيد التسليم.",
      insights: "أحدث أدلّتنا وقراءاتنا للسوق.",
    },
    heading: {
      intro: "جديد هذا الشهر",
      project: "مشروع مميز",
      projects: "إطلاقات جديدة",
      listings: "جديد في السوق",
      articles: "من رؤى",
    },
    button: "تحدّث إلى مستشار",
  },
};

function blockHtml(kind: FeatureKind, records: StarterRecord[], layout: FeatureLayout): string {
  if (records.length === 0) return "";
  const block: EmailFeatureBlock = {
    kind,
    ids: records.map((r) => r.id.toLowerCase()),
    labels: records.map((r) => r.name),
    layout,
  };
  const attrs = Object.entries(featureAttrs(block))
    .map(([k, v]) => `${k}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`)
    .join(" ");
  return `<div ${attrs}></div>`;
}

function section(heading: string, block: string): string {
  return block ? `<h2>${heading}</h2>${block}` : "";
}

function body(starter: Exclude<Starter, "blank">, picks: StarterPicks, locale: "en" | "ar"): string {
  const c = COPY[locale];
  const intro = `<h2>${c.heading.intro}</h2><p>${PLACEHOLDER[locale]}</p>`;
  const button = `<a data-email-button="" href="{{contact_url}}">${c.button}</a>`;
  const parts: string[] = [intro];
  switch (starter) {
    case "digest":
      parts.push(
        section(c.heading.project, blockHtml("development", picks.development, "card")),
        section(c.heading.listings, blockHtml("property", picks.property, "grid")),
        section(c.heading.articles, blockHtml("article", picks.article, "list")),
      );
      break;
    case "listings":
      parts.push(blockHtml("property", picks.property, "grid"));
      break;
    case "launches":
      parts.push(blockHtml("development", picks.development, "card"));
      break;
    case "insights":
      parts.push(blockHtml("article", picks.article, "list"));
      break;
  }
  parts.push(button);
  return parts.filter(Boolean).join("");
}

/** A new draft's fields for a starter. Blank is the empty draft. */
export function starterDraft(starter: Starter, picks: StarterPicks): Partial<CampaignDraft> {
  if (starter === "blank") return {};
  return {
    subject: COPY.en.subject[starter],
    preheader: COPY.en.preheader[starter],
    body: body(starter, picks, "en"),
    subject_ar: COPY.ar.subject[starter],
    preheader_ar: COPY.ar.preheader[starter],
    body_ar: body(starter, picks, "ar"),
    audience: "all",
  };
}
