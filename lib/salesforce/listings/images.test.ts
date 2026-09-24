/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: {}, isSalesforceConfigured: false, isSupabaseConfigured: false }));

const { fetchWebImage, isForbiddenHost, sniffImage } = await import("./images");

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("sniffImage", () => {
  it("knows the five formats the media library accepts, from the bytes", () => {
    expect(sniffImage(JPEG)).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(sniffImage(PNG)).toEqual({ mime: "image/png", ext: "png" });
    expect(sniffImage(ascii("GIF89a......"))).toEqual({ mime: "image/gif", ext: "gif" });
    expect(sniffImage(ascii("RIFF\0\0\0\0WEBPVP8 "))).toEqual({ mime: "image/webp", ext: "webp" });
    expect(sniffImage(ascii("\0\0\0\x1cftypavif\0\0"))).toEqual({ mime: "image/avif", ext: "avif" });
  });

  it("refuses what is not one of them, whatever the server called it", () => {
    // Salesforce answers `application/octetstream` for a JPEG, and a login
    // page answers 200 with HTML. The bytes decide.
    expect(sniffImage(ascii("<!DOCTYPE html><html>"))).toBeNull();
    expect(sniffImage(ascii("\0\0\0\x18ftypheic\0\0"))).toBeNull();
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("isForbiddenHost", () => {
  it("blocks loopback, link-local, private ranges and bare IPv6", () => {
    for (const h of ["localhost", "127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "100.64.0.1", "[::1]", "db.internal"]) {
      expect(isForbiddenHost(h), h).toBe(true);
    }
  });

  it("allows ordinary hosts", () => {
    for (const h of ["images.unsplash.com", "res.cloudinary.com", "8.8.8.8", "172.32.0.1"]) {
      expect(isForbiddenHost(h), h).toBe(false);
    }
  });
});

function response(status: number, body: Uint8Array | null, headers: Record<string, string> = {}): Response {
  // Node's own fetch types, not the DOM's: the code under test runs on the
  // server, and jsdom's Response does not stream a byte body the same way.
  return new Response(body as unknown as BodyInit | null, { status, headers });
}

describe("fetchWebImage", () => {
  it("downloads and identifies an image", async () => {
    const fetchImpl = vi.fn(async () => response(200, JPEG, { "content-type": "application/octet-stream" }));
    const got = await fetchWebImage("https://images.test/a.jpg", fetchImpl as unknown as typeof fetch);
    expect(got).toMatchObject({ ok: true, sniffed: { mime: "image/jpeg" } });
  });

  it("refuses http, credentials and private addresses without fetching", async () => {
    const fetchImpl = vi.fn();
    for (const url of ["http://images.test/a.jpg", "https://u:p@images.test/a.jpg", "https://169.254.169.254/latest/meta-data"]) {
      const got = await fetchWebImage(url, fetchImpl as unknown as typeof fetch);
      expect(got).toMatchObject({ ok: false, permanent: true });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("checks every redirect hop, not just the first", async () => {
    const fetchImpl = vi.fn(async () =>
      response(302, null, { location: "https://127.0.0.1/admin" }),
    );
    const got = await fetchWebImage("https://images.test/a.jpg", fetchImpl as unknown as typeof fetch);
    expect(got).toEqual({ ok: false, permanent: true, reason: "private or local address" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives up on a 404 for a day, retries a 503 next run", async () => {
    const notFound = await fetchWebImage(
      "https://example.com/properties/property-3-main.jpg",
      (async () => response(404, null)) as unknown as typeof fetch,
    );
    expect(notFound).toEqual({ ok: false, permanent: true, reason: "HTTP 404" });
    const down = await fetchWebImage(
      "https://images.test/a.jpg",
      (async () => response(503, null)) as unknown as typeof fetch,
    );
    expect(down).toEqual({ ok: false, permanent: false, reason: "HTTP 503" });
  });

  it("refuses a file over the bucket's limit by its declared size", async () => {
    const got = await fetchWebImage(
      "https://images.test/huge.jpg",
      (async () => response(200, JPEG, { "content-length": String(30 * 1024 * 1024) })) as unknown as typeof fetch,
    );
    expect(got).toEqual({ ok: false, permanent: true, reason: "larger than 25 MB" });
  });

  it("refuses a page that is not an image", async () => {
    const got = await fetchWebImage(
      "https://images.test/a.jpg",
      (async () => response(200, ascii("<html>login</html>"))) as unknown as typeof fetch,
    );
    expect(got).toMatchObject({ ok: false, permanent: true });
  });
});
