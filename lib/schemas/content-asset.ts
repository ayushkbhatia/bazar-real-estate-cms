import { z } from "zod";
import { uuidLikeOrEmpty } from "@/lib/uuid";
import { unknownTokens } from "@/lib/content-assets/tokens";

/**
 * Validation for the Content Assets editor.
 *
 * The two rules worth stating out loud, because both are enforced in Postgres
 * as well and the schema exists to explain them before the database refuses:
 *
 *  · A WhatsApp asset has no subject. There is nowhere to render one.
 *  · Tokens must come from the closed vocabulary. An unknown `{{token}}` is a
 *    save-time error, not something to discover in a sent message.
 */

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CONTENT_ASSET_KINDS = ["email", "whatsapp"] as const;
export type ContentAssetKind = (typeof CONTENT_ASSET_KINDS)[number];

export const CONTENT_ASSET_STATUSES = ["draft", "published"] as const;
export type ContentAssetStatus = (typeof CONTENT_ASSET_STATUSES)[number];

export const CONTENT_ASSET_KIND_LABELS: Record<ContentAssetKind, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

/**
 * Categories are a text column, not an enum — the taxonomy will grow with use
 * and shouldn't need a migration each time. These are the suggestions the
 * editor offers; anything typed is accepted.
 */
export const CONTENT_ASSET_CATEGORIES = [
  "enquiry",
  "viewing",
  "deal",
  "valuation",
  "nurture",
  "general",
] as const;

export const contentAssetSchema = z
  .object({
    kind: z.enum(CONTENT_ASSET_KINDS),
    slug: z
      .string()
      .min(3, "Slug is too short")
      .max(80, "Slug is too long")
      .regex(slugRegex, "Lowercase letters, numbers and hyphens only"),
    name: z.string().min(3, "Name is too short").max(120, "Name is too long"),
    category: z.string().min(2).max(40).default("general"),
    subject: z.string().max(200, "Subject is too long").nullable().optional(),
    body: z
      .string()
      .min(10, "Write the message body")
      .max(8000, "Trim to under 8000 characters"),
    notes: z.string().max(2000, "Notes are too long").nullable().optional(),
    follow_up_after_days: z
      .number()
      .int()
      .min(1, "At least a day")
      .max(365, "At most a year")
      .nullable()
      .optional(),
    next_asset_id: uuidLikeOrEmpty("Pick a valid asset"),
    status: z.enum(CONTENT_ASSET_STATUSES),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "whatsapp" && val.subject && val.subject.trim() !== "") {
      ctx.addIssue({
        code: "custom",
        path: ["subject"],
        message: "WhatsApp messages have no subject line.",
      });
    }
    if (val.kind === "email" && val.status === "published") {
      if (!val.subject || val.subject.trim() === "") {
        ctx.addIssue({
          code: "custom",
          path: ["subject"],
          message: "A published email needs a subject.",
        });
      }
    }
    for (const [field, text] of [
      ["body", val.body],
      ["subject", val.subject ?? ""],
    ] as const) {
      const bad = unknownTokens(text);
      if (bad.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `Unknown token${bad.length > 1 ? "s" : ""}: ${bad
            .map((t) => `{{${t}}}`)
            .join(", ")}`,
        });
      }
    }
  });

export type ContentAssetInput = z.infer<typeof contentAssetSchema>;

/** Blank strings become null; numeric strings become numbers. */
export function normaliseContentAssetInput(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  for (const k of ["subject", "notes", "next_asset_id"] as const) {
    const v = out[k];
    if (v === "" || v === undefined) out[k] = null;
  }
  // A WhatsApp asset can't carry a subject even if the form still held one
  // from before the kind was switched.
  if (out.kind === "whatsapp") out.subject = null;

  const days = out.follow_up_after_days;
  if (days === "" || days === undefined || days === null) {
    out.follow_up_after_days = null;
  } else if (typeof days === "string") {
    const n = Number(days);
    out.follow_up_after_days = Number.isNaN(n) ? null : n;
  }

  for (const k of ["slug", "name", "category"] as const) {
    const v = out[k];
    if (typeof v === "string") out[k] = v.trim();
  }
  return out;
}

/** Derive a slug from a name, for the "new asset" form. */
export function slugifyAssetName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
