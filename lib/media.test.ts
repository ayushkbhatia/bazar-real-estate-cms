import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const TEST_URL = "https://test.supabase.example";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", TEST_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

import { safeFilename, storageKey } from "./media";

describe("mediaPublicUrl", () => {
  it("builds a URL under the public storage path", async () => {
    vi.resetModules();
    const { mediaPublicUrl } = await import("./media");
    const url = mediaPublicUrl("listings/abcd-foo.jpg");
    expect(url).toBe(
      `${TEST_URL}/storage/v1/object/public/media/listings/abcd-foo.jpg`,
    );
  });
});

describe("safeFilename", () => {
  it("lowercases and replaces unsafe characters", () => {
    expect(safeFilename("Mamsha · 3-Bed (final).JPG")).toBe(
      "mamsha-3-bed-final.jpg",
    );
  });

  it("preserves dots only as the extension separator", () => {
    expect(safeFilename("hero.image.v2.png")).toBe("hero-image-v2.png");
  });

  it("returns a sensible default when stem is empty", () => {
    expect(safeFilename(".jpg")).toBe("file.jpg");
  });

  it("truncates very long stems", () => {
    const long = "a".repeat(200) + ".jpg";
    expect(safeFilename(long).length).toBeLessThanOrEqual(70);
  });

  it("handles files with no extension", () => {
    expect(safeFilename("README")).toBe("readme");
  });
});

describe("storageKey", () => {
  it("composes folder/uuid-safeFilename", () => {
    expect(
      storageKey({
        folder: "listings",
        filename: "Hero #1.png",
        uuid: "abc123",
      }),
    ).toBe("listings/abc123-hero-1.png");
  });

  it("supports every folder enum", () => {
    const folders = ["listings", "brand", "blog", "team", "documents"] as const;
    for (const f of folders) {
      expect(
        storageKey({ folder: f, filename: "x.jpg", uuid: "u" }),
      ).toBe(`${f}/u-x.jpg`);
    }
  });
});
