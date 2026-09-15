"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/schemas/staff";
import { sendEmail } from "@/lib/email";
import {
  DEFAULT_EMAIL_BRAND,
  emailBrandSchema,
  resolveEmailBrand,
  type EmailBrand,
  type EmailBrandOverrides,
} from "@/lib/content-assets/email-brand";
import { sanitizeEmailBody } from "@/lib/content-assets/email-html";
import {
  SYSTEM_ASSETS,
  isSystemAssetKey,
  missingRequiredTokens,
  type SystemAssetKey,
} from "@/lib/content-assets/system";
import {
  previewAdvisorReply,
  previewSystemEmail,
} from "@/lib/content-assets/system-emails";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import {
  outOfScopeTokens,
  tokenDef,
  unknownTokens,
  usedTokens,
} from "@/lib/content-assets/tokens";

/**
 * Writes and previews for the system emails and the email design.
 *
 * Wording follows the outreach library's roles — admin, editor, marketing —
 * and RLS on `content_assets` enforces the same list. The design is a
 * site_settings column, which RLS lets only an admin write, so saving it is
 * admin-only here too rather than a button that fails for everyone else.
 */
const WRITE_ROLES = ["admin", "editor", "marketing"] as const;

export type EmailActionResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const copySchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Write a subject line.")
    .max(200, "Keep the subject under 200 characters."),
  body: z.string().max(40_000, "The message is too long."),
  notes: z.string().max(2000, "Notes are too long.").nullable().optional(),
  status: z.enum(["draft", "published"]),
});

/** The body with its markup stripped — how "is there anything written?" is asked. */
function visibleText(html: string): string {
  return html
    .replace(/<img[^>]*>/g, "image")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Every problem with this copy, per field, in the words the editor shows.
 * Shared by save (which refuses) and preview (which only warns), so the
 * preview can never call something fine that save then rejects.
 */
function copyProblems(
  key: SystemAssetKey,
  copy: { subject: string; body: string },
  publishing: boolean,
): Record<string, string> {
  const problems: Record<string, string> = {};
  const allowed = SYSTEM_ASSETS[key].tokens;

  for (const [field, text] of [
    ["subject", copy.subject],
    ["body", copy.body],
  ] as const) {
    const unknown = unknownTokens(text);
    const scoped = outOfScopeTokens(text, allowed);
    const bad = [...new Set([...unknown, ...scoped])];
    if (bad.length > 0) {
      problems[field] = `Nothing fills ${bad
        .map((t) => `{{${t}}}`)
        .join(", ")} in this email. Use a field from the Insert field list.`;
    }
  }

  const blocksInSubject = usedTokens(copy.subject).filter(
    (t) => tokenDef(t).kind === "block",
  );
  if (blocksInSubject.length > 0 && !problems.subject) {
    problems.subject = `A panel can't go in a subject line: ${blocksInSubject
      .map((t) => `{{${t}}}`)
      .join(", ")}.`;
  }

  if (!visibleText(copy.body) && !problems.body) {
    problems.body = "Write the message.";
  }

  if (publishing) {
    const missing = missingRequiredTokens(key, copy);
    if (missing.length > 0 && !problems.body) {
      problems.body = `This email doesn't work without ${missing
        .map((t) => `{{${t}}}`)
        .join(" and ")} — add it before publishing.`;
    }
  }
  return problems;
}

function revalidate(key: SystemAssetKey) {
  revalidatePath("/admin/content-assets");
  revalidatePath(`/admin/content-assets/emails/${key}`);
}

export async function saveSystemEmail(
  key: string,
  raw: unknown,
): Promise<EmailActionResult> {
  if (!isSystemAssetKey(key)) return { status: "error", message: "Unknown email." };
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  const { supabase } = await requireRole(WRITE_ROLES);

  const parsed = copySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return {
      status: "error",
      message: "Fix the highlighted fields before saving.",
      fieldErrors,
    };
  }

  // The allowlist is the boundary; the editor is only a convention.
  const body = sanitizeEmailBody(parsed.data.body);
  const copy = { subject: parsed.data.subject, body };
  const problems = copyProblems(key, copy, parsed.data.status === "published");
  if (Object.keys(problems).length > 0) {
    return {
      status: "error",
      message:
        parsed.data.status === "published"
          ? "This can't be published yet."
          : "Fix the highlighted fields before saving.",
      fieldErrors: problems,
    };
  }

  const { data: before } = await supabase
    .from("content_assets")
    .select("id, status, subject, body_format")
    .eq("system_key", key)
    .maybeSingle();
  if (!before) {
    return {
      status: "error",
      message: `The row for "${SYSTEM_ASSETS[key].label}" is missing — migration 0127 seeds it.`,
    };
  }

  const { error } = await supabase
    .from("content_assets")
    .update({
      subject: copy.subject,
      body,
      body_format: "html",
      notes: parsed.data.notes?.trim() || null,
      status: parsed.data.status,
    })
    .eq("id", before.id);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "content_asset.updated",
    target_kind: "content_asset",
    target_id: before.id,
    before: { status: before.status, subject: before.subject },
    after: {
      status: parsed.data.status,
      subject: copy.subject,
      system_key: key,
    },
  });

  revalidate(key);
  const wentLive = parsed.data.status === "published" && before.status !== "published";
  const wentBack = parsed.data.status === "draft" && before.status === "published";
  return {
    status: "ok",
    message: wentLive
      ? "Published — this wording sends from now on."
      : wentBack
        ? "Back to draft — Bazar's built-in wording sends again."
        : parsed.data.status === "published"
          ? "Saved — the new wording is live."
          : "Draft saved. Nothing sent changes until you publish.",
  };
}

