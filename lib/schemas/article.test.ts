import { describe, expect, it } from "vitest";
import {
  articleCreateSchema,
  articleCategoryCreateSchema,
  articleEditSchema,
  categoryToUrlSlug,
  deriveExcerpt,
  formatCategoryLabel,
  normaliseArticleEditInput,
  readingMinutes,
  stripHtml,
} from "./article";

describe("articleCreateSchema", () => {
  it("accepts a minimal valid payload", () => {
    const res = articleCreateSchema.safeParse({
      title: "Saadiyat Q1 review",
      category: "market_report",
    });
    expect(res.success).toBe(true);
  });

  it("rejects too-short titles", () => {
    const res = articleCreateSchema.safeParse({
      title: "X",
      category: "field_note",
    });
    expect(res.success).toBe(false);
  });

  it("accepts a new (dynamic) category slug", () => {
    // Categories are runtime-editable, so any well-formed slug is valid at
    // the schema layer — the DB FK enforces existence.
    const res = articleCreateSchema.safeParse({
      title: "Some article",
      category: "investor_briefing",
    });
    expect(res.success).toBe(true);
  });

  it("rejects malformed category slugs", () => {
    for (const bad of ["Has Spaces", "MixedCase", ""]) {
      expect(
        articleCreateSchema.safeParse({ title: "Some article", category: bad })
          .success,
      ).toBe(false);
    }
  });
});

describe("articleCategoryCreateSchema", () => {
  it("accepts a label with an optional slug", () => {
    expect(
      articleCategoryCreateSchema.safeParse({ label: "Investor briefing" })
        .success,
    ).toBe(true);
    expect(
      articleCategoryCreateSchema.safeParse({
        label: "Investor briefing",
        slug: "investor_briefing",
      }).success,
    ).toBe(true);
  });

  it("rejects too-short labels and malformed slugs", () => {
    expect(articleCategoryCreateSchema.safeParse({ label: "X" }).success).toBe(
      false,
    );
    expect(
      articleCategoryCreateSchema.safeParse({
        label: "Fine name",
        slug: "Bad Slug",
      }).success,
    ).toBe(false);
  });
});

describe("formatCategoryLabel", () => {
  it("prefers a supplied label map, then seed labels", () => {
    expect(formatCategoryLabel("market_report")).toBe("Market report");
    expect(
      formatCategoryLabel("market_report", { market_report: "Custom" }),
    ).toBe("Custom");
  });

  it("title-cases an unknown slug so it never renders undefined", () => {
    expect(formatCategoryLabel("investor_briefing")).toBe("Investor briefing");
    expect(formatCategoryLabel("off-plan-watch-2")).toBe("Off plan watch 2");
  });
});

describe("categoryToUrlSlug", () => {
  it("hyphenates underscored slugs", () => {
    expect(categoryToUrlSlug("off_plan_watch")).toBe("off-plan-watch");
    expect(categoryToUrlSlug("luxury")).toBe("luxury");
  });
});

describe("articleEditSchema", () => {
  const base = {
    title: "Saadiyat closed Q1 up 8.4%",
    slug: "saadiyat-q1-2026",
    excerpt: null,
    category: "market_report" as const,
    body_html: "<p>Hello.</p>",
    hero_image_id: null,
    meta_title: null,
    meta_description: null,
  };

  it("accepts a complete edit payload", () => {
    expect(articleEditSchema.safeParse(base).success).toBe(true);
  });

  it("rejects slugs with capitals or spaces", () => {
    expect(
      articleEditSchema.safeParse({ ...base, slug: "Has Spaces" }).success,
    ).toBe(false);
    expect(
      articleEditSchema.safeParse({ ...base, slug: "MixedCase" }).success,
    ).toBe(false);
  });

  it("coerces empty hero_image_id to null", () => {
    const res = articleEditSchema.safeParse({ ...base, hero_image_id: "" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.hero_image_id).toBeNull();
  });

  it("rejects malformed hero_image_id UUIDs", () => {
    const res = articleEditSchema.safeParse({
      ...base,
      hero_image_id: "not-a-uuid",
    });
    expect(res.success).toBe(false);
  });
});

describe("stripHtml", () => {
  it("removes tags and decodes entities", () => {
    const html = "<p>Hello &amp; welcome.</p><script>alert(1)</script>";
    expect(stripHtml(html)).toBe("Hello & welcome.");
  });

  it("inserts a space at tag boundaries so adjacent words don't mash", () => {
    expect(stripHtml("<p>foo</p>\n\n<p>bar</p>")).toBe("foo bar");
  });

  it("strips inline tags like <strong> but preserves the surrounding text", () => {
    expect(stripHtml("Hello <strong>brave</strong> world")).toContain(
      "brave",
    );
  });
});

describe("readingMinutes", () => {
  it("returns at least 1 minute even for empty bodies", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("<p></p>")).toBe(1);
  });

  it("rounds to the nearest minute at ~200 wpm", () => {
    const words = Array.from({ length: 400 }, () => "word").join(" ");
    expect(readingMinutes(`<p>${words}</p>`)).toBe(2);
  });
});

describe("deriveExcerpt", () => {
  it("prefers an explicit excerpt", () => {
    expect(deriveExcerpt("Manual.", "<p>Body.</p>")).toBe("Manual.");
  });

  it("derives from body when excerpt is missing", () => {
    const text =
      "We tracked sixty-seven closes on Saadiyat this quarter — here's what mattered.";
    expect(deriveExcerpt(null, `<p>${text}</p>`)).toBe(text);
  });

  it("truncates long body excerpts at a word boundary with an ellipsis", () => {
    const long = Array.from({ length: 80 }, () => "word").join(" ");
    const result = deriveExcerpt(null, `<p>${long}</p>`, 80) ?? "";
    expect(result.length).toBeLessThanOrEqual(81);
    expect(result.endsWith("…")).toBe(true);
  });

  it("returns null on a fully empty body", () => {
    expect(deriveExcerpt(null, "")).toBeNull();
  });
});

describe("normaliseArticleEditInput", () => {
  it("coerces empty strings to null on nullable fields", () => {
    const out = normaliseArticleEditInput({
      title: "t",
      slug: "t",
      category: "field_note",
      body_html: "<p>x</p>",
      excerpt: "",
      hero_image_id: "",
      meta_title: "",
      meta_description: "",
    });
    expect(out.excerpt).toBeNull();
    expect(out.hero_image_id).toBeNull();
    expect(out.meta_title).toBeNull();
    expect(out.meta_description).toBeNull();
  });

  it("trims title / slug / excerpt", () => {
    const out = normaliseArticleEditInput({
      title: "  Hello  ",
      slug: "  hello  ",
      excerpt: "  An intro.  ",
      category: "field_note",
      body_html: "",
    });
    expect(out.title).toBe("Hello");
    expect(out.slug).toBe("hello");
    expect(out.excerpt).toBe("An intro.");
  });

  it("forces body_html to a string default", () => {
    const out = normaliseArticleEditInput({
      title: "t",
      slug: "t",
      category: "field_note",
    });
    expect(out.body_html).toBe("");
  });
});
