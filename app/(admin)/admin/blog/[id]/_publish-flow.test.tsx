// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArticleEditForm } from "./_form";
import { ArticlePublishCard } from "./_publish-card";
import { publishArticle, updateArticle } from "./_actions";
import type { ArticleEditInput } from "@/lib/schemas/article";

const calls: string[] = [];

vi.mock("./_actions", () => ({
  updateArticle: vi.fn(async () => {
    calls.push("update");
    return { status: "ok" as const };
  }),
  publishArticle: vi.fn(async () => {
    calls.push("publish");
    return { status: "ok" as const, message: "Published." };
  }),
  unpublishArticle: vi.fn(),
  archiveArticle: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../../media/_upload-client", () => ({ uploadToLibrary: vi.fn() }));
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

const CATEGORIES = [
  { code: "field_note", label: "Field note", position: 0 },
] as never;

/**
 * Publishing used to call the server action straight from the sidebar, which
 * reads the article back from the database. Everything typed since the last
 * save was therefore invisible to it, and a newly created article — inserted
 * with an empty body — was reported as "Body is empty" no matter what the
 * author had written. The two controls live in sibling components, so the
 * ordering below is the contract holding them together.
 */
function renderScreen(status: "draft" | "published" = "draft") {
  return render(
    <>
      <ArticleEditForm
        articleId="a1"
        initial={INITIAL}
        categories={CATEGORIES}
        media={[]}
      />
      <ArticlePublishCard
        articleId="a1"
        status={status}
        updatedAt={new Date(0).toISOString()}
        publishedAt={null}
        authorName={null}
        publicHref="/insights/a-post"
      />
    </>,
  );
}

describe("publishing an article", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
  });

  it("saves the open form before publishing", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: /publish/i }));

    expect(calls).toEqual(["update", "publish"]);
  });

  it("does not publish when the save fails", async () => {
    vi.mocked(updateArticle).mockResolvedValueOnce({
      status: "error",
      message: "Slug already in use — pick a different one.",
    });
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: /publish/i }));

    // Publishing on top of a rejected save would put a half-saved article
    // live under whatever the database still held.
    expect(publishArticle).not.toHaveBeenCalled();
  });

  it("still saves without publishing when Save draft is used", async () => {
    renderScreen();
    // Two of them — the form's own footer and the sidebar's, both submitting
    // the same form. Either must save and stop there.
    const [saveDraft] = screen.getAllByRole("button", { name: /save draft/i });
    await userEvent.click(saveDraft);

    expect(calls).toEqual(["update"]);
  });

  it("offers no publish button once the article is published", () => {
    renderScreen("published");
    expect(
      screen.queryByRole("button", { name: /^publish$/i }),
    ).not.toBeInTheDocument();
  });
});
