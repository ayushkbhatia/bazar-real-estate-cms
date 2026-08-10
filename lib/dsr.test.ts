import { describe, expect, it } from "vitest";
import {
  approxJsonByteSize,
  buildDataExport,
  DSR_TOKEN_TTL_MS,
  exportFilename,
  generateDsrToken,
  isTokenExpired,
} from "./dsr";

describe("generateDsrToken", () => {
  it("produces a 64-char hex token", () => {
    const t = generateDsrToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces unique tokens on successive calls", () => {
    expect(generateDsrToken()).not.toBe(generateDsrToken());
  });
});

describe("isTokenExpired", () => {
  it("returns false within the TTL", () => {
    const created = new Date("2026-05-22T08:00:00Z");
    const now = new Date(created.getTime() + DSR_TOKEN_TTL_MS - 60_000);
    expect(isTokenExpired(created, now)).toBe(false);
  });

  it("returns true once past the TTL", () => {
    const created = new Date("2026-05-22T08:00:00Z");
    const now = new Date(created.getTime() + DSR_TOKEN_TTL_MS + 60_000);
    expect(isTokenExpired(created, now)).toBe(true);
  });
});

describe("buildDataExport", () => {
  const fixedNow = () => new Date("2026-05-22T08:00:00.000Z");

  it("populates default empty arrays when no items are supplied", () => {
    const archive = buildDataExport({ account: null, now: fixedNow });
    expect(archive.generated_at).toBe("2026-05-22T08:00:00.000Z");
    expect(archive.saved_properties).toEqual([]);
    expect(archive.saved_searches).toEqual([]);
    expect(archive.enquiries).toEqual([]);
    expect(archive.messages).toEqual([]);
    expect(archive.newsletter_subscription).toBeNull();
    expect(archive.account).toBeNull();
    expect(archive.notes.length).toBeGreaterThan(0);
  });

  it("preserves supplied account + collection rows", () => {
    const archive = buildDataExport({
      account: { user_id: "u1", first_name: "Hessa" },
      saved_properties: [{ property_id: "p1" }],
      enquiries: [{ id: "e1", brief_raw: "Hi" }],
      newsletter_subscription: { email: "h@x.com", status: "confirmed" },
      now: fixedNow,
    });
    expect(archive.account?.first_name).toBe("Hessa");
    expect(archive.saved_properties).toHaveLength(1);
    expect(archive.enquiries[0]?.id).toBe("e1");
    expect(archive.newsletter_subscription?.email).toBe("h@x.com");
  });

  it("includes a PDPL-aware note about excluded KYC + audit data", () => {
    const archive = buildDataExport({ account: null });
    expect(archive.notes.some((n) => /KYC/i.test(n))).toBe(true);
    expect(archive.notes.some((n) => /Audit-log/i.test(n))).toBe(true);
  });

  it("explains how the messages thread is scoped + how to filter to own-only", () => {
    const archive = buildDataExport({ account: null });
    expect(archive.notes.some((n) => /author_kind/.test(n))).toBe(true);
    expect(archive.notes.some((n) => /'user'/.test(n))).toBe(true);
  });
});

describe("exportFilename", () => {
  it("uses ISO date in the filename", () => {
    expect(exportFilename(new Date("2026-12-31T23:59:59Z"))).toBe(
      "bazar-data-export-2026-12-31.json",
    );
  });
});

describe("approxJsonByteSize", () => {
  it("returns the UTF-8 byte length of the JSON-encoded value", () => {
    expect(approxJsonByteSize({})).toBe(2); // "{}"
    expect(approxJsonByteSize([1, 2, 3])).toBe("[1,2,3]".length);
    // unicode → > char count
    expect(approxJsonByteSize({ name: "Mariam — أبو ظبي" })).toBeGreaterThan(
      JSON.stringify({ name: "Mariam — أبو ظبي" }).length / 2,
    );
  });
});
