"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/schemas/staff";
import { sendEmail } from "@/lib/email";
import { slugifyAssetName } from "@/lib/schemas/content-asset";
import { sanitizeEmailBody } from "@/lib/content-assets/email-html";
import {
  FORM_REPLY_DEFAULT,
  FORM_REPLY_DEFAULT_AR,
  FORM_REPLY_TOKENS,
} from "@/lib/content-assets/form-replies";
import { previewFormReply } from "@/lib/content-assets/system-emails";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import { getFormDef } from "@/lib/forms/registry";
import { formEmailRouting } from "@/lib/content-assets/usage";
import { outOfScopeTokens, tokenDef, unknownTokens, usedTokens } from "@/lib/content-assets/tokens";

/**
 * Writes for form replies — the emails an editor assigns to public forms.
 *
 * Same roles as the rest of the library (admin, editor, marketing), enforced
 * again by RLS on `content_assets` and `forms`.
 */
const WRITE_ROLES = ["admin", "editor", "marketing"] as const;

export type ReplyActionResult =
  | { status: "ok"; message: string; id?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const replySchema = z.object({
  /** Which half of the reply this save is for. */
  lang: z.enum(["en", "ar"]).default("en"),
  name: z.string().trim().min(3, "Give it a name.").max(120, "That name is too long."),
  subject: z.string().trim().max(200, "Keep the subject under 200 characters."),
  body: z.string().max(40_000, "The message is too long."),
  notes: z.string().max(2000, "Notes are too long.").nullable().optional(),
  status: z.enum(["draft", "published"]),
});

function visibleText(html: string): string {
  return html
    .replace(/<img[^>]*>/g, "image")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** The same check the editor shows and the save refuses on. */
function copyProblems(
  copy: { subject: string; body: string },
  lang: "en" | "ar" = "en",
): Record<string, string> {
  const problems: Record<string, string> = {};
  const written = Boolean(copy.subject.trim() || visibleText(copy.body));
  // Arabic is optional — no Arabic means Arabic leads get the English reply —
  // but half an Arabic email is not a thing anybody should be able to save.
  if (lang === "ar" && written) {
    if (!copy.subject.trim()) problems.subject = "Write the Arabic subject too, or clear both.";
    if (!visibleText(copy.body)) problems.body = "Write the Arabic message too, or clear both.";
  }
  if (lang === "en" && !copy.subject.trim()) problems.subject = "Write a subject line.";
  for (const [field, text] of [
    ["subject", copy.subject],
    ["body", copy.body],
  ] as const) {
    const bad = [
      ...new Set([
        ...unknownTokens(text),
        ...outOfScopeTokens(text, FORM_REPLY_TOKENS),
      ]),
    ];
    if (bad.length > 0) {
      problems[field] = `Nothing fills ${bad
        .map((t) => `{{${t}}}`)
        .join(", ")} on a form reply. Use a field from the Insert field list.`;
    }
  }
  const blocks = usedTokens(copy.subject).filter((t) => tokenDef(t).kind === "block");
  if (blocks.length > 0 && !problems.subject) {
    problems.subject = "A panel can't go in a subject line.";
  }
  if (lang === "en" && !visibleText(copy.body) && !problems.body)
    problems.body = "Write the message.";
  return problems;
}

function revalidate(id?: string) {
  revalidatePath("/admin/content-assets");
  revalidatePath("/admin/content-assets/replies");
  if (id) revalidatePath(`/admin/content-assets/replies/${id}`);
  revalidatePath("/admin/forms", "layout");
}

/** A slug nothing else holds — the name is the editor's, the key is ours. */
async function freeSlug(
  supabase: Awaited<ReturnType<typeof requireRole>>["supabase"],
  name: string,
): Promise<string> {
  const base = `reply-${slugifyAssetName(name) || "untitled"}`.slice(0, 70);
  const { data } = await supabase
    .from("content_assets")
    .select("slug")
    .like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 500; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${taken.size + 1}`;
}

export async function createFormReply(name: string): Promise<ReplyActionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  const { supabase, user } = await requireRole(WRITE_ROLES);

  const parsed = z
    .string()
    .trim()
    .min(3, "Give it a name.")
    .max(120)
    .safeParse(name);
  if (!parsed.success)
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid name." };

  const { data, error } = await supabase
    .from("content_assets")
    .insert({
      role: "form_reply",
      kind: "email",
      category: "enquiry",
      name: parsed.data,
      slug: await freeSlug(supabase, parsed.data),
      subject: FORM_REPLY_DEFAULT.subject,
      body: FORM_REPLY_DEFAULT.body,
      // Both halves, so the Arabic tab opens on a first draft rather than a
      // blank page — the same bargain migration 0129 struck for the seventeen.
      subject_ar: FORM_REPLY_DEFAULT_AR.subject,
      body_ar: FORM_REPLY_DEFAULT_AR.body,
      body_format: "html",
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Could not create the reply." };

  await logAudit({
    action: "content_asset.created",
    target_kind: "content_asset",
    target_id: data.id,
    before: null,
    after: { role: "form_reply", name: parsed.data },
  });
  revalidate(data.id);
  return { status: "ok", message: "Reply created as a draft.", id: data.id };
}

export async function saveFormReply(
  id: string,
  raw: unknown,
): Promise<ReplyActionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  const { supabase } = await requireRole(WRITE_ROLES);

  const parsed = replySchema.safeParse(raw);
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

  const body = sanitizeEmailBody(parsed.data.body);
  const lang = parsed.data.lang;
  const problems = copyProblems({ subject: parsed.data.subject, body }, lang);
  if (Object.keys(problems).length > 0) {
    return {
      status: "error",
      message: "Fix the highlighted fields before saving.",
      fieldErrors: problems,
    };
  }

  const { data: before } = await supabase
    .from("content_assets")
    .select("id, role, status, name")
    .eq("id", id)
    .maybeSingle();
  if (!before || before.role !== "form_reply")
    return { status: "error", message: "Not a form reply." };

  const values =
    lang === "ar"
      ? {
          subject_ar: parsed.data.subject.trim() || null,
          body_ar: visibleText(body) ? body : null,
        }
      : { subject: parsed.data.subject, body, body_format: "html" as const };

  const { error } = await supabase
    .from("content_assets")
    .update({
      ...values,
      name: parsed.data.name,
      notes: parsed.data.notes?.trim() || null,
      status: parsed.data.status,
    })
    .eq("id", id);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "content_asset.updated",
    target_kind: "content_asset",
    target_id: id,
    before: { status: before.status, name: before.name },
    after: { status: parsed.data.status, name: parsed.data.name, role: "form_reply" },
  });

  revalidate(id);
  const wentLive = parsed.data.status === "published" && before.status !== "published";
  const wentBack = parsed.data.status === "draft" && before.status === "published";
  if (lang === "ar" && !wentLive && !wentBack) {
    return {
      status: "ok",
      message: parsed.data.subject.trim()
        ? "Arabic saved."
        : "Arabic cleared — Arabic leads receive the English reply.",
    };
  }
  return {
    status: "ok",
    message: wentLive
      ? "Published — the forms using this reply send it from now on."
      : wentBack
        ? "Back to draft — those forms send the acknowledgement again."
        : "Saved.",
  };
}

/**
 * Point a form at a reply, or back at the default.
 *
 * Upserts by key: a form has no row until someone saves something about it,
 * and assigning a reply is the first such thing for most of them.
 */
export async function assignFormReply(
  formKey: string,
  assetId: string | null,
): Promise<ReplyActionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  const { supabase } = await requireRole(WRITE_ROLES);

  const def = getFormDef(formKey);
  if (!def) return { status: "error", message: "Unknown form." };
  const routing = formEmailRouting(def);
  if (!routing.assignable)
    return { status: "error", message: routing.why };

  if (assetId) {
    const { data: asset } = await supabase
      .from("content_assets")
      .select("id, role, deleted_at")
      .eq("id", assetId)
      .maybeSingle();
    if (!asset || asset.role !== "form_reply" || asset.deleted_at)
      return { status: "error", message: "That reply is not available." };
  }

  const { error } = await supabase
    .from("forms")
    .upsert({ key: formKey, reply_asset_id: assetId }, { onConflict: "key" });
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "form.reply_assigned",
    target_kind: "form",
    target_id: formKey,
    before: null,
    after: { reply_asset_id: assetId },
  });

  revalidate(assetId ?? undefined);
  return {
    status: "ok",
    message: assetId
      ? `“${def.name}” now replies with your chosen email.`
      : `“${def.name}” is back to Bazar's acknowledgement.`,
  };
}

export type ReplyPreview = {
  email: RenderedEmail;
  problems: Record<string, string>;
};

/** Render unsaved reply copy against a sample lead from one form. */
export async function previewFormReplyDraft(
  draft: { subject: string; body: string; lang?: "en" | "ar" },
  formKey: string | null,
): Promise<ReplyPreview> {
  await requireRole(STAFF_ROLES);
  const body = sanitizeEmailBody(String(draft.body ?? "").slice(0, 40_000));
  const subject = String(draft.subject ?? "").slice(0, 200);
  const lang = draft.lang === "ar" ? "ar" : "en";
  const copy =
    lang === "ar"
      ? { subject: "", body: "", subjectAr: subject, bodyAr: body, format: "html" as const }
      : { subject, body, format: "html" as const };
  return {
    email: await previewFormReply(copy, formKey, undefined, lang),
    problems: copyProblems({ subject, body }, lang),
  };
}

/** Send the reply on screen to the signed-in staff member. */
export async function sendFormReplyTest(
  draft: { subject: string; body: string; lang?: "en" | "ar" },
  formKey: string | null,
): Promise<ReplyActionResult> {
  const { user } = await requireRole(WRITE_ROLES);
  if (!user.email)
    return { status: "error", message: "Your account has no email address." };

  const lang = draft.lang === "ar" ? "ar" : "en";
  const subject = String(draft.subject ?? "").slice(0, 200);
  const body = sanitizeEmailBody(String(draft.body ?? "").slice(0, 40_000));
  const email = await previewFormReply(
    lang === "ar"
      ? { subject: "", body: "", subjectAr: subject, bodyAr: body, format: "html" }
      : { subject, body, format: "html" },
    formKey,
    undefined,
    lang,
  );
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
