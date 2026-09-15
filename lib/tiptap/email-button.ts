import { Node } from "@tiptap/core";

export type EmailButtonAttributes = {
  /** An absolute address, or a single url token such as `{{confirm_url}}`. */
  href: string;
  label: string;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    emailButton: {
      /** Insert a call-to-action button as its own block. */
      setEmailButton: (attrs: EmailButtonAttributes) => ReturnType;
    };
  }
}

/**
 * A call-to-action button in a system email.
 *
 * Stored as `<a data-email-button href="…">Label</a>` at block level — the
 * marker, not a class, is what the renderer in lib/content-assets/email-html.ts
 * keys on to draw it as a filled button with the brand colour, and what
 * `parseHTML` reads back when the editor reopens the email.
 *
 * An atom: the label and target are attributes edited in a dialog, not text
 * typed inline. That keeps a button from being half-deleted into a paragraph
 * that happens to be a link, and keeps the stored markup exactly the shape the
 * renderer expects.
 *
 * The parse rule outranks the Link mark's `a[href]` rule, which would
 * otherwise claim the element as an inline link.
 */
export const EmailButton = Node.create({
  name: "emailButton",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      href: {
        default: "",
        parseHTML: (el) => el.getAttribute("href") ?? "",
      },
      label: {
        default: "Button",
        parseHTML: (el) => el.textContent?.trim() || "Button",
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-email-button]", priority: 100 }];
  },

  renderHTML({ node }) {
    return [
      "a",
      { "data-email-button": "", href: node.attrs.href as string },
      (node.attrs.label as string) || "Button",
    ];
  },

  addCommands() {
    return {
      setEmailButton:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
