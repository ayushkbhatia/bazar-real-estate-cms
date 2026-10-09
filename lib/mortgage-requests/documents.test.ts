import { describe, expect, it } from "vitest";
import {
  DOC_KINDS,
  DOCUMENT_RULES,
  DOCUMENT_SETS,
  MAX_FILE_BYTES,
  MB,
  acceptAttribute,
  checkBatch,
  checkFile,
  mimeFromName,
  normaliseMime,
  requiredStatementMonths,
  type DocKind,
} from "./documents";

const pdf = (mb: number) => ({ sizeBytes: Math.round(mb * MB), mime: "application/pdf" });
const jpg = (mb: number) => ({ sizeBytes: Math.round(mb * MB), mime: "image/jpeg" });
const sized = (mb: number) => ({ sizeBytes: Math.round(mb * MB) });

describe("document sets (SPEC §2.1)", () => {
  it("asks salaried applicants for Emirates ID, passport, salary certificate and 3 months of statements", () => {
    expect(DOCUMENT_SETS.salaried).toEqual([
      "emirates_id",
      "passport",
      "salary_certificate",
      "bank_statements_3m",
    ]);
  });

  it("asks business owners for Emirates ID, passport, trade licence and a year of statements", () => {
    expect(DOCUMENT_SETS.business_owner).toEqual([
      "emirates_id",
      "passport",
      "trade_license",
      "bank_statements_12m",
    ]);
  });
});

describe("per-kind file rules (SPEC §2.2)", () => {
  it("counts 1 MB as 1,048,576 bytes", () => {
    expect(MB).toBe(1_048_576);
  });

  it("caps the bucket at the largest single file any kind allows (40 MB)", () => {
    expect(MAX_FILE_BYTES).toBe(40 * MB);
  });

  it("takes an Emirates ID as one or two files of up to 10 MB each, PDF or image", () => {
    expect(checkFile("emirates_id", jpg(1.8))).toBeNull();
    expect(checkFile("emirates_id", jpg(1.6), [sized(1.8)])).toBeNull();
    expect(checkFile("emirates_id", jpg(1), [sized(1.8), sized(1.6)])).toEqual({
      code: "too_many_files",
      limit: 2,
    });
    expect(checkFile("emirates_id", { sizeBytes: 10 * MB, mime: "image/png" })).toBeNull();
    expect(checkFile("emirates_id", { sizeBytes: 10 * MB + 1, mime: "image/png" })).toEqual({
      code: "too_large",
      sizeBytes: 10 * MB + 1,
      limitBytes: 10 * MB,
    });
  });

  it("takes exactly one passport, salary certificate or trade licence", () => {
    for (const kind of ["passport", "salary_certificate", "trade_license"] as const) {
      expect(checkFile(kind, pdf(1)), kind).toBeNull();
      expect(checkFile(kind, pdf(1), [sized(1)]), kind).toEqual({ code: "too_many_files", limit: 1 });
    }
  });

  it("takes a PDF, a JPG/JPEG or a PNG for every document, and nothing else (Bazar, 9 Oct 2026)", () => {
    for (const kind of DOC_KINDS) {
      expect(checkFile(kind, pdf(1)), kind).toBeNull();
      expect(checkFile(kind, jpg(1)), kind).toBeNull();
      expect(checkFile(kind, { sizeBytes: MB, mime: "image/png" }), kind).toBeNull();
      expect(checkFile(kind, { sizeBytes: MB, mime: "image/gif" }), kind).toEqual({ code: "bad_type" });
      expect(checkFile(kind, { sizeBytes: MB, mime: "application/msword" }), kind).toEqual({ code: "bad_type" });
    }
  });

  it("reproduces W6's oversize trade licence: 14.8 MB against 10 MB", () => {
    const error = checkFile("trade_license", pdf(14.8));
    expect(error).toMatchObject({ code: "too_large", limitBytes: 10 * MB });
  });

  it("limits 3 months of statements to 25 MB across all files", () => {
    expect(checkFile("bank_statements_3m", pdf(8), [sized(8), sized(8)])).toBeNull(); // 24 MB
    expect(checkFile("bank_statements_3m", pdf(2), [sized(8), sized(8), sized(8)])).toEqual({
      code: "total_exceeded",
      totalBytes: 26 * MB,
      limitBytes: 25 * MB,
    });
    expect(checkFile("bank_statements_3m", pdf(25))).toBeNull();
    expect(checkFile("bank_statements_3m", pdf(26))).toMatchObject({ code: "too_large" });
  });

  it("limits a year of statements to 40 MB across up to 12 files", () => {
    // W6: three files, 18.4 MB of 40 used, leaves 21.6 MB.
    const w6 = [sized(6.4), sized(5.9), sized(6.1)];
    expect(checkFile("bank_statements_12m", pdf(21.6), w6)).toBeNull();
    expect(checkFile("bank_statements_12m", pdf(21.7), w6)).toMatchObject({ code: "total_exceeded" });

    const twelve = Array.from({ length: 12 }, () => sized(1));
    expect(checkFile("bank_statements_12m", pdf(1), twelve)).toEqual({
      code: "too_many_files",
      limit: 12,
    });
  });

  it("counts files still uploading in the running total", () => {
    // The caller passes uploading files in `existing` alongside ready ones.
    const readyAndUploading = [sized(20), sized(15)];
    expect(checkFile("bank_statements_12m", pdf(6), readyAndUploading)).toMatchObject({
      code: "total_exceeded",
    });
  });

  it("judges a multi-file pick in order, keeping the files that still fit", () => {
    const results = checkBatch("bank_statements_12m", [pdf(15), pdf(15), pdf(15), pdf(5)], [sized(4)]);
    expect(results.map((r) => r?.code ?? "ok")).toEqual(["ok", "ok", "total_exceeded", "ok"]);
  });

  it("has a rule, and a sensible one, for every kind", () => {
    for (const [kind, rule] of Object.entries(DOCUMENT_RULES) as [DocKind, (typeof DOCUMENT_RULES)[DocKind]][]) {
      expect(rule.minFiles, kind).toBe(1);
      expect(rule.maxFiles, kind).toBeGreaterThanOrEqual(1);
      expect(rule.maxFileBytes, kind).toBeLessThanOrEqual(MAX_FILE_BYTES);
      if (rule.maxTotalBytes) expect(rule.maxFileBytes, kind).toBeLessThanOrEqual(rule.maxTotalBytes);
    }
  });
});

