import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { ArticleLink } from "./article-link";
import { FigureImage } from "./figure-image";
import { InternalLink } from "./internal-link";

/**
 * The article body's schema, in one place.
 *
 * The admin editor (English and Arabic bodies alike) builds from this, and so
 * do the specs, so a test of the round trip is a test of the editor that
 * writes real articles rather than of a hand-copied lookalike.
 *
 * `internalLink` is the one slot a caller swaps: the admin editor passes the
 * same node extended with its React node view. The schema — and therefore
 * the stored HTML — is identical either way.
 */
export function articleExtensions(
  opts: { internalLink?: AnyExtension } = {},
): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      // StarterKit v3 bundles its own Link. `ArticleLink` below replaces it;
      // loading both registers the mark twice.
      link: false,
    }),
    ArticleLink.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: "noopener noreferrer" },
    }),
    FigureImage,
    opts.internalLink ?? InternalLink,
  ];
}
