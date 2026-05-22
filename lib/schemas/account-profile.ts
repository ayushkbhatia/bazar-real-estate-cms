import { z } from "zod";

export const ACCOUNT_LANGUAGES = ["en", "ar"] as const;
export const ACCOUNT_RESIDENCY = [
  "uae_resident",
  "non_resident",
  "gcc_national",
] as const;

export const ACCOUNT_LANGUAGE_LABELS: Record<
  (typeof ACCOUNT_LANGUAGES)[number],
  string
> = {
  en: "English",
  ar: "Arabic",
};

export const ACCOUNT_RESIDENCY_LABELS: Record<
  (typeof ACCOUNT_RESIDENCY)[number],
  string
> = {
  uae_resident: "UAE resident",
  non_resident: "Non-resident",
  gcc_national: "GCC national",
};

export const ACCOUNT_KYC_LABELS: Record<string, string> = {
  unverified: "Not started",
  pending: "Under review",
  verified: "Verified",
  rejected: "Rejected",
};

export const accountProfileSchema = z.object({
  first_name: z
    .string()
    .max(80, "First name is too long")
    .nullable()
    .optional(),
  last_name: z
    .string()
    .max(80, "Last name is too long")
    .nullable()
    .optional(),
  nationality: z
    .string()
    .max(80, "Nationality is too long")
    .nullable()
    .optional(),
  preferred_language: z.enum(ACCOUNT_LANGUAGES),
  residency_status: z
    .enum(ACCOUNT_RESIDENCY)
    .nullable()
    .optional(),
  marketing_opt_in: z.boolean(),
});

export type AccountProfileInput = z.infer<typeof accountProfileSchema>;

export function normaliseAccountProfile(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const k of [
    "first_name",
    "last_name",
    "nationality",
  ] as const) {
    const v = out[k];
    if (v === "" || v === undefined) out[k] = null;
    if (typeof v === "string") out[k] = v.trim();
  }
  if (out.marketing_opt_in === "on") out.marketing_opt_in = true;
  if (out.marketing_opt_in === undefined) out.marketing_opt_in = false;
  if (out.residency_status === "" || out.residency_status === undefined)
    out.residency_status = null;
  return out;
}
