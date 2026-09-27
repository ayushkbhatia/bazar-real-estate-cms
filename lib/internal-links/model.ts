/**
 * Internal links: an article linking to the site's own records.
 *
 * An editor links an article to an area guide, a project or a listing in two
 * ways, and both are stored in the article body itself (`articles.body_html`
 * and its Arabic twin), so adding one is a CMS save — no migration, no deploy:
 *
 *  - a **block**, a card between paragraphs:
 *    `<div data-internal-link="area" data-id="…" data-variant="card"></div>`
 *  - a **text link**, on words inside a paragraph:
 *    `<a href="/areas/yas-island" data-link-kind="area" data-link-id="…">`
 *
 * ## Why an id, and not the URL
 *
 * The record's id is the durable identity. A slug is an editor-owned field and
 * a listing's title is marketing copy; either can change the day after the
 * article is published. Everything visible — the name, the photograph, the
 * price, the href itself — is looked up live when the page renders, so a
 * renamed project still links, a repriced listing shows today's price, and an
 * unpublished one disappears instead of sending a reader to a 404.
 *
 * A text link also stores the href it had when it was written. That is the
 * fallback for the one case the live lookup cannot answer — the database not
 * replying — not a second source of truth.
 *
 * This module is the vocabulary: attribute names, the three kinds, the two
 * card variants, and the readers that validate them. It is imported by the
 * editor node, the sanitiser, the renderer and the extractor, so the four can
 * never disagree about what a valid link looks like.
 *
 * Pure and client-safe. See docs/INTERNAL_LINKS.md for the whole feature.
 */

import { isUuidLike } from "@/lib/uuid";

export const INTERNAL_LINK_KINDS = ["area", "development", "property"] as const;
export type InternalLinkKind = (typeof INTERNAL_LINK_KINDS)[number];

/**
 * How a block draws.
 *
 *  - `card` — photograph beside the name, a line of live facts and a call to
 *    action. The default, and what the design handoff calls an embedded
 *    listing card.
 *  - `compact` — a one-line strip with a thumbnail, for a "see also" that
 *    should not interrupt the reading as much as a card does.
 */
export const INTERNAL_LINK_VARIANTS = ["card", "compact"] as const;
export type InternalLinkVariant = (typeof INTERNAL_LINK_VARIANTS)[number];
export const DEFAULT_INTERNAL_LINK_VARIANT: InternalLinkVariant = "card";

/** Attribute names on a block `<div>`. */
export const BLOCK_ATTR = {
  kind: "data-internal-link",
  id: "data-id",
  variant: "data-variant",
  /**
   * The target's name when the block was written. Editor-only: it is how the
   * editor can still say WHICH listing a block points at once that listing is
   * unpublished and no longer in the picker. Never rendered on the site —
   * the public card always shows the live name.
   */
  label: "data-label",
} as const;

/** Attribute names on a text link's `<a>`. */
export const ANCHOR_ATTR = {
  kind: "data-link-kind",
  id: "data-link-id",
} as const;

/** Longest `data-label` kept. A name, not a paragraph. */
export const LABEL_MAX = 160;

export type InternalLinkRef = { kind: InternalLinkKind; id: string };

export type InternalLinkBlock = InternalLinkRef & {
  variant: InternalLinkVariant;
  label: string | null;
};

export function isInternalLinkKind(value: unknown): value is InternalLinkKind {
  return (
    typeof value === "string" &&
    (INTERNAL_LINK_KINDS as readonly string[]).includes(value)
  );
}

export function isInternalLinkVariant(
  value: unknown,
): value is InternalLinkVariant {
  return (
    typeof value === "string" &&
    (INTERNAL_LINK_VARIANTS as readonly string[]).includes(value)
  );
}

/**
 * The key a resolved record is filed under. Ids are compared lowercased —
 * Postgres prints uuids in lowercase, and an id pasted in capitals is the
 * same record.
 */
export function linkKey(kind: InternalLinkKind, id: string): string {
  return `${kind}:${id.toLowerCase()}`;
}

type Attribs = Record<string, string | null | undefined>;

/** A block's attributes, validated. `null` when it is not a usable block. */
export function readBlockAttrs(attribs: Attribs): InternalLinkBlock | null {
  const kind = attribs[BLOCK_ATTR.kind];
  const id = attribs[BLOCK_ATTR.id];
  if (!isInternalLinkKind(kind) || !isUuidLike(id)) return null;
  const variant = attribs[BLOCK_ATTR.variant];
  return {
    kind,
    id: id.toLowerCase(),
    variant: isInternalLinkVariant(variant)
      ? variant
      : DEFAULT_INTERNAL_LINK_VARIANT,
    label: cleanLabel(attribs[BLOCK_ATTR.label]),
  };
}

/** A text link's target, validated. `null` for an ordinary link. */
export function readAnchorRef(attribs: Attribs): InternalLinkRef | null {
  const kind = attribs[ANCHOR_ATTR.kind];
  const id = attribs[ANCHOR_ATTR.id];
  if (!isInternalLinkKind(kind) || !isUuidLike(id)) return null;
  return { kind, id: id.toLowerCase() };
}

export function cleanLabel(raw: string | null | undefined): string | null {
  const label = (raw ?? "").replace(/\s+/g, " ").trim();
  return label ? label.slice(0, LABEL_MAX) : null;
}

/**
 * A path on this site — `/areas/yas-island` — as opposed to another site.
 *
 * `//host/x` is protocol-relative, i.e. another origin, and is excluded. These
 * are the hrefs the renderer hands to the locale-aware `Link`, so a reader on
 * `/ar` stays in Arabic when they follow one.
 */
export function isSitePath(href: string | null | undefined): href is string {
  return typeof href === "string" && /^\/(?!\/)/.test(href);
}

/** `/areas/<slug>` — the area guide. The one kind with no helper elsewhere. */
export function areaPath(slug: string): string {
  return `/areas/${slug}`;
}
