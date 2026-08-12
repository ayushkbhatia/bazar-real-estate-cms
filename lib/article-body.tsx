import type { ReactNode } from "react";
import Image from "next/image";
import parse, {
  Element,
  type DOMNode,
  type HTMLReactParserOptions,
} from "html-react-parser";
import { sanitizeArticleHtml } from "@/lib/article-html";

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

const options: HTMLReactParserOptions = {
  replace(domNode: DOMNode) {
    if (!(domNode instanceof Element) || domNode.name !== "img") return;

    const { src, alt, width, height } = domNode.attribs;
    const w = dimension(width);
    const h = dimension(height);

    // `next/image` needs intrinsic dimensions to reserve the box and to build
    // a srcset. Without them there is nothing to optimise against, so the
    // plain tag is left alone rather than guessed at — that is the case for a
    // bare <img> inherited from an article written before the figure node, or
    // one whose size probe timed out at insert.
    if (!src || !w || !h) return;

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
  },
};

/**
 * Render a stored article body as React.
 *
 * The body is HTML in the database, so the obvious rendering is
 * `dangerouslySetInnerHTML`. That is what this replaces, for one reason:
 * markup injected that way is opaque to `next/image`, so every in-body image
 * served its full original file — measurably ~335 KB where the optimiser
 * would send ~31 KB at phone widths. Parsing to React lets the images become
 * `<Image>` and pick up format negotiation and a srcset, while every other
 * tag maps across unchanged.
 *
 * Sanitising happens in here rather than at the call site so that rendering a
 * body and trusting a body cannot come apart — there is no way to get the
 * elements without the allowlist having run. See lib/article-html.ts.
 */
export function renderArticleBody(html: string): ReactNode {
  return parse(sanitizeArticleHtml(html), options);
}
