import { Node } from "@tiptap/core";

export type EmailImageAttributes = {
  src: string;
  /** Storage key — the durable identity, as in ./figure-image.ts. */
  mediaKey: string | null;
  alt: string;
  /** Display width in pixels; null lets it fill the column. */
  width: number | null;
  /**
   * Where a click on the image goes — an absolute address, a site path or a
   * url token — or null for an image that is only a picture. Stored as
   * `data-href` on the `<img>`; the renderer wraps it in the link.
   */
  href?: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    emailImage: {
      setEmailImage: (attrs: EmailImageAttributes) => ReturnType;
      /** Point the selected image at an address, or `null` to unlink it. */
      setEmailImageHref: (href: string | null) => ReturnType;
    };
  }
}

/**
 * An image in a system email: a bare block `<img>`, no figure or caption.
 *
 * Emails get their own node rather than reusing FigureImage because a
 * <figure> is not something inboxes render consistently, and a caption under
 * an email image is almost always better written as the next paragraph.
 *
 * `data-media-key` carries the storage key so the renderer can rebuild the
 * address against the current project, exactly as article bodies do.
 */
export const EmailImage = Node.create({
  name: "emailImage",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (el) => el.getAttribute("src") ?? "",
      },
      mediaKey: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-media-key"),
      },
      alt: {
        default: "",
        parseHTML: (el) => el.getAttribute("alt") ?? "",
      },
      width: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute("width");
          return raw && /^\d{1,4}$/.test(raw) ? Number(raw) : null;
        },
      },
      href: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-href") || null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ node }) {
    const attrs: Record<string, string> = {
      src: node.attrs.src as string,
      alt: (node.attrs.alt as string) ?? "",
    };
    if (node.attrs.mediaKey) attrs["data-media-key"] = node.attrs.mediaKey;
    if (node.attrs.width) attrs.width = String(node.attrs.width);
    if (node.attrs.href) attrs["data-href"] = node.attrs.href as string;
    return ["img", attrs];
  },

  addCommands() {
    return {
      setEmailImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
      setEmailImageHref:
        (href) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { href: href?.trim() || null }),
    };
  },
});
