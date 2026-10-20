import { Node } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import {
  DEFAULT_FEATURE_LAYOUT,
  FEATURE_ATTR,
  featureAttrs,
  normaliseFeatureBlock,
  readFeatureAttrs,
  type FeatureKind,
  type FeatureLayout,
} from "@/lib/content-assets/email-feature";

export type EmailFeatureAttributes = {
  kind: FeatureKind;
  ids: string[];
  layout: FeatureLayout;
  /** The records' names at the time, for the editor. See `FEATURE_ATTR.labels`. */
  labels: string[];
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    emailFeature: {
      /**
       * Insert a featured block after the block the cursor is in — never in
       * the middle of a sentence. An empty line is replaced instead.
       */
      insertEmailFeature: (attrs: EmailFeatureAttributes) => ReturnType;
      /** Re-pick, reorder or restyle the block at `pos`. */
      updateEmailFeature: (pos: number, attrs: Partial<EmailFeatureAttributes>) => ReturnType;
    };
  }
}

function attribsOf(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of el.getAttributeNames()) out[name] = el.getAttribute(name) ?? "";
  return out;
}

/**
 * Featured records in an email body: listings, projects, articles or area
 * guides, as cards (lib/content-assets/email-feature.ts).
 *
 * An atom with no content: nothing in it is the author's words. The stored
 * element is an empty `<div>` naming the records; the cards are drawn from
 * the live records when the email is rendered, in each reader's language.
 * Having no text is also what lets the translation pass copy it into the
 * Arabic edition untouched.
 *
 * The newsletter composer draws it through a React node view (`extend`).
 * Without one it renders as the stored `<div>`.
 */
export const EmailFeature = Node.create({
  name: "emailFeature",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    // Read together, so a malformed piece can't leave the block half-valid.
    const read = (el: HTMLElement) => readFeatureAttrs(attribsOf(el));
    return {
      kind: { default: null, parseHTML: (el) => read(el)?.kind ?? null, renderHTML: () => ({}) },
      ids: { default: [], parseHTML: (el) => read(el)?.ids ?? [], renderHTML: () => ({}) },
      layout: {
        default: DEFAULT_FEATURE_LAYOUT,
        parseHTML: (el) => read(el)?.layout ?? DEFAULT_FEATURE_LAYOUT,
        renderHTML: () => ({}),
      },
      labels: { default: [], parseHTML: (el) => read(el)?.labels ?? [], renderHTML: () => ({}) },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div[${FEATURE_ATTR.kind}]`,
        // A block that names nothing usable never enters the editor: as an
        // atom it would be an empty box, and the renderer would drop it anyway.
        getAttrs: (element) => (readFeatureAttrs(attribsOf(element as HTMLElement)) ? null : false),
      },
    ];
  },

  renderHTML({ node }) {
    const block = normaliseFeatureBlock({
      kind: node.attrs.kind,
      ids: (node.attrs.ids as string[]) ?? [],
      layout: node.attrs.layout,
      labels: (node.attrs.labels as string[]) ?? [],
    });
    return ["div", block ? featureAttrs(block) : {}];
  },

  addCommands() {
    return {
      insertEmailFeature:
        (attrs) =>
        ({ state, tr, dispatch }) => {
          const node = this.type.create(attrs);
          const { selection } = state;
          let from = selection.to;
          let to = selection.to;
          if (selection instanceof NodeSelection) {
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
            tr.setSelection(NodeSelection.create(tr.doc, from));
            tr.scrollIntoView();
          }
          return true;
        },

      updateEmailFeature:
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
