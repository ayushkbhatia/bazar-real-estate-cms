/**
 * Fast Pre-Approval documents: which ones each applicant uploads, and the
 * rules each file must meet (docs/mortgage/SPEC.md §2.1–2.2).
 *
 * One source for the website's upload rows (W5, W6, W8), the upload API's
 * checks (Phase 2) and the CMS. The database holds the same two document sets
 * in `mortgage_create_request()` (0139); the database tests compare them.
 *
 * Browser checks are only for speed: the server re-checks every rule,
 * including the file's real type from its first bytes.
 */

import { dubaiParts } from "./dubai-time";

/** 1 MB = 1,048,576 bytes, for every limit and every displayed size. */
export const MB = 1_048_576;

export const DOC_KINDS = [
  "emirates_id",
  "passport",
  "salary_certificate",
  "bank_statements_3m",
  "trade_license",
  "bank_statements_12m",
] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const EMPLOYMENT_TYPES = ["salaried", "business_owner"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/** Paths B and C (SPEC §2.1). Path letters are internal: never show them. */
export const DOCUMENT_SETS: Record<EmploymentType, readonly DocKind[]> = {
  salaried: ["emirates_id", "passport", "salary_certificate", "bank_statements_3m"],
  business_owner: ["emirates_id", "passport", "trade_license", "bank_statements_12m"],
};

export const DOCUMENT_MIMES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type DocumentMime = (typeof DOCUMENT_MIMES)[number];

export type DocumentRule = {
  minFiles: number;
  maxFiles: number;
  mimes: readonly DocumentMime[];
  /** Largest single file. */
  maxFileBytes: number;
  /** All of the document's files together, for the kinds limited by a total. */
  maxTotalBytes?: number;
  /** Months of statements required, for the statement kinds. */
  statementMonths?: 3 | 12;
};

const PDF_OR_IMAGE: readonly DocumentMime[] = ["application/pdf", "image/jpeg", "image/png"];
const PDF_ONLY: readonly DocumentMime[] = ["application/pdf"];

export const DOCUMENT_RULES: Record<DocKind, DocumentRule> = {
  // Front and back.
  emirates_id: { minFiles: 1, maxFiles: 2, mimes: PDF_OR_IMAGE, maxFileBytes: 10 * MB },
  passport: { minFiles: 1, maxFiles: 1, mimes: PDF_OR_IMAGE, maxFileBytes: 10 * MB },
  salary_certificate: { minFiles: 1, maxFiles: 1, mimes: PDF_ONLY, maxFileBytes: 10 * MB },
  bank_statements_3m: {
    minFiles: 1,
    maxFiles: 12,
    mimes: PDF_ONLY,
    maxFileBytes: 25 * MB,
    maxTotalBytes: 25 * MB,
    statementMonths: 3,
  },
  trade_license: { minFiles: 1, maxFiles: 1, mimes: PDF_OR_IMAGE, maxFileBytes: 10 * MB },
  bank_statements_12m: {
    minFiles: 1,
    maxFiles: 12,
    mimes: PDF_ONLY,
    maxFileBytes: 40 * MB,
    maxTotalBytes: 40 * MB,
    statementMonths: 12,
  },
};

/** The largest single file any kind allows — the private bucket's size cap. */
export const MAX_FILE_BYTES = Math.max(
  ...Object.values(DOCUMENT_RULES).map((rule) => rule.maxFileBytes),
);

export type FileRuleError =
  | { code: "bad_type" }
  | { code: "too_many_files"; limit: number }
  | { code: "too_large"; sizeBytes: number; limitBytes: number }
  | { code: "total_exceeded"; totalBytes: number; limitBytes: number };

export type SizedFile = { sizeBytes: number };
export type CandidateFile = { sizeBytes: number; mime: string };

const MIME_ALIASES: Record<string, DocumentMime> = {
  "application/pdf": "application/pdf",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/png": "image/png",
};

/** A declared MIME type in the module's vocabulary, or null. `.jpg` and `.jpeg` are both JPEG. */
export function normaliseMime(mime: string | null | undefined): DocumentMime | null {
  if (!mime) return null;
  return MIME_ALIASES[mime.trim().toLowerCase()] ?? null;
}

/** A MIME type from a file name, for the browsers that report an empty `File.type`. */
export function mimeFromName(name: string): DocumentMime | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return null;
}

/** The `accept` attribute for a kind's file input. */
export function acceptAttribute(kind: DocKind): string {
  const extensions: Record<DocumentMime, string[]> = {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
  };
  const mimes = DOCUMENT_RULES[kind].mimes;
  return [...mimes.flatMap((m) => extensions[m]), ...mimes].join(",");
}

/**
 * Can one more file be added to a document?
 *
 * `existing` is every file the document already has, including ones still
 * uploading, so running totals are counted before a file starts rather than
 * after it lands (frontend foundations §7.2). Checked in this order: type,
 * file count, the file's own size, then the document's total.
 */
export function checkFile(
  kind: DocKind,
  candidate: CandidateFile,
  existing: readonly SizedFile[] = [],
): FileRuleError | null {
  const rule = DOCUMENT_RULES[kind];
  const mime = normaliseMime(candidate.mime);
  if (!mime || !rule.mimes.includes(mime)) return { code: "bad_type" };
  if (existing.length + 1 > rule.maxFiles) {
    return { code: "too_many_files", limit: rule.maxFiles };
  }
  if (candidate.sizeBytes > rule.maxFileBytes) {
    return { code: "too_large", sizeBytes: candidate.sizeBytes, limitBytes: rule.maxFileBytes };
  }
  if (rule.maxTotalBytes !== undefined) {
    const totalBytes = existing.reduce((sum, f) => sum + f.sizeBytes, 0) + candidate.sizeBytes;
    if (totalBytes > rule.maxTotalBytes) {
      return { code: "total_exceeded", totalBytes, limitBytes: rule.maxTotalBytes };
    }
  }
  return null;
}

/**
 * Check several files picked at once ("Add more files"), in order: each file
 * is judged against the existing files plus the ones accepted before it, so
 * the first file that would break a total is refused and later files that
 * still fit are kept.
 */
export function checkBatch(
  kind: DocKind,
  candidates: readonly CandidateFile[],
  existing: readonly SizedFile[] = [],
): (FileRuleError | null)[] {
  const accepted: SizedFile[] = [...existing];
  return candidates.map((candidate) => {
    const error = checkFile(kind, candidate, accepted);
    if (!error) accepted.push({ sizeBytes: candidate.sizeBytes });
    return error;
  });
}

/**
 * The statement months a kind requires: the last N complete calendar months
 * before the submission date in Dubai, oldest first, as "YYYY-MM" (SPEC §2.2).
 * Submitted on 22 Sep 2026: Jun, Jul and Aug 2026 (3 months), or Sep 2025 to
 * Aug 2026 (12). Empty for kinds that aren't statements.
 */
export function requiredStatementMonths(kind: DocKind, submittedAt: Date | string): string[] {
  const n = DOCUMENT_RULES[kind].statementMonths;
  if (!n) return [];
  const { year, month } = dubaiParts(new Date(submittedAt));
  const current = year * 12 + (month - 1);
  const months: string[] = [];
  for (let back = n; back >= 1; back--) {
    const index = current - back;
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return months;
}
