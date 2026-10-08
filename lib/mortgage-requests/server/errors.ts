/**
 * Errors the mortgage API answers with: `{ code, message?, field?, … }` and an
 * HTTP status (frontend foundations §8). The upload codes are the ones W5, W6
 * and W8 turn into copy (frontend foundations §7.4).
 */

export type MortgageErrorCode =
  // Access
  | "unauthorised"
  | "forbidden"
  | "not_found"
  | "not_configured"
  | "rate_limited"
  | "invalid"
  // Drafts and files
  | "draft_expired"
  | "draft_submitted"
  | "upload_missing"
  | "too_large"
  | "total_exceeded"
  | "bad_type"
  | "too_many_files"
  | "encrypted_pdf"
  | "unreadable"
  // Submitting (POST /api/mortgage/requests)
  | "files_not_ready"
  | "documents_incomplete"
  // Secure links (W8, the invite; SPEC §8)
  | "link_unavailable"
  | "link_locked"
  | "code_wrong"
  | "code_expired"
  | "code_cooldown"
  | "code_failed"
  // Staff actions answered over HTTP (a bank's letter, Phase 6)
  | "conflict"
  | "internal";

export class MortgageApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: MortgageErrorCode,
    message?: string,
    /** Extra fields for the copy, e.g. `{ sizeBytes, limitBytes }` for too_large. */
    readonly details: Record<string, string | number> = {},
    readonly field?: string,
  ) {
    super(message ?? code);
    this.name = "MortgageApiError";
  }

  toJSON() {
    return {
      code: this.code,
      ...(this.message !== this.code ? { message: this.message } : {}),
      ...(this.field ? { field: this.field } : {}),
      ...this.details,
    };
  }
}

export const notFound = () => new MortgageApiError(404, "not_found");
