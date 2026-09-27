import type { ReactElement, ReactNode } from "react";
import Image from "next/image";
import parse, {
  Element,
  domToReact,
  type DOMNode,
  type HTMLReactParserOptions,
} from "html-react-parser";
import Link from "@/components/i18n/link";
import { sanitizeArticleHtml } from "@/lib/article-html";
import { internalLinkRefs } from "@/lib/internal-links/extract";
import {
  isSitePath,
  readAnchorRef,
  readBlockAttrs,
  type InternalLinkRef,
  type InternalLinkVariant,
} from "@/lib/internal-links/model";
import type {
  InternalLinkLookup,
  ResolvedInternalLink,
} from "@/lib/internal-links/types";

/**
 * Width of the article's reading column, in CSS pixels, at the breakpoint
 * where it stops being full-bleed. Mirrors `max-w-[760px]` minus the
 * `md:px-12` gutters on app/[locale]/(public)/insights/[slug]/page.tsx.
 *
 * It only feeds the `sizes` hint, so being a little off costs a slightly
 * larger variant, not a broken layout — but it must be revisited if that
 * column is ever re-measured.
 */
const COLUMN_PX = 664;
const SIZES = `(min-width: 760px) ${COLUMN_PX}px, 100vw`;

function dimension(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,5}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

/**
 * The article's internal links, looked up, and how to draw a block.
 *
 * The drawing is passed in rather than imported because the cards are page
 * components — they read the message catalogue and the visitor's currency —
 * and this module is the part that is the same for every caller.
 */
export type ArticleBodyLinks = {
  lookup: InternalLinkLookup;
  renderBlock: (
    link: ResolvedInternalLink,
    variant: InternalLinkVariant,
  ) => ReactNode;
};

/** A node that renders nothing — how `replace` removes an element. */
const NOTHING = <></>;

function renderImage(domNode: Element): ReactElement | undefined {
  const { src, alt, width, height } = domNode.attribs;
  const w = dimension(width);
  const h = dimension(height);

  // `next/image` needs intrinsic dimensions to reserve the box and to build
  // a srcset. Without them there is nothing to optimise against, so the
  // plain tag is left alone rather than guessed at — that is the case for a
  // bare <img> inherited from an article written before the figure node, or
  // one whose size probe timed out at insert.
  if (!src || !w || !h) return undefined;

  return (
    <Image
      src={src}
      alt={alt ?? ""}
      width={w}
      height={h}
      sizes={SIZES}
      // Body images are below the fold by construction — the cover is the
      // LCP candidate on this page, and marking these eager would compete
      // with it for bandwidth.
      loading="lazy"
    />
  );
}

function optionsFor(links: ArticleBodyLinks | undefined) {
  const options: HTMLReactParserOptions = {
    replace(domNode: DOMNode) {
      if (!(domNode instanceof Element)) return;

      if (domNode.name === "img") return renderImage(domNode);

      if (domNode.name === "div") {
        const block = readBlockAttrs(domNode.attribs);
        if (!block) return;
        // Unpublished, deleted, or not looked up at all: the block draws
        // nothing. A card is only worth showing with the record behind it,
        // and an empty frame or a link to a 404 is worse than no card.
        const link = links?.lookup.get(block);
        return link ? <>{links!.renderBlock(link, block.variant)}</> : NOTHING;
      }

      if (domNode.name === "a") {
        return renderAnchor(domNode, links?.lookup, options);
      }
    },
  };
  return options;
}

/**
 * A link in the body.
 *
 *  - To a record: the href comes from the live record, so a renamed slug
 *    still resolves. If the record is gone the WORDS stay and the link goes —
 *    the sentence reads the same, it just no longer sends anyone to a 404.
 *    If the lookup itself failed, the href stored with the link is used.
 *  - To any other path on this site: through the locale-aware `Link`, so a
 *    reader on `/ar` stays on `/ar`. A bare `<a href="/areas/x">` would send
 *    them back to English, which is the bug `components/i18n/link.tsx`
 *    exists to prevent everywhere else.
 *  - Anywhere else: left exactly as authored.
 *
 * Both internal cases drop `target`: moving between our own pages is not
 * leaving the site.
 */
function renderAnchor(
  domNode: Element,
  lookup: InternalLinkLookup | undefined,
  options: HTMLReactParserOptions,
): ReactElement | undefined {
  const ref: InternalLinkRef | null = readAnchorRef(domNode.attribs);
  const stored = domNode.attribs.href;
  if (!ref && !isSitePath(stored)) return undefined;

  const children = domToReact(domNode.children as DOMNode[], options);
  let href: string | null = isSitePath(stored) ? stored : null;
  if (ref && lookup) {
    const hit = lookup.get(ref);
    if (hit === null) return <>{children}</>;
    if (hit) href = hit.href;
  }
  return href ? <Link href={href}>{children}</Link> : <>{children}</>;
}

/**
 * Render a stored article body as React.
 *
 * The body is HTML in the database, so the obvious rendering is
 * `dangerouslySetInnerHTML`. That is what this replaces, for three reasons:
 *
 *  - markup injected that way is opaque to `next/image`, so every in-body
 *    image served its full original file — measurably ~335 KB where the
 *    optimiser would send ~31 KB at phone widths;
 *  - an internal-link block is an empty `<div>` in the HTML, and only a
 *    component can turn it into a card drawn from the live record;
 *  - a link to a page on this site has to go through the locale-aware
 *    `Link`, or it takes an Arabic reader back to English.
 *
 * Sanitising happens in here rather than at the call site so that rendering a
 * body and trusting a body cannot come apart — there is no way to get the
 * elements without the allowlist having run. See lib/article-html.ts.
 *
 * Without `links`, blocks draw nothing and text links keep the href they were
 * stored with.
 */
export function renderArticleBody(
  html: string,
  links?: ArticleBodyLinks,
): ReactNode {
  return parse(sanitizeArticleHtml(html), optionsFor(links));
}

/**
 * The records a body links to, read from the same sanitised markup
 * `renderArticleBody` draws — so the page fetches exactly what it renders.
 */
export function articleBodyLinkRefs(html: string): InternalLinkRef[] {
  return internalLinkRefs(sanitizeArticleHtml(html));
}
