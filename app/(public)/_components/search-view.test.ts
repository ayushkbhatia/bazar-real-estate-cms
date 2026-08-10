import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `resolveSearchView` reads the request's user agent, so the whole suite
 * runs against a mocked `next/headers`. The parsing itself is Next's
 * `userAgent()` — we feed it real UA strings rather than stubbing the
 * classification, because "which devices count as a phone" is the part
 * of this that can actually be wrong.
 */
const ua = vi.fn<() => string>(() => "");

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": ua() }),
}));

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/604.1";
const MAC_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function resolve(agent: string, raw: Record<string, string> = {}) {
  ua.mockReturnValue(agent);
  const { resolveSearchView } = await import("./search-view");
  return resolveSearchView(raw);
}

beforeEach(() => {
  vi.resetModules();
});

describe("resolveSearchView", () => {
  it("defaults a phone to list", async () => {
    for (const agent of [IPHONE, ANDROID_PHONE]) {
      expect(await resolve(agent)).toEqual({
        view: "list",
        defaultView: "list",
      });
    }
  });

  it("defaults desktop and tablet to grid", async () => {
    // A tablet is ≥768px, where the two-column grid is the right layout —
    // only handsets get the list.
    for (const agent of [MAC_DESKTOP, IPAD]) {
      expect(await resolve(agent)).toEqual({
        view: "grid",
        defaultView: "grid",
      });
    }
  });

  it("defaults to grid when there is no user-agent header", async () => {
    expect(await resolve("")).toEqual({ view: "grid", defaultView: "grid" });
  });

  it("lets an explicit view param win on every device", async () => {
    // A link shared from a phone keeps its view on a desktop, and vice versa.
    expect(await resolve(IPHONE, { view: "grid" })).toEqual({
      view: "grid",
      defaultView: "list",
    });
    expect(await resolve(MAC_DESKTOP, { view: "list" })).toEqual({
      view: "list",
      defaultView: "grid",
    });
    expect(await resolve(IPHONE, { view: "map" })).toEqual({
      view: "map",
      defaultView: "list",
    });
  });

  it("falls back to the device default when the param is junk", async () => {
    expect(await resolve(IPHONE, { view: "gallery" })).toEqual({
      view: "list",
      defaultView: "list",
    });
    expect(await resolve(MAC_DESKTOP, { view: "" })).toEqual({
      view: "grid",
      defaultView: "grid",
    });
  });
});
