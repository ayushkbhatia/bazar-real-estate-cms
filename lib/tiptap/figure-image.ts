import { Node } from "@tiptap/core";

export type FigureImageAttributes = {
  src: string;
  /**
   * Storage key of the underlying media asset, e.g. `blog/<uuid>-photo.jpg`.
   *
   * This, not `src`, is the durable identity of the image. The `src` is a
   * fully-qualified Supabase URL that embeds the project ref, so a body with
   * bare `src` attributes would point at a dead host the moment the project
   * URL changes — which it does at client handover. The public renderer
   * recomputes `src` from this key on the way out (lib/article-html.ts), and
   * the media-usage index matches on it to keep an in-body image from being
   * reported as unused (lib/queries/media-usage.ts).
   */
  mediaKey?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figureImage: {
      /** Insert an image block, optionally with a starting caption. */
      setFigureImage: (
        attrs: FigureImageAttributes & { caption?: string | null },
      ) => ReturnType;
    };
  }
}

/** Numeric-only, and small enough to be a plausible pixel dimension. */
function dimension(raw: string | null): number | null {
  if (!raw || !/^\d{1,5}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

/**
 * An image block with an optional caption.
 *
 * The caption is the node's *content* (`inline*`) rather than an attribute, so
 * ProseMirror edits it natively — no NodeView, and marks like bold or a link
 * work inside it for free. `renderHTML` puts the content hole in the
 * `<figcaption>`, which is also what makes the stored HTML round-trip: the same
 * markup the public page renders is what `parseHTML` reads back when the editor
 * reopens the article.
 *
 * `data-figure-image` is what distinguishes our figures from any other
 * `<figure>` that might arrive by paste. It is preserved by the sanitiser in
 * lib/article-html.ts for exactly this reason.
 */
export const FigureImage = Node.create({
  name: "figureImage",
  group: "block",
  content: "inline*",
  draggable: true,
  // Keeps backspace at the start of a caption from merging the figure into the
  // paragraph above it, and keeps a selection from spanning in or out.
  isolating: true,

  addAttributes() {
    return {
      src: { default: null },
      mediaKey: { default: null },
      alt: { default: null },
      width: { default: null },
      height: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-figure-image]",
        contentElement: "figcaption",
        getAttrs: (element) => {
          const img = (element as HTMLElement).querySelector("img");
          const src = img?.getAttribute("src");
          // Returning false rejects the match, so a figure whose image has
          // gone missing falls through rather than becoming a broken node.
          if (!src) return false;
          return {
            src,
            mediaKey: img?.getAttribute("data-media-key") ?? null,
            alt: img?.getAttribute("alt") ?? null,
            width: dimension(img?.getAttribute("width") ?? null),
            height: dimension(img?.getAttribute("height") ?? null),
          };
        },
      },
      {
        // A bare <img>, e.g. pasted or from an article written before this
        // node existed. Adopted as an uncaptioned figure.
        tag: "img[src]",
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const src = el.getAttribute("src");
          if (!src) return false;
          return {
            src,
            mediaKey: el.getAttribute("data-media-key") ?? null,
            alt: el.getAttribute("alt") ?? null,
            width: dimension(el.getAttribute("width")),
            height: dimension(el.getAttribute("height")),
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const { src, mediaKey, alt, width, height } = node.attrs as {
      src: string;
      mediaKey: string | null;
      alt: string | null;
      width: number | null;
      height: number | null;
    };
    const img: Record<string, string> = {
      // Written so the editor and any un-rewritten consumer can display the
      // image directly. The public page recomputes it from `data-media-key`.
      src,
      // An empty alt is meaningful — it marks the image as decorative — so it
      // is written out rather than omitted.
      alt: alt ?? "",
      loading: "lazy",
      decoding: "async",
    };
    if (mediaKey) img["data-media-key"] = mediaKey;
    if (width) img.width = String(width);
    if (height) img.height = String(height);

    return [
      "figure",
      { "data-figure-image": "" },
      ["img", img],
      ["figcaption", 0],
    ];
  },

  addCommands() {
    return {
      setFigureImage:
        ({ caption, ...attrs }) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
            content: caption
              ? [{ type: "text", text: caption }]
              : undefined,
          }),
    };
  },
});
