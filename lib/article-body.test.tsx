import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const SUPABASE_URL = "https://project-one.supabase.co";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL },
  isSupabaseConfigured: true,
}));

const { renderArticleBody } = await import("./article-body");

const BUCKET = `${SUPABASE_URL}/storage/v1/object/public/media`;
const SRC = `${BUCKET}/blog/a.jpg`;

function draw(html: string) {
  return render(<div>{renderArticleBody(html)}</div>);
}

describe("renderArticleBody", () => {
  it("keeps ordinary markup and its nesting", () => {
    const { container } = draw(
      "<h2>Heading</h2><p>Body with <strong>bold</strong>.</p><ul><li>one</li></ul>",
    );
    expect(container.querySelector("h2")?.textContent).toBe("Heading");
    expect(container.querySelector("p strong")?.textContent).toBe("bold");
    expect(container.querySelector("ul li")?.textContent).toBe("one");
  });

  it("preserves the empty paragraphs authors use as spacers", () => {
    // These carry the blank lines between paragraphs. Parsing must not
    // collapse them away — see the `.bz-prose > p:empty` rule.
    const { container } = draw("<p>a</p><p></p><p>b</p>");
    expect(container.querySelectorAll("p")).toHaveLength(3);
  });

  it("still sanitises, so callers cannot render a body unfiltered", () => {
    const { container } = draw("<p>ok</p><script>alert(1)</script>");
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toBe("ok");
  });

  describe("in-body images", () => {
    it("routes a sized image through the optimiser", () => {
      // The whole point of parsing to React: `dangerouslySetInnerHTML` would
      // have shipped the original file untouched.
      draw(
        `<figure data-figure-image=""><img src="${SRC}" alt="A marina" width="2064" height="1376" /><figcaption>C</figcaption></figure>`,
      );
      const img = screen.getByAltText("A marina");
      expect(img.getAttribute("src")).toContain("/_next/image");
      expect(img.getAttribute("srcset")).toBeTruthy();
      expect(img.getAttribute("sizes")).toBe("(min-width: 760px) 664px, 100vw");
      expect(img.getAttribute("loading")).toBe("lazy");
    });

    it("keeps the intrinsic dimensions that reserve the box", () => {
      draw(
        `<img src="${SRC}" alt="A marina" width="2064" height="1376" />`,
      );
      const img = screen.getByAltText("A marina");
      expect(img.getAttribute("width")).toBe("2064");
      expect(img.getAttribute("height")).toBe("1376");
    });

    it("leaves an unsized image as a plain tag rather than guessing", () => {
      // A bare <img> inherited from an older article, or one whose size probe
      // timed out. Unoptimised, but rendered — not dropped.
      draw(`<img src="${SRC}" alt="Legacy" />`);
      const img = screen.getByAltText("Legacy");
      expect(img.getAttribute("src")).toBe(SRC);
      expect(img.getAttribute("srcset")).toBeNull();
    });

    it("renders a decorative image with an empty alt", () => {
      const { container } = draw(
        `<img src="${SRC}" alt="" width="800" height="600" />`,
      );
      const img = container.querySelector("img");
      expect(img).not.toBeNull();
      expect(img?.getAttribute("alt")).toBe("");
    });

    it("drops a hotlinked image before it ever reaches the optimiser", () => {
      // Otherwise our own image proxy would be fetching third-party hosts.
      const { container } = draw(
        '<img src="https://evil.example/x.jpg" alt="x" width="10" height="10" />',
      );
      expect(container.querySelector("img")).toBeNull();
    });
  });
});
