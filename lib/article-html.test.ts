import { describe, expect, it, vi } from "vitest";

const SUPABASE_URL = "https://project-one.supabase.co";

// The sanitiser reads the project URL to decide which image hosts it trusts
// and to rebuild `src` from a storage key. Pinning it keeps those assertions
// independent of whatever is in the developer's .env.local.
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL },
  isSupabaseConfigured: true,
}));

const { sanitizeArticleHtml } = await import("./article-html");

const BUCKET = `${SUPABASE_URL}/storage/v1/object/public/media`;

describe("sanitizeArticleHtml", () => {
  it("returns an empty string for empty input", () => {
    expect(sanitizeArticleHtml("")).toBe("");
  });

  describe("preserves what the editor can produce", () => {
    // Anything in here that the sanitiser strips would be silently destroyed
    // on an author's next save, so these are regression guards on the
    // allowlist, not just happy-path coverage.
    const cases: Array<[string, string]> = [
      ["paragraphs", "<p>Hello.</p>"],
      ["headings", "<h2>Two</h2><h3>Three</h3>"],
      ["bold and italic", "<p><strong>a</strong><em>b</em></p>"],
      ["strikethrough", "<p><s>gone</s></p>"],
      ["bullet lists", "<ul><li>one</li><li>two</li></ul>"],
      ["ordered lists", "<ol><li>one</li></ol>"],
      ["blockquotes", "<blockquote><p>quoted</p></blockquote>"],
      ["code", "<p><code>npm run dev</code></p>"],
      ["horizontal rules", "<hr />"],
      ["hard breaks", "<p>a<br />b</p>"],
      ["empty paragraph spacers", "<p></p>"],
      ["legacy tables", "<table><tbody><tr><td>a</td></tr></tbody></table>"],
    ];
    for (const [name, html] of cases) {
      it(name, () => {
        expect(sanitizeArticleHtml(html)).toBe(html);
      });
    }

    it("links, with their attributes", () => {
      const out = sanitizeArticleHtml('<p><a href="https://bazar.ae">x</a></p>');
      expect(out).toContain('href="https://bazar.ae"');
    });

    it("the figure marker the editor re-parses its own images from", () => {
      const out = sanitizeArticleHtml(
        `<figure data-figure-image=""><img src="${BUCKET}/blog/a.jpg" alt="A" width="800" height="600" /><figcaption>Cap</figcaption></figure>`,
      );
      expect(out).toContain("data-figure-image");
      expect(out).toContain('width="800"');
      expect(out).toContain('height="600"');
      expect(out).toContain("<figcaption>Cap</figcaption>");
    });
  });

  describe("strips what it must", () => {
    it("removes script tags and their contents", () => {
      // Dropping only the tag would leave `alert(1)` as visible body text.
      const out = sanitizeArticleHtml("<p>a</p><script>alert(1)</script>");
      expect(out).toBe("<p>a</p>");
    });

    it("removes inline event handlers", () => {
      const out = sanitizeArticleHtml(
        `<img src="${BUCKET}/blog/a.jpg" onerror="alert(1)" />`,
      );
      expect(out).not.toContain("onerror");
      expect(out).toContain("src=");
    });

    it("rejects javascript: hrefs", () => {
      const out = sanitizeArticleHtml('<p><a href="javascript:alert(1)">x</a></p>');
      expect(out).not.toContain("javascript:");
    });

    it("rejects data: image sources", () => {
      const out = sanitizeArticleHtml(
        '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" />',
      );
      expect(out).not.toContain("<img");
    });

    it("drops images hotlinked from another host", () => {
      const out = sanitizeArticleHtml('<img src="https://evil.example/x.jpg" />');
      expect(out).not.toContain("<img");
    });

    it("keeps images served from the project's own storage bucket", () => {
      const out = sanitizeArticleHtml(`<img src="${BUCKET}/blog/a.jpg" />`);
      expect(out).toContain("<img");
    });

    it("removes style attributes and iframes", () => {
      const out = sanitizeArticleHtml(
        '<p style="position:fixed">a</p><iframe src="https://evil.example"></iframe>',
      );
      expect(out).not.toContain("style=");
      expect(out).not.toContain("<iframe");
    });

    it("discards non-numeric width and height", () => {
      const out = sanitizeArticleHtml(
        `<img src="${BUCKET}/blog/a.jpg" width="100%" height="tall" />`,
      );
      expect(out).not.toContain("width=");
      expect(out).not.toContain("height=");
    });
  });

  describe("storage keys outlive the project URL", () => {
    it("rebuilds src from the media key, discarding a stale host", () => {
      // The scenario this exists for: the client swaps the Supabase project at
      // handover, so every `src` an author ever inserted now points at a dead
      // origin. The key is what survives.
      const out = sanitizeArticleHtml(
        '<img src="https://project-zero.supabase.co/storage/v1/object/public/media/blog/a.jpg" data-media-key="blog/a.jpg" />',
      );
      expect(out).toContain(`src="${BUCKET}/blog/a.jpg"`);
      expect(out).not.toContain("project-zero");
    });

    it("keeps the key in the output so the editor can round-trip it", () => {
      const out = sanitizeArticleHtml(
        `<img src="${BUCKET}/blog/a.jpg" data-media-key="blog/a.jpg" />`,
      );
      expect(out).toContain('data-media-key="blog/a.jpg"');
    });

    it("refuses a key that tries to escape the bucket", () => {
      const out = sanitizeArticleHtml(
        '<img src="https://evil.example/x.jpg" data-media-key="../../etc/passwd" />',
      );
      expect(out).not.toContain("<img");
    });

    it("refuses a key pointing at an unknown folder", () => {
      const out = sanitizeArticleHtml(
        '<img src="https://evil.example/x.jpg" data-media-key="secrets/a.jpg" />',
      );
      expect(out).not.toContain("<img");
    });
  });

  describe("normalises", () => {
    it("adds noopener to links that open a new tab", () => {
      const out = sanitizeArticleHtml(
        '<p><a href="https://x.example" target="_blank">x</a></p>',
      );
      expect(out).toContain('rel="noopener noreferrer"');
    });

    it("marks images lazy and async", () => {
      const out = sanitizeArticleHtml(`<img src="${BUCKET}/blog/a.jpg" />`);
      expect(out).toContain('loading="lazy"');
      expect(out).toContain('decoding="async"');
    });
  });

  it("is idempotent, so save-path and render-path passes agree", () => {
    // Both paths sanitise. If a second pass differed from the first, stored
    // HTML and rendered HTML would drift apart.
    const input = `<h2>T</h2><p><a href="https://x.example" target="_blank">x</a></p><figure data-figure-image=""><img src="${BUCKET}/blog/a.jpg" alt="A" width="800" /><figcaption>C</figcaption></figure>`;
    const once = sanitizeArticleHtml(input);
    expect(sanitizeArticleHtml(once)).toBe(once);
  });
});
