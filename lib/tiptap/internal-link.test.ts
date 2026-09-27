import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { articleExtensions } from "./article-extensions";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: "https://project-one.supabase.co" },
  isSupabaseConfigured: true,
}));

const { sanitizeArticleHtml } = await import("@/lib/article-html");

const DEV = "33333333-0000-0000-0000-000000000008";
const AREA = "0d4c6b8e-5a1f-4e2b-9c3d-7f8e9a0b1c2d";

const editors: Editor[] = [];
afterEach(() => {
  while (editors.length) editors.pop()!.destroy();
});

/** The editor exactly as the article screen builds it. */
function editorWith(content: string): Editor {
  const editor = new Editor({ extensions: articleExtensions(), content });
  editors.push(editor);
  return editor;
}

/** Put a collapsed cursor just inside the Nth top-level block's content. */
function cursorIn(editor: Editor, blockIndex: number, offset = 1) {
  let pos = 0;
  editor.state.doc.forEach((node, at, index) => {
    if (index === blockIndex) pos = at + 1 + Math.min(offset, node.content.size);
  });
  editor.view.dispatch(
    editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos)),
  );
}

const card = {
  kind: "development" as const,
  targetId: DEV,
  variant: "card" as const,
  label: "Saadiyat Lagoons",
};

describe("the article editor's schema", () => {
  it("registers each extension once", () => {
    // StarterKit v3 bundles Link. Before `link: false` the editor loaded two,
    // and TipTap said so on every mount.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const editor = editorWith("<p>x</p>");
    const names = editor.extensionManager.extensions.map((e) => e.name);
    expect(names.filter((n) => n === "link")).toHaveLength(1);
    expect(
      warn.mock.calls.some((c) => String(c[0]).includes("Duplicate extension")),
    ).toBe(false);
    warn.mockRestore();
  });
});