describe("file types", () => {
  it("treats .jpg and .jpeg, and the image/jpg alias, as JPEG", () => {
    expect(normaliseMime("image/jpg")).toBe("image/jpeg");
    expect(normaliseMime("IMAGE/JPEG")).toBe("image/jpeg");
    expect(mimeFromName("photo.JPG")).toBe("image/jpeg");
    expect(mimeFromName("scan.jpeg")).toBe("image/jpeg");
    expect(mimeFromName("statement.pdf")).toBe("application/pdf");
  });

  it("knows nothing of other types", () => {
    expect(normaliseMime("image/heic")).toBeNull();
    expect(normaliseMime("")).toBeNull();
    expect(mimeFromName("id.heic")).toBeNull();
    expect(checkFile("passport", { sizeBytes: MB, mime: "image/heic" })).toEqual({ code: "bad_type" });
  });

  it("builds each file input's accept attribute from the rules", () => {
    expect(acceptAttribute("salary_certificate")).toBe(
      ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png",
    );
    expect(acceptAttribute("passport")).toBe(
      ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png",
    );
  });
});

describe("required statement months (SPEC §2.2)", () => {
  const submitted = new Date("2026-09-22T06:14:00Z"); // Tue 22 Sep 2026, 10:14 in Dubai

  it("asks for the last 3 complete months: Jun, Jul and Aug 2026 (W5)", () => {
    expect(requiredStatementMonths("bank_statements_3m", submitted)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("asks for the last 12 complete months: Sep 2025 to Aug 2026 (W6)", () => {
    const months = requiredStatementMonths("bank_statements_12m", submitted);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-09");
    expect(months.at(-1)).toBe("2026-08");
  });

  it("crosses a year boundary", () => {
    expect(requiredStatementMonths("bank_statements_3m", "2027-01-15T08:00:00Z")).toEqual([
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
    expect(requiredStatementMonths("bank_statements_3m", "2027-02-01T08:00:00Z")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });

  it("uses the Dubai date, not UTC's", () => {
    // 21:30 UTC on 30 Sep is already 1 Oct in Dubai, so September is complete.
    expect(requiredStatementMonths("bank_statements_3m", "2026-09-30T21:30:00Z")).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("is empty for documents that aren't statements", () => {
    expect(requiredStatementMonths("passport", submitted)).toEqual([]);
  });
});
