import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextSelection } from "@tiptap/pm/state";
import { EmailButton } from "./email-button";
import { EmailImage } from "./email-image";
import { EmailFeature } from "./email-feature";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: "https://project-one.supabase.co" },
  isSupabaseConfigured: true,
}));

const { sanitizeEmailBody } = await import("@/lib/content-assets/email-html");
const { featureBlocksIn } = await import("@/lib/content-assets/email-feature");

const P1 = "11111111-0000-0000-0000-000000000001";
const P2 = "11111111-0000-0000-0000-000000000002";
const SRC = "https://project-one.supabase.co/storage/v1/object/public/media/brand/hero.jpg";

const editors: Editor[] = [];
afterEach(() => {
  while (editors.length) editors.pop()!.destroy();
});

/** The schema the newsletter composer builds (its view aside). */
function editorWith(content: string): Editor {
  const editor = new Editor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false }), EmailButton, EmailImage, EmailFeature],
    content,
  });
  editors.push(editor);
  return editor;
}

describe("the featured block node", () => {
  it("lands after the paragraph the cursor is in, and survives save → sanitise → reopen", () => {
    const editor = editorWith("<p>First</p><p>Second</p>");
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)));
    editor.commands.insertEmailFeature({ kind: "property", ids: [P1, P2], layout: "grid", labels: ["Villa", 'A "flat"'] });
    const html = editor.getHTML();
    expect(html.indexOf("data-email-feature")).toBeGreaterThan(html.indexOf("First"));
    expect(html.indexOf("data-email-feature")).toBeLessThan(html.indexOf("Second"));

    const saved = sanitizeEmailBody(html, { features: true });
    expect(featureBlocksIn(saved)).toEqual([
      { kind: "property", ids: [P1, P2], layout: "grid", labels: ["Villa", 'A "flat"'] },
    ]);
    const reopened = editorWith(saved);
    expect(sanitizeEmailBody(reopened.getHTML(), { features: true })).toBe(saved);
  });

  it("refuses a block that names nothing usable", () => {
    const editor = editorWith('<div data-email-feature="property" data-ids="nope"></div><p>x</p>');
    expect(editor.getHTML()).not.toContain("data-email-feature");
  });

  it("updates in place", () => {
    const editor = editorWith("<p>x</p>");
    editor.commands.insertEmailFeature({ kind: "article", ids: [P1], layout: "card", labels: ["A"] });
    let pos = -1;
    editor.state.doc.descendants((n, p) => {
      if (n.type.name === "emailFeature") pos = p;
    });
    editor.commands.updateEmailFeature(pos, { layout: "list" });
    expect(featureBlocksIn(editor.getHTML())[0].layout).toBe("list");
  });
});

describe("a linked email image", () => {
  it("keeps its link through a save and a reopen, and can be unlinked", () => {
    const editor = editorWith(`<img src="${SRC}" data-media-key="brand/hero.jpg" data-href="/developments/x" alt="Hero">`);
    const saved = sanitizeEmailBody(editor.getHTML());
    expect(saved).toContain('data-href="/developments/x"');
    const reopened = editorWith(saved);
    expect(reopened.getHTML()).toContain('data-href="/developments/x"');
    let pos = -1;
    reopened.state.doc.descendants((n, p) => {
      if (n.type.name === "emailImage") pos = p;
    });
    reopened.commands.setNodeSelection(pos);
    reopened.commands.setEmailImageHref(null);
    expect(reopened.getHTML()).not.toContain("data-href");
  });
});