describe("InternalLink", () => {
  it("writes an empty div carrying the record, the variant and the label", () => {
    const editor = editorWith("<p>Intro.</p>");
    cursorIn(editor, 0);
    editor.commands.insertInternalLink(card);
    // The trailing `<p></p>` is StarterKit's TrailingNode, which keeps a
    // place to type after a block that ends the document. Figures get one too.
    expect(editor.getHTML()).toBe(
      `<p>Intro.</p><div data-internal-link="development" data-id="${DEV}" data-variant="card" data-label="Saadiyat Lagoons"></div><p></p>`,
    );
  });

  it("goes after the paragraph the cursor is in, never splitting it", () => {
    const editor = editorWith("<p>First sentence. Second.</p><p>Next.</p>");
    cursorIn(editor, 0, 5); // mid-sentence
    editor.commands.insertInternalLink(card);
    const html = editor.getHTML();
    expect(html.startsWith("<p>First sentence. Second.</p><div")).toBe(true);
    expect(html.endsWith("<p>Next.</p>")).toBe(true);
  });

  it("goes after a whole list, not inside a list item", () => {
    const editor = editorWith("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
    cursorIn(editor, 0, 3);
    editor.commands.insertInternalLink(card);
    expect(editor.getHTML()).toMatch(/<\/ul><div data-internal-link=/);
  });

  it("replaces an empty line instead of leaving it behind", () => {
    const editor = editorWith("<p>Above.</p><p></p><p>Below.</p>");
    cursorIn(editor, 1, 0);
    editor.commands.insertInternalLink(card);
    expect(editor.getHTML()).toBe(
      `<p>Above.</p><div data-internal-link="development" data-id="${DEV}" data-variant="card" data-label="Saadiyat Lagoons"></div><p>Below.</p>`,
    );
  });

  it("goes after a selected block, and selects what it inserted", () => {
    const editor = editorWith(
      `<p>a</p><div data-internal-link="area" data-id="${AREA}" data-variant="card"></div><p>b</p>`,
    );
    let blockPos = -1;
    editor.state.doc.forEach((node, at) => {
      if (node.type.name === "internalLink") blockPos = at;
    });
    editor.view.dispatch(
      editor.state.tr.setSelection(
        NodeSelection.create(editor.state.doc, blockPos),
      ),
    );
    editor.commands.insertInternalLink(card);
    const kinds: string[] = [];
    editor.state.doc.forEach((node) => kinds.push(node.type.name));
    expect(kinds).toEqual([
      "paragraph",
      "internalLink",
      "internalLink",
      "paragraph",
    ]);
    const sel = editor.state.selection;
    expect(sel).toBeInstanceOf(NodeSelection);
    expect((sel as NodeSelection).node.attrs.targetId).toBe(DEV);
  });

  it("allows the same record to be linked more than once", () => {
    const editor = editorWith("<p>a</p><p>b</p>");
    cursorIn(editor, 0);
    editor.commands.insertInternalLink(card);
    cursorIn(editor, 2);
    editor.commands.insertInternalLink({ ...card, variant: "compact" });
    const html = editor.getHTML();
    expect(html.match(/data-internal-link=/g)).toHaveLength(2);
  });

  it("re-points and restyles a block in place", () => {
    const editor = editorWith(
      `<p>a</p><div data-internal-link="development" data-id="${DEV}" data-variant="card"></div>`,
    );
    let pos = -1;
    editor.state.doc.forEach((node, at) => {
      if (node.type.name === "internalLink") pos = at;
    });
    editor.commands.updateInternalLink(pos, {
      kind: "area",
      targetId: AREA,
      variant: "compact",
      label: "Yas Island",
    });
    expect(editor.getHTML()).toBe(
      `<p>a</p><div data-internal-link="area" data-id="${AREA}" data-variant="compact" data-label="Yas Island"></div><p></p>`,
    );
  });

  it("refuses to update something that is not a link block", () => {
    const editor = editorWith("<p>a</p>");
    expect(editor.commands.updateInternalLink(0, { variant: "compact" })).toBe(
      false,
    );
  });

  it("does not adopt a block it cannot read", () => {
    const editor = editorWith(
      '<p>a</p><div data-internal-link="agent" data-id="x"></div><p>b</p>',
    );
    expect(editor.getHTML()).not.toContain("data-internal-link");
  });

  it("reads a block written without a variant as a card", () => {
    const editor = editorWith(
      `<div data-internal-link="area" data-id="${AREA}"></div>`,
    );
    expect(editor.getHTML()).toContain('data-variant="card"');
  });

  it("survives save → sanitise → reopen unchanged", () => {
    // The contract that matters: what the editor writes is what is stored,
    // and reopening the article yields the same document. A mismatch here is
    // a card that silently vanishes on an editor's next save.
    const editor = editorWith("<p>Intro.</p><p>Outro.</p>");
    cursorIn(editor, 0);
    editor.commands.insertInternalLink(card);
    cursorIn(editor, 2);
    editor.commands.insertInternalLink({
      kind: "area",
      targetId: AREA,
      variant: "compact",
      label: null,
    });
    const authored = editor.getHTML();
    const stored = sanitizeArticleHtml(authored);
    expect(stored).toBe(authored);
    expect(editorWith(stored).getHTML()).toBe(authored);
  });
});

describe("ArticleLink", () => {
  function selectWord(editor: Editor, word: string) {
    let from = -1;
    editor.state.doc.descendants((node, pos) => {
      if (from === -1 && node.isText && node.text?.includes(word)) {
        from = pos + node.text.indexOf(word);
      }
    });
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, from, from + word.length),
      ),
    );
  }

  it("links words to a record, in the same tab", () => {
    const editor = editorWith("<p>Villas on Yas Island sold well.</p>");
    selectWord(editor, "Yas Island");
    editor.commands.setInternalTextLink({
      href: "/areas/yas-island",
      kind: "area",
      id: AREA.toUpperCase(),
    });
    const html = editor.getHTML();
    expect(html).toContain(
      `<a href="/areas/yas-island" data-link-kind="area" data-link-id="${AREA}">Yas Island</a>`,
    );
    expect(html).not.toContain("target=");
    expect(html).not.toContain("rel=");
  });

  it("forgets the record when the URL is retyped by hand", () => {
    // setMark merges attributes, so without the explicit reset the old id
    // would ride along and the public page would put the old target back.
    const editor = editorWith(
      `<p><a href="/areas/yas-island" data-link-kind="area" data-link-id="${AREA}">Yas Island</a></p>`,
    );
    selectWord(editor, "Yas Island");
    editor.commands.setExternalLink("https://example.com/");
    const html = editor.getHTML();
    expect(html).toContain('href="https://example.com/"');
    expect(html).not.toContain("data-link-kind");
    expect(html).not.toContain("data-link-id");
  });

  it("round-trips a text link through the sanitiser", () => {
    const html = `<p>See <a href="/developments/x" data-link-kind="development" data-link-id="${DEV}">the project</a>.</p>`;
    const reopened = editorWith(sanitizeArticleHtml(html)).getHTML();
    expect(reopened).toBe(html);
  });
});
