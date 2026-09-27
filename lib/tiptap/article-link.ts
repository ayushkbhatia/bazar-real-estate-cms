import Link from "@tiptap/extension-link";
import {
  ANCHOR_ATTR,
  isInternalLinkKind,
  type InternalLinkKind,
} from "@/lib/internal-links/model";
import { isUuidLike } from "@/lib/uuid";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    articleLink: {
      /**
       * Link the selection to a record on this site. `href` is the record's
       * path today; the public page re-derives it from `id` on every render,
       * so it only matters if that lookup fails.
       */
      setInternalTextLink: (attrs: {
        href: string;
        kind: InternalLinkKind;
        id: string;
      }) => ReturnType;
      /**
       * Link the selection to a URL someone typed, and forget any record the
       * link used to point at.
       *
       * `setLink` alone is not enough here: `setMark` MERGES into an existing
       * mark's attributes, so retyping the URL of an internal link would keep
       * its record id — and the public page, which trusts the id over the
       * href, would quietly put the old target back.
       */
      setExternalLink: (href: string) => ReturnType;
    };
  }
}

/**
 * The article editor's link mark: TipTap's `Link`, plus the two attributes
 * that make a link internal — see lib/internal-links/model.ts.
 *
 * It is the ONLY link extension the editor may load. StarterKit v3 bundles
 * `Link` itself, so the editor also has to pass `link: false` to StarterKit;
 * before this existed it registered both, which TipTap reports as "Duplicate
 * extension names found: ['link']".
 */
export const ArticleLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      linkKind: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute(ANCHOR_ATTR.kind);
          return isInternalLinkKind(v) ? v : null;
        },
        renderHTML: (attrs) =>
          attrs.linkKind ? { [ANCHOR_ATTR.kind]: attrs.linkKind } : {},
      },
      linkId: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute(ANCHOR_ATTR.id);
          return isUuidLike(v) ? v.toLowerCase() : null;
        },
        renderHTML: (attrs) =>
          attrs.linkId ? { [ANCHOR_ATTR.id]: attrs.linkId } : {},
      },
    };
  },

  /*
   * An internal link is written with no `target` and no `rel`, whatever its
   * attributes say.
   *
   * Setting them to null on insert is not enough on its own. `Link` defaults
   * `target` to "_blank", and TipTap reads an ABSENT attribute as "use the
   * default" — so an internal link reopened from the database came back with
   * `target="_blank" rel="noopener noreferrer"`, and the next save wrote those
   * in. The round trip was not stable, and every internal link would have
   * drifted into opening a new tab the second time anyone saved the article.
   * The parent's `renderHTML` merges the configured defaults back in, so it is
   * bypassed for these rather than handed a trimmed copy.
   */
  renderHTML({ mark, HTMLAttributes }) {
    if (!HTMLAttributes[ANCHOR_ATTR.kind]) {
      return this.parent!({ mark, HTMLAttributes });
    }
    const attrs: Record<string, unknown> = { ...HTMLAttributes };
    delete attrs.target;
    delete attrs.rel;
    delete attrs.class;
    return ["a", attrs, 0];
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setInternalTextLink:
        ({ href, kind, id }) =>
        ({ chain }) =>
          chain()
            .setMark(this.name, {
              href,
              // Same tab, and no `rel`: this is the reader moving around our
              // own site, not leaving it.
              target: null,
              rel: null,
              linkKind: kind,
              linkId: id.toLowerCase(),
            })
            .setMeta("preventAutolink", true)
            .run(),
      setExternalLink:
        (href) =>
        ({ chain }) =>
          chain()
            .setLink({ href })
            .updateAttributes(this.name, { linkKind: null, linkId: null })
            .run(),
    };
  },
});
