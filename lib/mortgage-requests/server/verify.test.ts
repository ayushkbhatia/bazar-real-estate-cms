/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { MB } from "../documents";
import { buildPdf, jpegBytes, pngBytes } from "../testing/fixtures";
import { inspectPdf, sha256Hex, sniffMime, verifyUpload } from "./verify";

describe("sniffing the real type", () => {
  it("reads PDF, JPEG and PNG from their first bytes, whatever the file claims", () => {
    expect(sniffMime(buildPdf())).toBe("application/pdf");
    expect(sniffMime(jpegBytes())).toBe("image/jpeg");
    expect(sniffMime(pngBytes())).toBe("image/png");
  });

  it("finds a PDF header within the first 1024 bytes, as readers do", () => {
    const pdf = buildPdf();
    const withJunk = new Uint8Array(pdf.length + 100);
    withJunk.set(pdf, 100);
    expect(sniffMime(withJunk)).toBe("application/pdf");
  });

  it("knows nothing of other types", () => {
    expect(sniffMime(new TextEncoder().encode("GIF89a…"))).toBeNull();
    expect(sniffMime(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffMime(new Uint8Array())).toBeNull();
  });
});

describe("inspecting PDFs", () => {
  it("counts pages", async () => {
    expect(await inspectPdf(buildPdf({ pages: 3 }))).toEqual({ ok: true, pageCount: 3 });
  });

  it("refuses a PDF that needs a password to open, as UAE e-statements often do", async () => {
    expect(await inspectPdf(buildPdf({ userPassword: "14031990", ownerPassword: "bank" }))).toEqual({
      ok: false,
      reason: "encrypted_pdf",
    });
  });

  it("accepts a PDF that is only restricted by an owner password, which opens for anyone", async () => {
    expect(await inspectPdf(buildPdf({ pages: 2, ownerPassword: "hr-department" }))).toEqual({
      ok: true,
      pageCount: 2,
    });
  });

  it("calls a broken PDF unreadable", async () => {
    const broken = new TextEncoder().encode("%PDF-1.4\nthis is not really a pdf\n%%EOF");
    expect(await inspectPdf(broken)).toEqual({ ok: false, reason: "unreadable" });
  });

  it("leaves the caller's bytes intact", async () => {
    const pdf = buildPdf();
    const before = sha256Hex(pdf);
    await inspectPdf(pdf);
    expect(pdf.byteLength).toBeGreaterThan(0);
    expect(sha256Hex(pdf)).toBe(before);
  });
});

describe("verifyUpload", () => {
  it("accepts a clean PDF salary certificate, with its page count and hash", async () => {
    const pdf = buildPdf();
    const result = await verifyUpload("salary_certificate", pdf);
    expect(result).toMatchObject({ ok: true, mime: "application/pdf", pageCount: 1, sizeBytes: pdf.length });
    expect(result.ok && result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses an image where the kind is PDF only, whatever its name said", async () => {
    expect(await verifyUpload("salary_certificate", jpegBytes())).toEqual({ ok: false, code: "bad_type" });
    expect(await verifyUpload("bank_statements_12m", pngBytes())).toEqual({ ok: false, code: "bad_type" });
  });

  it("takes an Emirates ID photo, with no page count", async () => {
    expect(await verifyUpload("emirates_id", jpegBytes(MB))).toMatchObject({ ok: true, mime: "image/jpeg", pageCount: null });
  });

  it("refuses a password-protected statement", async () => {
    expect(await verifyUpload("bank_statements_3m", buildPdf({ userPassword: "secret" }))).toEqual({
      ok: false,
      code: "encrypted_pdf",
    });
  });
});
