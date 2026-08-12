// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArticleEditForm } from "./_form";
import type { ArticleEditInput } from "@/lib/schemas/article";

vi.mock("./_actions", () => ({
  updateArticle: vi.fn(async () => ({ status: "ok" as const, slug: "x" })),
  publishArticle: vi.fn(),
}));
// The form refreshes the route after publishing, so it needs a router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// The picker uploads through the shared direct-to-Storage helper.
vi.mock("../../media/_upload-client", () => ({
  uploadToLibrary: vi.fn(async () => ({
    status: "ok" as const,
    id: "new",
    storage_key: "k",
    filename: "f.jpg",
    url: "/u",
    mime: "image/jpeg",
  })),
}));
// TipTap needs a real editor surface; the body editor is not what is under
// test here, so it is stubbed to a plain textarea.
vi.mock("../_article-editor", () => ({
  ArticleEditor: () => <textarea aria-label="Body" />,
}));

const INITIAL: ArticleEditInput = {
  title: "A post",
  slug: "a-post",
  excerpt: null,
  category: "field_note",
  body_html: "<p>hi</p>",
  hero_image_id: null,
  meta_title: null,
  meta_description: null,
};

const MEDIA = [
  { id: "img-1", filename: "skyline.jpg", url: "/skyline.jpg", mime: "image/jpeg" },
  { id: "img-2", filename: "tower.jpg", url: "/tower.jpg", mime: "image/jpeg" },
];

const CATEGORIES = [
  { code: "field_note", label: "Field note", position: 0 },
] as never;

/**
 * The article already had a hero_image_id column, a zod field, a query select
 * and a public renderer with a placeholder fallback — everything except a
 * control in the editor. So the regression to guard against is narrow and
 * specific: the picker disappearing from the form again.
 */
describe("ArticleEditForm cover image", () => {
  it("offers a cover picker", () => {
    render(
      <ArticleEditForm
        articleId="a1"
        initial={INITIAL}
        categories={CATEGORIES}
        media={MEDIA}
      />,
    );
    expect(screen.getByText(/cover image/i)).toBeInTheDocument();
  });

  it("lists the library's images as options", () => {
    render(
      <ArticleEditForm
        articleId="a1"
        initial={INITIAL}
        categories={CATEGORIES}
        media={MEDIA}
      />,
    );
    expect(
      screen.getByRole("option", { name: /skyline\.jpg/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /tower\.jpg/i }),
    ).toBeInTheDocument();
  });

  it("preselects the article's existing cover", () => {
    render(
      <ArticleEditForm
        articleId="a1"
        initial={{ ...INITIAL, hero_image_id: "img-2" }}
        categories={CATEGORIES}
        media={MEDIA}
      />,
    );
    // The category control is also a combobox, so pick the one carrying the
    // picker's own empty option rather than assuming an order.
    // The category control is a Radix combobox (a button, not a <select>), so
    // narrow to real selects before reading .options.
    const select = screen
      .getAllByRole("combobox")
      .filter((el): el is HTMLSelectElement => el instanceof HTMLSelectElement)
      .find((el) =>
        Array.from(el.options).some((o) =>
          /placeholder art/i.test(o.textContent ?? ""),
        ),
      );
    expect(select, "cover picker select not found").toBeDefined();
    expect(select!.value).toBe("img-2");
  });

  it("renders with no cover set, rather than erroring", () => {
    // The common case for every article written before this control existed.
    render(
      <ArticleEditForm
        articleId="a1"
        initial={INITIAL}
        categories={CATEGORIES}
        media={MEDIA}
      />,
    );
    expect(screen.getByText(/cover image/i)).toBeInTheDocument();
  });
});
