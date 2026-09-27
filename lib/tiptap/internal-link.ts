import { Node } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import {
  BLOCK_ATTR,
  DEFAULT_INTERNAL_LINK_VARIANT,
  cleanLabel,
  isInternalLinkKind,
  isInternalLinkVariant,
  readBlockAttrs,
  type InternalLinkKind,
  type InternalLinkVariant,
} from "@/lib/internal-links/model";
import { isUuidLike } from "@/lib/uuid";

export type InternalLinkAttributes = {
  kind: InternalLinkKind;
  targetId: string;
  variant: InternalLinkVariant;
  /** The target's name at the time, for the editor. See `BLOCK_ATTR.label`. */
  label: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    internalLink: {
      /**
       * Insert a link block near the cursor.
       *
       * It goes AFTER the block the cursor is in rather than at the cursor,
       * which is where an image goes. A card is never wanted in the middle of
       * a sentence, and splitting a paragraph around one is a mess to undo;
       * an author puts the cursor in the paragraph the card should follow,
       * and that is where it lands. An empty line is replaced instead, so
       * "new line, insert" leaves no stray blank behind.
       */
      insertInternalLink: (attrs: InternalLinkAttributes) => ReturnType;
      /** Re-point or restyle the block at `pos`. */
      updateInternalLink: (
        pos: number,
        attrs: Partial<InternalLinkAttributes>,
      ) => ReturnType;
    };
  }
}

/**
 * A link to an area guide, a project or a listing, as a block.
 *
 * An atom: it has no content of its own, because nothing in it is the
 * author's words. The name, photograph, price and href are all read from the
 * live record when the page renders (lib/internal-links/resolve.ts), so the
 * stored element is an empty `<div>` carrying the record's kind and id. That
 * is also what keeps it out of the excerpt, the reading time and the Arabic
 * translation walker — there is no text in it to count or translate, and the
 * walker copies an element it has nothing to say about verbatim, attributes
 * and all, so the Arabic body gets the same block for free.
 *
 * The editor draws it through a React node view (the admin blog editor adds
 * one with `extend`). Without one — in tests, or anywhere else this schema is
 * used — it renders as the stored `<div>`, which is correct and invisible.
 */
export const InternalLink = Node.create({
  name: "internalLink",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      kind: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute(BLOCK_ATTR.kind);
          return isInternalLinkKind(v) ? v : null;
        },
        renderHTML: (attrs) => ({ [BLOCK_ATTR.kind]: attrs.kind }),
      },
      targetId: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute(BLOCK_ATTR.id);
          return isUuidLike(v) ? v.toLowerCase() : null;
        },
        renderHTML: (attrs) => ({ [BLOCK_ATTR.id]: attrs.targetId }),
      },
      variant: {
        default: DEFAULT_INTERNAL_LINK_VARIANT,
        parseHTML: (el) => {
          const v = el.getAttribute(BLOCK_ATTR.variant);
          return isInternalLinkVariant(v) ? v : DEFAULT_INTERNAL_LINK_VARIANT;
        },
        renderHTML: (attrs) => ({ [BLOCK_ATTR.variant]: attrs.variant }),
      },
      label: {
        default: null,
        parseHTML: (el) => cleanLabel(el.getAttribute(BLOCK_ATTR.label)),
        renderHTML: (attrs) =>
          attrs.label ? { [BLOCK_ATTR.label]: attrs.label } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div[${BLOCK_ATTR.kind}]`,
        // A block whose target cannot be read is rejected rather than adopted.
        // As an atom it would be an empty box pointing nowhere, and the public
        // page would drop it anyway — better that it never enters the editor.
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const attribs: Record<string, string> = {};
          for (const name of el.getAttributeNames()) {
            attribs[name] = el.getAttribute(name) ?? "";
          }
          return readBlockAttrs(attribs) ? null : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", HTMLAttributes];
  },

  addCommands() {
    return {
      insertInternalLink:
        (attrs) =>
        ({ state, tr, dispatch }) => {
          const node = this.type.create(attrs);
          const { selection } = state;
          let from = selection.from;
          let to = selection.from;

          if (selection instanceof NodeSelection) {
            // A block is selected — another link, a figure: go after it.
            from = to = selection.to;
          } else if (selection.$from.depth > 0) {
            const { $from } = selection;
            const top = $from.node(1);
            if (top.type.name === "paragraph" && top.content.size === 0) {
              from = $from.before(1);
              to = $from.after(1);
            } else {
              from = to = $from.after(1);
            }
          }

          if (dispatch) {
            tr.replaceWith(from, to, node);
            // Selected, so the author sees what they just placed; Enter then
            // opens a paragraph below it, and Backspace takes it straight out.
            tr.setSelection(NodeSelection.create(tr.doc, from));
            tr.scrollIntoView();
          }
          return true;
        },

      updateInternalLink:
        (pos, attrs) =>
        ({ state, tr, dispatch }) => {
          const node = state.doc.nodeAt(pos);
          if (!node || node.type !== this.type) return false;
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
            tr.setSelection(NodeSelection.create(tr.doc, pos));
          }
          return true;
        },
    };
  },
});