export type DraftPreview = {
  email: RenderedEmail;
  problems: Record<string, string>;
};

/** Render unsaved copy as it would send to the sample recipient. */
export async function previewSystemEmailDraft(
  key: string,
  draft: { subject: string; body: string },
): Promise<DraftPreview | null> {
  if (!isSystemAssetKey(key)) return null;
  await requireRole(STAFF_ROLES);
  const body = sanitizeEmailBody(String(draft.body ?? "").slice(0, 40_000));
  const subject = String(draft.subject ?? "").slice(0, 200);
  const preview = await previewSystemEmail(key, {
    draft: { subject, body, format: "html" },
  });
  return {
    email: preview.draft!,
    problems: copyProblems(key, { subject, body }, true),
  };
}

/**
 * Send one email to the signed-in staff member, as the sample recipient would
 * receive it. Unsaved copy when `draft` is given; what sends today otherwise.
 */
export async function sendSystemEmailTest(
  key: string,
  draft: { subject: string; body: string } | null,
): Promise<EmailActionResult> {
  if (!isSystemAssetKey(key)) return { status: "error", message: "Unknown email." };
  const { user } = await requireRole(WRITE_ROLES);
  if (!user.email)
    return { status: "error", message: "Your account has no email address." };

  const preview = await previewSystemEmail(key, {
    draft: draft
      ? {
          subject: String(draft.subject ?? "").slice(0, 200),
          body: sanitizeEmailBody(String(draft.body ?? "").slice(0, 40_000)),
          format: "html",
        }
      : null,
  });
  const email = preview.draft ?? preview.live;
  const result = await sendEmail({
    to: user.email,
    subject: `[Test] ${email.subject}`,
    text: email.text,
    html: email.html,
  });
  if (result.status === "ok")
    return { status: "ok", message: `Test sent to ${user.email}.` };
  if (result.status === "skipped")
    return {
      status: "error",
      message: `Email isn't configured here (${result.reason}), so nothing was sent.`,
    };
  return { status: "error", message: result.message };
}

/** Keep only what differs from Bazar's design, so `{}` stays meaningful. */
function overridesOnly(brand: EmailBrandOverrides): EmailBrandOverrides {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(brand)) {
    if (v === undefined || v === null || v === "") continue;
    if (DEFAULT_EMAIL_BRAND[k as keyof EmailBrand] === v) continue;
    out[k] = v;
  }
  return out as EmailBrandOverrides;
}

export async function saveEmailDesign(raw: unknown): Promise<EmailActionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  const { supabase, user } = await requireRole(["admin"]);

  const parsed = emailBrandSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { status: "error", message: "Fix the highlighted fields.", fieldErrors };
  }

  const stored = overridesOnly(parsed.data);
  const { error } = await supabase
    .from("site_settings")
    .update({ email_branding: stored, updated_by: user.id })
    .eq("id", 1);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "settings.email_branding_update",
    target_kind: "site_settings",
    target_id: "1",
    before: null,
    after: stored,
  });

  revalidatePath("/admin/content-assets", "layout");
  return {
    status: "ok",
    message:
      Object.keys(stored).length === 0
        ? "Saved — every email uses Bazar's original design."
        : "Saved — every email the site sends now uses this design.",
  };
}

/** One email, rendered with an unsaved design. */
export async function previewEmailDesign(
  key: string,
  raw: unknown,
): Promise<RenderedEmail | null> {
  await requireRole(STAFF_ROLES);
  const brand = resolveEmailBrand(raw);
  if (key === "advisor_reply") return previewAdvisorReply(brand);
  if (!isSystemAssetKey(key)) return null;
  const preview = await previewSystemEmail(key, { brand });
  return preview.live;
}
