import { Element, htmlToDOM, type DOMNode } from "html-react-parser";
import {
  linkKey,
  readAnchorRef,
  readBlockAttrs,
  type InternalLinkBlock,
  type InternalLinkRef,
} from "./model";

export type ExtractedInternalLinks = {
  /** Blocks, in document order. The same record may appear more than once. */
  blocks: InternalLinkBlock[];
  /** Text links, in document order. */
  anchors: InternalLinkRef[];
};

/**
 * Every internal link in an article body.
 *
 * Parsed with `htmlToDOM` — the parser `renderArticleBody` itself runs on —
 * rather than a regular expression. The two have to agree exactly: a block
 * the renderer draws but this missed would never have its record fetched, and
 * would render as nothing. Attribute order, quoting and entity escaping are
 * the parser's problem once, instead of a regex's problem forever.
 *
 * Run it on the SANITISED body, the same string the renderer draws.
 */
export function extractInternalLinks(html: string): ExtractedInternalLinks {
  const out: ExtractedInternalLinks = { blocks: [], anchors: [] };
  if (!html) return out;

  const walk = (nodes: DOMNode[]) => {
    for (const node of nodes) {
      if (!(node instanceof Element)) continue;
      if (node.name === "div") {
        const block = readBlockAttrs(node.attribs);
        if (block) {
          out.blocks.push(block);
          // A block is a leaf. Anything an editor could not have put inside
          // one is not worth descending into.
          continue;
        }
      } else if (node.name === "a") {
        const ref = readAnchorRef(node.attribs);
        if (ref) out.anchors.push(ref);
      }
      walk(node.children as DOMNode[]);
    }
  };
  walk(htmlToDOM(html) as DOMNode[]);
  return out;
}

/** Each record an article links to, once, blocks and text links together. */
export function internalLinkRefs(html: string): InternalLinkRef[] {
  const { blocks, anchors } = extractInternalLinks(html);
  const seen = new Map<string, InternalLinkRef>();
  for (const ref of [...blocks, ...anchors]) {
    const key = linkKey(ref.kind, ref.id);
    if (!seen.has(key)) seen.set(key, { kind: ref.kind, id: ref.id });
  }
  return [...seen.values()];
}
