import { z } from "zod";

const slugRegex = /^[a-z0-9-]+$/;

export const AGENT_ROLES = ["agent", "admin", "support", "marketing", "editor"] as const;
export const AGENT_STATUSES = ["active", "invited", "suspended"] as const;

export const agentEditSchema = z.object({
  display_name: z
    .string()
    .min(2, "Name is too short")
    .max(120, "Name is too long"),
  slug: z
    .string()
    .min(2, "Slug is too short")
    .max(120, "Slug is too long")
    .regex(slugRegex, "Lowercase letters, numbers, and hyphens only"),
  title: z.string().max(120).nullable().optional(),
  brn: z.string().max(64).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  photo_url: z
    .string()
    .url("Use a full URL or leave blank")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  languages: z.array(z.string().max(60)).max(10),
  specialties: z.array(z.string().max(60)).max(10),
  credentials: z.array(z.string().max(120)).max(10),
});

export type AgentEditInput = z.infer<typeof agentEditSchema>;

export function normaliseAgentEdit(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const k of ["display_name", "slug", "title", "brn", "bio", "photo_url"] as const) {
    const v = out[k];
    if (v === "" || v === undefined) out[k] = null;
    if (typeof v === "string") out[k] = v.trim();
  }
  // Required fields can't be null.
  if (out.display_name == null) out.display_name = "";
  if (out.slug == null) out.slug = "";
  for (const k of ["languages", "specialties", "credentials"] as const) {
    const v = out[k];
    if (typeof v === "string") {
      out[k] = v
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else if (!Array.isArray(v)) {
      out[k] = [];
    }
  }
  return out;
}
