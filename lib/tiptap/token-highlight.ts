import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type TokenHighlightOptions = {
  /** Token names this email may use. Anything else is marked as a problem. */
  allowed: readonly string[];
};

const KEY = new PluginKey("tokenHighlight");

/**
 * Paints `{{tokens}}` in the editor so they read as fields, not prose — and
 * paints the ones nothing on this send path fills in the error colour, before
 * the save-time check has to say so.
 *
 * Decorations only: the stored HTML is untouched, the token stays plain text
 * an editor can type, delete or retype, and nothing about it depends on this
 * extension being loaded.
 */
export const TokenHighlight = Extension.create<TokenHighlightOptions>({
  name: "tokenHighlight",

  addOptions() {
    return { allowed: [] };
  },

  addProseMirrorPlugins() {
    const allowed = new Set(this.options.allowed);

    function build(doc: PMNode): DecorationSet {
      const decorations: Decoration[] = [];
      doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        for (const m of node.text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) {
          const from = pos + (m.index ?? 0);
          decorations.push(
            Decoration.inline(from, from + m[0].length, {
              class: allowed.has(m[1].toLowerCase())
                ? "email-token"
                : "email-token email-token-bad",
            }),
          );
        }
      });
      return DecorationSet.create(doc, decorations);
    }

    return [
      new Plugin({
        key: KEY,
        state: {
          init: (_config, state) => build(state.doc),
          apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old),
        },
        props: {
          decorations(state) {
            return KEY.getState(state) as DecorationSet;
          },
        },
      }),
    ];
  },
});
