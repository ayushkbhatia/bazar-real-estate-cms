import { describe, expect, it } from "vitest";
import {
  blockSchema,
  defaultBlockFor,
  pageCreateSchema,
  pageEditSchema,
  parseBlocks,
} from "./page";

describe("blockSchema", () => {
  it("accepts a valid hero block", () => {
    expect(
      blockSchema.safeParse({
        type: "hero",
        title: "Welcome",
        subtitle: "An intro",
        image: null,
        cta: { label: "Browse", href: "/buy" },
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown block type", () => {
    expect(
      blockSchema.safeParse({ type: "carousel", title: "X" }).success,
    ).toBe(false);
  });

  it("rejects a grid with no items", () => {
    expect(
      blockSchema.safeParse({ type: "grid", heading: "X", items: [] }).success,
    ).toBe(false);
  });

  it("accepts a strip with align=center", () => {
    expect(
      blockSchema.safeParse({
        type: "strip",
        heading: "Why us",
        body: "Some copy.",
        align: "center",
      }).success,
    ).toBe(true);
  });
});

describe("defaultBlockFor", () => {
  it("returns valid defaults for every block kind", () => {
    for (const kind of ["hero", "strip", "split", "grid", "banner"] as const) {
      const block = defaultBlockFor(kind);
      const res = blockSchema.safeParse(block);
      expect(res.success, `default ${kind} should parse`).toBe(true);
    }
  });
});

describe("parseBlocks", () => {
  it("returns [] for non-arrays", () => {
    expect(parseBlocks(null)).toEqual([]);
    expect(parseBlocks({})).toEqual([]);
    expect(parseBlocks("string")).toEqual([]);
  });

  it("drops malformed entries and keeps valid ones", () => {
    const raw = [
      { type: "hero", title: "Good" },
      { type: "carousel", title: "Bad" },
      { type: "banner", title: "Also good" },
    ];
    const result = parseBlocks(raw);
    expect(result.map((b) => b.type)).toEqual(["hero", "banner"]);
  });
});

describe("pageCreateSchema", () => {
  it("accepts a clean slug", () => {
    expect(
      pageCreateSchema.safeParse({ title: "About Bazar", slug: "about" })
        .success,
    ).toBe(true);
  });

  it("allows path-style slugs like services/buy", () => {
    expect(
      pageCreateSchema.safeParse({
        title: "Buying services",
        slug: "services/buy",
      }).success,
    ).toBe(true);
  });

  it("rejects slugs with capitals or whitespace", () => {
    expect(
      pageCreateSchema.safeParse({ title: "About", slug: "About-Us" }).success,
    ).toBe(false);
    expect(
      pageCreateSchema.safeParse({ title: "About", slug: "about us" }).success,
    ).toBe(false);
  });
});

describe("pageEditSchema", () => {
  it("rejects unknown enum-y values gracefully", () => {
    expect(
      pageEditSchema.safeParse({
        title: "About",
        slug: "about",
        meta_title: null,
        meta_description: null,
      }).success,
    ).toBe(true);
  });
});
