import {
  linkKey,
  readBlockAttrs,
  type InternalLinkBlock,
} from "./model";

/**
 * Carry the English body's link blocks into the Arabic body.
 *
 * ## Why this exists
 *
 * An article's Arabic body is its own document (`body_html_ar`), and on `/ar`
 * it replaces the English one wholesale. So a card added to the English after
 * the Arabic was written is simply absent for an Arabic reader — every live
 * article already has an Arabic body, so that is every card anyone adds from
 * now on. Asking editors to place each card twice, in a language most of them
 * cannot read, is how the two drift apart.
 *
 * The block itself needs no translating — it holds no words, and the card it
 * draws comes from the record, already in Arabic. Only its POSITION has to be
 * found, and that is cheap here: the Arabic body is produced from the English
 * by a walker that translates block by block (lib/i18n/mt/html.ts), so the
 * Nth paragraph of one is the Nth paragraph of the other. A block that
 * follows the 4th non-link block in the English goes after the 4th in the
 * Arabic. If a person has since restructured the Arabic, the card may land a
 * paragraph off — which they will see, in the editor, before they save.
 *
 * ## What it will not do
 *
 * It never removes or moves anything already in the Arabic, and it adds a
 * record only if NO block in the Arabic links it — so running it twice is a
 * no-op, and a card an editor deliberately placed differently in the Arabic
 * stays where they put it.
 *
 * Browser-only (it uses `DOMParser`); it runs when an editor clicks the
 * button, on the two documents in the form.
 */
export type MirrorResult = { html: string; added: number };

function body(html: string): HTMLElement {
  return new DOMParser().parseFromString(html, "text/html").body;
}

function blockOf(el: Element | null): InternalLinkBlock | null {
  if (!el || el.tagName !== "DIV") return null;
  const attribs: Record<string, string> = {};
  for (const name of el.getAttributeNames()) {
    attribs[name] = el.getAttribute(name) ?? "";
  }
  return readBlockAttrs(attribs);
}

type Planned = {
  /** How many non-link blocks precede it in the English. */
  after: number;
  el: Element;
};

/** The English blocks whose record no Arabic block links, with positions. */
function plan(sourceHtml: string, targetHtml: string): Planned[] {
  const linked = new Set<string>();
  for (const el of Array.from(body(targetHtml).children)) {
    const block = blockOf(el);
    if (block) linked.add(linkKey(block.kind, block.id));
  }
  const out: Planned[] = [];
  let after = 0;
  for (const el of Array.from(body(sourceHtml).children)) {
    const block = blockOf(el);
    if (!block) {
      after++;
      continue;
    }
    const key = linkKey(block.kind, block.id);
    if (linked.has(key)) continue;
    linked.add(key);
    out.push({ after, el });
  }
  return out;
}

/** How many of the English body's link blocks the Arabic body is missing. */
export function countMissingBlocks(
  sourceHtml: string,
  targetHtml: string,
): number {
  if (!sourceHtml) return 0;
  return plan(sourceHtml, targetHtml).length;
}

export function mirrorBlocks(
  sourceHtml: string,
  targetHtml: string,
): MirrorResult {
  const planned = plan(sourceHtml, targetHtml);
  if (planned.length === 0) return { html: targetHtml, added: 0 };

  const target = body(targetHtml);
  // The anchors are the Arabic's own paragraphs, headings, lists, figures —
  // fixed before anything is inserted, so an inserted block never shifts the
  // count for the next one.
  const anchors = Array.from(target.children).filter((el) => !blockOf(el));

  for (const { after, el } of planned) {
    const anchor =
      after === 0 ? null : anchors[Math.min(after, anchors.length) - 1] ?? null;
    // After the anchor, and after any link blocks already following it — so
    // blocks that sat together in the English stay together, in order.
    let next = anchor ? anchor.nextElementSibling : target.firstElementChild;
    while (next && blockOf(next)) next = next.nextElementSibling;
    target.insertBefore(target.ownerDocument.importNode(el, true), next);
  }
  return { html: target.innerHTML, added: planned.length };
}
