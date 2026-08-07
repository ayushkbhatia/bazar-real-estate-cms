import { describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { FigureImage } from "./figure-image";

const SUPABASE_URL = "https://project-one.supabase.co";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL },
  isSupabaseConfigured: true,
}));

const { sanitizeArticleHtml } = await import("@/lib/article-html");

const BUCKET = `${SUPABASE_URL}/storage/v1/object/public/media`;
const SRC = `${BUCKET}/blog/abc-photo.jpg`;
const KEY = "blog/abc-photo.jpg";

/** The editor exactly as the article screen configures it. */
function editorWith(content: string): Editor {
  return new Editor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), FigureImage],
    content,
  });
}

function htmlAfterInsert(caption: string | null): string {
  const editor = editorWith("<p>Intro.</p>");
  editor
    .chain()
    .setFigureImage({
      src: SRC,
      mediaKey: KEY,
      alt: "A marina at dusk",
      width: 1600,
      height: 900,
      caption,
    })
    .run();
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

describe("FigureImage", () => {
  it("writes a figure carrying the image, its key, and its dimensions", () => {
    const html = htmlAfterInsert("Marsa Al Saadiyat");
    expect(html).toContain("<figure data-figure-image");
    expect(html).toContain(`src="${SRC}"`);
    expect(html).toContain(`data-media-key="${KEY}"`);
    expect(html).toContain('alt="A marina at dusk"');
    expect(html).toContain('width="1600"');
    expect(html).toContain('height="900"');
    expect(html).toContain("<figcaption>Marsa Al Saadiyat</figcaption>");
  });

  it("writes an empty figcaption when there is no caption", () => {
    // Not omitted: the element is the node's content hole, so it has to exist
    // for the figure to parse back. The public page hides it while empty.
    expect(htmlAfterInsert(null)).toContain("<figcaption></figcaption>");
  });

  it("keeps an empty alt rather than dropping the attribute", () => {
    const editor = editorWith("<p></p>");
    editor.chain().setFigureImage({ src: SRC, mediaKey: KEY, alt: "" }).run();
    // `alt=""` marks an image as decorative to a screen reader; a missing alt
    // makes it announce the filename instead.
    expect(editor.getHTML()).toContain('alt=""');
    editor.destroy();
  });

  describe("round-trips through storage and the sanitiser", () => {
    it("survives save → sanitise → reopen unchanged", () => {
      // This is the whole contract: what the editor emits is what the public
      // page renders, and reopening the article yields the same document. A
      // mismatch anywhere here silently mangles an author's work on next save.
      const authored = htmlAfterInsert("Marsa Al Saadiyat");
      const stored = sanitizeArticleHtml(authored);
      const reopened = editorWith(stored);
      const reEmitted = reopened.getHTML();
      reopened.destroy();
      expect(sanitizeArticleHtml(reEmitted)).toBe(stored);
    });

    it("still parses after the project URL changes under it", () => {
      // The src in stored HTML is stale after a handover; the key is not. The
      // sanitiser rewrites src, and the figure must still come back as an
      // editable node rather than a dropped image.
      const stale = `<figure data-figure-image=""><img src="https://project-zero.supabase.co/storage/v1/object/public/media/${KEY}" data-media-key="${KEY}" alt="A" /><figcaption>C</figcaption></figure>`;
      const rendered = sanitizeArticleHtml(stale);
      expect(rendered).toContain(`src="${BUCKET}/${KEY}"`);

      const editor = editorWith(rendered);
      const json = editor.getJSON();
      editor.destroy();
      const figure = json.content?.[0];
      expect(figure?.type).toBe("figureImage");
      expect(figure?.attrs?.mediaKey).toBe(KEY);
    });

    it("adopts a bare <img> from an article written before this node", () => {
      const editor = editorWith(`<p>x</p><img src="${SRC}" alt="Legacy" />`);
      const json = editor.getJSON();
      editor.destroy();
      expect(json.content?.some((n) => n.type === "figureImage")).toBe(true);
    });
  });
});
