/**
 * Featured blocks: the site's own records — listings, projects, articles,
 * area guides — placed in an email body as cards.
 *
 * The newsletter composer inserts one with its **Feature** button, and the
 * block is stored in the body itself, like the article internal links it is
 * modelled on (docs/INTERNAL_LINKS.md):
 *
 * ```html
 * <div data-email-feature="property"
 *      data-ids="0d4c…,9a1b…"
 *      data-layout="grid"
 *      data-labels='["Yas Riva Reserve","Saadiyat Lagoons villa"]'></div>
 * ```
 *
 * Everything a reader sees — the photograph, the name, the price, the link —
 * is looked up when the email is rendered, in the reader's language, so an
 * Arabic subscriber gets the Arabic name and price words without anybody
 * writing them, a repriced listing goes out at today's price, and one that was
 * unpublished between writing and sending is left out rather than mailed to
 * ten thousand people as a dead link.
 *
 * `data-labels` holds the names the records had when the block was written.
 * Editor-only — it is how the composer can still say *which* listing a block
 * points at once that listing is no longer published. Never sent.
 *
 * This module is the vocabulary, shared by the editor node, the sanitiser and
 * the renderer so the three agree on what a valid block is. Pure and
 * client-safe. See docs/NEWSLETTER.md.
 */

import { isUuidLike } from "@/lib/uuid";

export const FEATURE_KINDS = ["property", "development", "article", "area"] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

/**
 * How a block draws.
 *
 *  - `card` — one record per row: the photograph across the column, then the
 *    name, the facts, the price and a link. For one to three records.
 *  - `grid` — two to a row: photograph, name, price. For a "this week's
 *    listings" spread.
 *  - `list` — one line each with a thumbnail. For "also new" under a feature.
 */
export const FEATURE_LAYOUTS = ["card", "grid", "list"] as const;
export type FeatureLayout = (typeof FEATURE_LAYOUTS)[number];
export const DEFAULT_FEATURE_LAYOUT: FeatureLayout = "card";

/** Most records one block may hold. A newsletter, not a search page. */
export const FEATURE_MAX = 6;

export const FEATURE_ATTR = {
  kind: "data-email-feature",
  ids: "data-ids",
  layout: "data-layout",
  labels: "data-labels",
} as const;

/** Longest stored label. A name, not a paragraph. */
const LABEL_MAX = 160;

export type FeatureRef = { kind: FeatureKind; id: string };

export type EmailFeatureBlock = {
  kind: FeatureKind;
  /** Ordered, unique, lowercased; 1 to FEATURE_MAX. */
  ids: string[];
  layout: FeatureLayout;
  /** `labels[i]` is the name `ids[i]` had when written; "" when unknown. */
  labels: string[];
};

export function isFeatureKind(value: unknown): value is FeatureKind {
  return typeof value === "string" && (FEATURE_KINDS as readonly string[]).includes(value);
}

export function isFeatureLayout(value: unknown): value is FeatureLayout {
  return typeof value === "string" && (FEATURE_LAYOUTS as readonly string[]).includes(value);
}

function cleanLabel(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, LABEL_MAX) : "";
}

function parseLabels(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * A block from loose parts, validated: unknown kinds and layouts refused or
 * defaulted, ids that are not ids dropped, duplicates removed, the list capped.
 * `null` when nothing usable is left.
 */
export function normaliseFeatureBlock(input: {
  kind: unknown;
  ids: readonly unknown[];
  layout?: unknown;
  labels?: readonly unknown[];
}): EmailFeatureBlock | null {
  if (!isFeatureKind(input.kind)) return null;
  const ids: string[] = [];
  const labels: string[] = [];
  input.ids.forEach((raw, i) => {
    if (typeof raw !== "string") return;
    const id = raw.trim().toLowerCase();
    if (!isUuidLike(id) || ids.includes(id) || ids.length >= FEATURE_MAX) return;
    ids.push(id);
    labels.push(cleanLabel(input.labels?.[i]));
  });
  if (ids.length === 0) return null;
  return {
    kind: input.kind,
    ids,
    layout: isFeatureLayout(input.layout) ? input.layout : DEFAULT_FEATURE_LAYOUT,
    labels,
  };
}

type Attribs = Record<string, string | null | undefined>;

/** A stored block's attributes, validated. `null` when it is not a usable block. */
export function readFeatureAttrs(attribs: Attribs): EmailFeatureBlock | null {
  return normaliseFeatureBlock({
    kind: attribs[FEATURE_ATTR.kind],
    ids: (attribs[FEATURE_ATTR.ids] ?? "").split(","),
    layout: attribs[FEATURE_ATTR.layout],
    labels: parseLabels(attribs[FEATURE_ATTR.labels]),
  });
}

/** The canonical attributes for a block — what the editor writes and the sanitiser keeps. */
export function featureAttrs(block: EmailFeatureBlock): Record<string, string> {
  return {
    [FEATURE_ATTR.kind]: block.kind,
    [FEATURE_ATTR.ids]: block.ids.join(","),
    [FEATURE_ATTR.layout]: block.layout,
    [FEATURE_ATTR.labels]: JSON.stringify(block.labels.map(cleanLabel)),
  };
}

const ENTITY: Record<string, string> = { amp: "&", quot: '"', lt: "<", gt: ">", "#39": "'", apos: "'" };

/** Attribute values of one start tag, entities decoded. */
function attrsOf(tag: string): Attribs {
  const out: Attribs = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-\w:.]*)="([^"]*)"/g)) {
    out[m[1].toLowerCase()] = m[2].replace(/&(amp|quot|lt|gt|#39|apos);/g, (_e, n: string) => ENTITY[n] ?? _e);
  }
  return out;
}

/** Matches one stored block, `<div data-email-feature=…></div>`, in sanitised HTML. */
export function featureBlockPattern(): RegExp {
  return /<div\b[^>]*\bdata-email-feature="[^"]*"[^>]*>\s*<\/div>/gi;
}

/** A block from one `<div …></div>` match. */
export function parseFeatureTag(tag: string): EmailFeatureBlock | null {
  const open = /^<div\b[^>]*>/i.exec(tag);
  return open ? readFeatureAttrs(attrsOf(open[0])) : null;
}

/** Every block in a body, in order. Expects sanitised HTML. */
export function featureBlocksIn(html: string | null | undefined): EmailFeatureBlock[] {
  if (!html) return [];
  const out: EmailFeatureBlock[] = [];
  for (const m of html.matchAll(featureBlockPattern())) {
    const block = parseFeatureTag(m[0]);
    if (block) out.push(block);
  }
  return out;
}

/** Every record the given bodies feature, once each. */
export function featureRefsIn(...bodies: (string | null | undefined)[]): FeatureRef[] {
  const seen = new Set<string>();
  const refs: FeatureRef[] = [];
  for (const body of bodies) {
    for (const block of featureBlocksIn(body)) {
      for (const id of block.ids) {
        const key = `${block.kind}:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        refs.push({ kind: block.kind, id });
      }
    }
  }
  return refs;
}
