import { z } from "zod";

/**
 * Sprint 3 (backfilled): api-key schema for /admin/settings/api.
 * Sprint 8 lands the `api_keys` table.
 */
export const API_KEY_ROLES = ["read", "write", "admin"] as const;
export const API_KEY_ROLE_LABELS: Record<
  (typeof API_KEY_ROLES)[number],
  string
> = {
  read: "Read-only",
  write: "Read + write",
  admin: "Admin (use sparingly)",
};

export const apiKeyCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Give the key a recognisable name")
    .max(80, "Name is too long"),
  role: z.enum(API_KEY_ROLES),
  expires_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional(),
});

export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;
