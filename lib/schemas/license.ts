import { z } from "zod";

/**
 * Sprint 3 (backfilled): license schema for RERA / DMT / Trakheesi
 * licenses tracked on the Compliance settings page. Sprint 8 lands the
 * `licenses` table; the shape here matches the eventual columns.
 */
export const LICENSE_KINDS = [
  "orn",
  "brn",
  "trakheesi",
  "dari",
  "other",
] as const;

export const LICENSE_HOLDER_KINDS = ["organization", "staff"] as const;

export const LICENSE_KIND_LABELS: Record<
  (typeof LICENSE_KINDS)[number],
  string
> = {
  orn: "ORN — Office Registration Number",
  brn: "BRN — Broker Registration Number",
  trakheesi: "Trakheesi listing permit",
  dari: "DARI listing permit",
  other: "Other regulatory licence",
};

export const licenseSchema = z
  .object({
    kind: z.enum(LICENSE_KINDS),
    holder_kind: z.enum(LICENSE_HOLDER_KINDS),
    holder_id: z
      .string()
      .uuid("Pick a holder (organisation or staff)")
      .nullable()
      .optional(),
    number: z
      .string()
      .min(2, "License number is too short")
      .max(60, "License number is too long"),
    issued_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .nullable()
      .optional(),
    expires_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    file_id: z.string().uuid("Upload a file").nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (v) => {
      if (!v.issued_at) return true;
      return new Date(v.issued_at) <= new Date(v.expires_at);
    },
    {
      message: "Expiry must be on or after the issued date",
      path: ["expires_at"],
    },
  );

export type LicenseInput = z.infer<typeof licenseSchema>;

/** Returns "expired" / "expiring" / "valid" for a given license expiry. */
export function licenseStatus(
  expiresAt: string,
  nowMs: number,
): "expired" | "expiring" | "valid" {
  const exp = new Date(expiresAt).getTime();
  if (exp <= nowMs) return "expired";
  if (exp - nowMs <= 30 * 86_400_000) return "expiring";
  return "valid";
}
