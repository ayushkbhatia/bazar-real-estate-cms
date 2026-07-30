import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `requestOrigin` reads next/headers, so each case stubs that module and
 * re-imports. The behaviour under test is the priority order: the live request
 * wins over configuration, because configuration is what produced localhost
 * links in invitation emails.
 */
const headersMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

function headerBag(values: Record<string, string>) {
  return {
    get: (name: string) => values[name.toLowerCase()] ?? null,
  };
}

async function load() {
  vi.resetModules();
  return import("./site-url");
}

beforeEach(() => {
  headersMock.mockReset();
});

describe("requestOrigin", () => {
  it("uses the forwarded host Vercel sets", async () => {
    headersMock.mockResolvedValue(
      headerBag({
        "x-forwarded-host": "bazar.ae",
        "x-forwarded-proto": "https",
        host: "internal-host",
      }),
    );
    const { requestOrigin } = await load();
    expect(await requestOrigin()).toBe("https://bazar.ae");
  });

  it("falls back to the plain host header", async () => {
    headersMock.mockResolvedValue(headerBag({ host: "preview.vercel.app" }));
    const { requestOrigin } = await load();
    expect(await requestOrigin()).toBe("https://preview.vercel.app");
  });

  it("uses http for localhost, where nothing serves TLS", async () => {
    headersMock.mockResolvedValue(headerBag({ host: "localhost:3000" }));
    const { requestOrigin } = await load();
    expect(await requestOrigin()).toBe("http://localhost:3000");
  });

  it("respects an explicit forwarded protocol", async () => {
    headersMock.mockResolvedValue(
      headerBag({ host: "example.com", "x-forwarded-proto": "http" }),
    );
    const { requestOrigin } = await load();
    expect(await requestOrigin()).toBe("http://example.com");
  });

  it("falls back to configuration outside a request scope", async () => {
    // Cron jobs and scripts have no request; the call must not throw.
    headersMock.mockImplementation(() => {
      throw new Error("headers() called outside a request");
    });
    const { requestOrigin } = await load();
    expect(await requestOrigin()).toMatch(/^https?:\/\/.+/);
  });

  it("never returns a trailing slash", async () => {
    headersMock.mockResolvedValue(headerBag({ host: "bazar.ae" }));
    const { requestOrigin } = await load();
    expect(await requestOrigin()).not.toMatch(/\/$/);
  });
});

describe("absoluteUrl", () => {
  it("joins a rooted path", async () => {
    headersMock.mockResolvedValue(headerBag({ host: "bazar.ae" }));
    const { absoluteUrl } = await load();
    expect(await absoluteUrl("/staff-invite?token=abc")).toBe(
      "https://bazar.ae/staff-invite?token=abc",
    );
  });

  it("adds the missing slash rather than concatenating", async () => {
    headersMock.mockResolvedValue(headerBag({ host: "bazar.ae" }));
    const { absoluteUrl } = await load();
    expect(await absoluteUrl("staff-invite")).toBe(
      "https://bazar.ae/staff-invite",
    );
  });
});
