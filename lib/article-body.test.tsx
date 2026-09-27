import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type {
  InternalLinkLookup,
  ResolvedInternalLink,
} from "@/lib/internal-links/types";

const SUPABASE_URL = "https://project-one.supabase.co";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL },
  isSupabaseConfigured: true,
}));

const { renderArticleBody, articleBodyLinkRefs } = await import(
  "./article-body"
);

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

  describe("internal links", () => {
    const AREA = "0d4c6b8e-5a1f-4e2b-9c3d-7f8e9a0b1c2d";
    const DEV = "33333333-0000-0000-0000-000000000008";
    const GONE = "55555555-0000-0000-0000-000000000009";

    const area: ResolvedInternalLink = {
      kind: "area",
      id: AREA,
      slug: "yas-island",
      href: "/areas/yas-island",
      name: "Yas Island",
      parent: "Abu Dhabi",
      summary: null,
      image: null,
      listings: 3,
    };

    /** A lookup that knows `area`, knows GONE is gone, and could not ask about DEV. */
    const lookup: InternalLinkLookup = {
      get(ref) {
        if (ref.id === AREA) return area;
        if (ref.id === GONE) return null;
        return undefined;
      },
    };

    function drawWith(html: string) {
      const renderBlock = vi.fn(
        (link: ResolvedInternalLink, variant: string) => (
          <aside data-testid="card" data-variant={variant}>
            {link.name}
          </aside>
        ),
      );
      const view = render(
        <div>{renderArticleBody(html, { lookup, renderBlock })}</div>,
      );
      return { ...view, renderBlock };
    }

    it("hands a resolved block to the page's card, with its variant", () => {
      const { container, renderBlock } = drawWith(
        `<p>a</p><div data-internal-link="area" data-id="${AREA}" data-variant="compact"></div><p>b</p>`,
      );
      expect(renderBlock).toHaveBeenCalledTimes(1);
      expect(renderBlock.mock.calls[0][0]).toBe(area);
      const card = screen.getByTestId("card");
      expect(card.textContent).toBe("Yas Island");
      expect(card.getAttribute("data-variant")).toBe("compact");
      // The stored element itself is gone — only the card is drawn.
      expect(container.querySelector("[data-internal-link]")).toBeNull();
    });

    it("draws nothing for a record that is gone, or could not be looked up", () => {
      const { container, renderBlock } = drawWith(
        `<p>a</p><div data-internal-link="area" data-id="${GONE}"></div><div data-internal-link="development" data-id="${DEV}"></div><p>b</p>`,
      );
      expect(renderBlock).not.toHaveBeenCalled();
      const drawn = [...container.firstElementChild!.children].map((e) => e.tagName);
      expect(drawn).toEqual(["P", "P"]);
      expect(container.textContent).toBe("ab");
    });

    it("draws nothing for a block when the caller passes no links", () => {
      const { container } = draw(
        `<p>a</p><div data-internal-link="area" data-id="${AREA}"></div>`,
      );
      const drawn = [...container.firstElementChild!.children].map((e) => e.tagName);
      expect(drawn).toEqual(["P"]);
    });

    it("points a text link at the record's href today, not the stored one", () => {
      const { container } = drawWith(
        `<p>See <a href="/areas/old-slug" data-link-kind="area" data-link-id="${AREA}">Yas</a>.</p>`,
      );
      const a = container.querySelector("a");
      expect(a?.getAttribute("href")).toBe("/areas/yas-island");
      expect(a?.textContent).toBe("Yas");
    });

    it("keeps the words and drops the link when the record is gone", () => {
      const { container } = drawWith(
        `<p>See <a href="/p/x" data-link-kind="property" data-link-id="${GONE}"><strong>this villa</strong></a>.</p>`,
      );
      expect(container.querySelector("a")).toBeNull();
      expect(container.querySelector("p strong")?.textContent).toBe("this villa");
      expect(container.textContent).toBe("See this villa.");
    });

    it("falls back to the stored href when the lookup could not run", () => {
      const { container } = drawWith(
        `<p><a href="/developments/lagoons" data-link-kind="development" data-link-id="${DEV}">Lagoons</a></p>`,
      );
      expect(container.querySelector("a")?.getAttribute("href")).toBe(
        "/developments/lagoons",
      );
    });

    it("keeps a reader in their locale on a plain site link, in the same tab", () => {
      const { container } = draw(
        '<p><a href="/areas/yas-island" target="_blank" rel="noopener noreferrer">Yas</a></p>',
      );
      const a = container.querySelector("a");
      expect(a?.getAttribute("href")).toBe("/areas/yas-island");
      expect(a?.getAttribute("target")).toBeNull();
    });

    it("leaves a link to another site exactly as authored", () => {
      const { container } = draw(
        '<p><a href="https://dari.ae/x" target="_blank" rel="noopener noreferrer">DARI</a></p>',
      );
      const a = container.querySelector("a");
      expect(a?.getAttribute("href")).toBe("https://dari.ae/x");
      expect(a?.getAttribute("target")).toBe("_blank");
      expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("treats a protocol-relative URL as another site", () => {
      const { container } = draw('<p><a href="//evil.example/x">x</a></p>');
      expect(container.querySelector("a")?.getAttribute("href")).toBe(
        "//evil.example/x",
      );
    });

    it("lists each linked record once, blocks and text links together", () => {
      const refs = articleBodyLinkRefs(
        `<div data-internal-link="area" data-id="${AREA}"></div>` +
          `<p><a href="/areas/yas-island" data-link-kind="area" data-link-id="${AREA.toUpperCase()}">Yas</a></p>` +
          `<div data-internal-link="development" data-id="${DEV}" data-variant="compact"></div>` +
          `<div data-internal-link="agent" data-id="${DEV}"></div>` +
          `<p><a href="/x" data-link-kind="property" data-link-id="nope">x</a></p>`,
      );
      expect(refs).toEqual([
        { kind: "area", id: AREA },
        { kind: "development", id: DEV },
      ]);
    });
  });
});
