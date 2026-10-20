"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAFF_ROLES } from "@/lib/schemas/staff";
import { sanitizeEmailBody } from "@/lib/content-assets/email-html";
import { readEmailBrand } from "@/lib/content-assets/system-resolve";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import { newsletterConfirmationEmail } from "@/lib/content-assets/system-emails";
import { generateConfirmationToken } from "@/lib/schemas/newsletter";
import { emailSiteUrl } from "@/lib/email-templates";
import {
  NEWSLETTER_SEND_ROLES,
  NEWSLETTER_WRITE_ROLES,
  campaignDraftSchema,
  campaignProblems,
  editionLocale,
  renderNewsletter,
  type CampaignDraft,
} from "@/lib/newsletter/campaign";
import { featureBlocksIn } from "@/lib/content-assets/email-feature";
import type { EmailBrand } from "@/lib/content-assets/email-brand";
import type { EmailLocale } from "@/lib/content-assets/tokens";
import { featureDrawer, newsletterFeatures } from "@/lib/newsletter/features";
import { missingFeatures, unresolvedFeatures } from "@/lib/newsletter/feature-render";
import { isStarter, starterDraft, STARTER_NEEDS, type StarterPicks } from "@/lib/newsletter/starters";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { drainNewsletterQueue, finishCampaigns, startCampaign } from "@/lib/newsletter/send";

export type NewsletterActionResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const ADMIN_PATH = "/admin/newsletter";

/** Sanitise both bodies at the save boundary, exactly as Content assets does. */
function clean(draft: CampaignDraft): CampaignDraft {
  return {
    ...draft,
    subject: draft.subject.trim(),
    preheader: draft.preheader.trim(),
    subject_ar: draft.subject_ar.trim(),
    preheader_ar: draft.preheader_ar.trim(),
    body: sanitizeEmailBody(draft.body, { features: true }),
    body_ar: sanitizeEmailBody(draft.body_ar, { features: true }),
  };
}

/**
 * The featured records for the edition a `want` reader gets, looked up live,
 * and what is no longer published among them.
 */
async function featuresFor(draft: CampaignDraft, want: EmailLocale, brand: EmailBrand) {
  const edition = editionLocale(draft, want);
  const body = edition === "ar" ? draft.body_ar : draft.body;
  const found = await newsletterFeatures([body], edition);
  const blocks = featureBlocksIn(body);
  const missing = blocks.flatMap((b) => missingFeatures(b, found.lookup));
  // The catalogue didn't answer: say so, rather than preview cards as gone.
  const unreachable = unresolvedFeatures(blocks, found.lookup);
  if (unreachable > 0) {
    missing.push({ id: "unreachable", label: `${unreachable} couldn't be looked up just now — the send retries those` });
  }
  return {
    draw: (l: EmailLocale) => featureDrawer(found, brand, l),
    missing,
  };
}

function parseDraft(raw: unknown): { ok: true; draft: CampaignDraft } | { ok: false; result: NewsletterActionResult } {
  const parsed = campaignDraftSchema.safeParse(raw);
  if (parsed.success) return { ok: true, draft: clean(parsed.data) };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { ok: false, result: { status: "error", message: "Fix the highlighted fields.", fieldErrors } };
}

function toRow(draft: CampaignDraft) {
  return {
    subject: draft.subject,
    preheader: draft.preheader,
    body: draft.body,
    subject_ar: draft.subject_ar || null,
    preheader_ar: draft.preheader_ar || null,
    body_ar: draft.body_ar || null,
    audience: draft.audience,
  };
}

// ── Campaigns ────────────────────────────────────────────────────

type Row = Record<string, unknown>;

/** The newest published records a starter layout is filled with. */
async function starterPicks(needs: Partial<Record<keyof StarterPicks, number>>): Promise<StarterPicks> {
  const sb = createSupabasePublicClient();
  const shape = (rows: unknown, name: string) =>
    ((rows ?? []) as Row[]).map((r) => ({ id: String(r.id), name: String(r[name] ?? "") }));
  const none = Promise.resolve({ data: [] as Row[] });
  const [properties, developments, articles] = await Promise.all([
    needs.property
      ? sb
          .from("properties")
          .select("id, title")
          .eq("status", "published")
          .is("deleted_at", null)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(needs.property)
      : none,
    needs.development
      ? sb
          .from("developments")
          .select("id, name")
          .not("published_at", "is", null)
          .order("published_at", { ascending: false })
          .limit(needs.development)
      : none,
    needs.article
      ? sb
          .from("articles")
          .select("id, title")
          .eq("status", "published")
          .is("deleted_at", null)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(needs.article)
      : none,
  ]);
  return {
    property: shape(properties.data, "title"),
    development: shape(developments.data, "name"),
    article: shape(articles.data, "title"),
  };
}

/**
 * A new draft — blank, or a starter layout filled with the newest listings,
 * launches and articles — then straight into the composer.
 */
export async function createCampaign(formData?: FormData): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase env vars are not set.");
  const { supabase, user } = await requireRole(NEWSLETTER_WRITE_ROLES);
  const raw = formData?.get("starter");
  const starter = isStarter(raw) ? raw : "blank";
  const fields = starter === "blank" ? {} : starterDraft(starter, await starterPicks(STARTER_NEEDS[starter]));
  const { data, error } = await supabase
    .from("newsletter_campaigns")
    .insert({
      ...fields,
      ...(fields.body !== undefined ? { body: sanitizeEmailBody(fields.body, { features: true }) } : {}),
      ...(fields.body_ar !== undefined ? { body_ar: sanitizeEmailBody(fields.body_ar, { features: true }) } : {}),
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create the newsletter.");
  await logAudit({
    action: "newsletter.campaign_create",
    target_kind: "newsletter_campaign",
    target_id: data.id,
    after: { starter },
  });
  redirect(`${ADMIN_PATH}/${data.id}`);
}

/** Save the composer's fields. Only a draft or a scheduled campaign can change. */
export async function saveCampaign(id: string, raw: unknown): Promise<NewsletterActionResult> {
  const { supabase, user } = await requireRole(NEWSLETTER_WRITE_ROLES);
  const parsed = parseDraft(raw);
  if (!parsed.ok) return parsed.result;
  const { data, error } = await supabase
    .from("newsletter_campaigns")
    .update({ ...toRow(parsed.draft), updated_by: user.id })
    .eq("id", id)
    .in("status", ["draft", "scheduled"])
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "This newsletter has already gone out, so it can't be edited." };
  revalidatePath("/admin/newsletter");
  return { status: "ok", message: "Saved." };
}

export type CampaignPreview = {
  email: RenderedEmail;
  problems: Record<string, string>;
  /** Featured records in the previewed edition that are no longer published — left out, not blocking. */
  missing: { id: string; label: string }[];
};

/** Unsaved fields, rendered as a subscriber in `locale` would receive them. */
export async function previewCampaign(raw: unknown, locale: "en" | "ar"): Promise<CampaignPreview | null> {
  await requireRole(STAFF_ROLES);
  const parsed = parseDraft(raw);
  if (!parsed.ok) return null;
  const brand = await readEmailBrand();
  const features = await featuresFor(parsed.draft, locale, brand);
  const email = renderNewsletter(parsed.draft, {
    brand,
    locale,
    unsubscribeUrl: `${emailSiteUrl()}${locale === "ar" ? "/ar" : ""}/newsletter/unsubscribe/preview`,
    features: features.draw,
  });
  return { email, problems: campaignProblems(parsed.draft), missing: features.missing };
}

/** One copy to the signed-in staff member, in `locale`. */
export async function sendCampaignTest(raw: unknown, locale: "en" | "ar"): Promise<NewsletterActionResult> {
  const { user } = await requireRole(NEWSLETTER_WRITE_ROLES);
  if (!user.email) return { status: "error", message: "Your account has no email address." };
  const parsed = parseDraft(raw);
  if (!parsed.ok) return parsed.result;
  const problems = campaignProblems(parsed.draft);
  if (problems.subject || problems.body) {
    return { status: "error", message: "Write a subject and the newsletter before sending a test.", fieldErrors: problems };
  }
  const brand = await readEmailBrand();
  const features = await featuresFor(parsed.draft, locale, brand);
  const email = renderNewsletter(parsed.draft, {
    brand,
    locale,
    // A test must not carry a working unsubscribe link for anyone.
    unsubscribeUrl: `${emailSiteUrl()}${locale === "ar" ? "/ar" : ""}/newsletter/unsubscribe/test`,
    features: features.draw,
  });
  const result = await sendEmail({
    to: user.email,
    subject: `[Test] ${email.subject}`,
    text: email.text,
    html: email.html,
  });
  if (result.status === "ok") {
    return { status: "ok", message: `Test sent to ${user.email}${email.locale === "ar" ? " (Arabic edition)" : ""}.` };
  }
  if (result.status === "skipped") {
    return { status: "error", message: `Email isn't configured here (${result.reason}), so nothing was sent.` };
  }
  return { status: "error", message: result.message };
}

async function loadSendable(id: string, raw: unknown) {
  const parsed = parseDraft(raw);
  if (!parsed.ok) return { error: parsed.result } as const;
  const problems = campaignProblems(parsed.draft);
  if (Object.keys(problems).length > 0) {
    return {
      error: { status: "error", message: "Fix the highlighted fields before sending.", fieldErrors: problems } as NewsletterActionResult,
    } as const;
  }
  return { draft: parsed.draft } as const;
}

/**
 * Save, snapshot the audience and start sending. The first batches go out
 * here; the minute cron sends the rest.
 */
export async function sendCampaignNow(id: string, raw: unknown): Promise<NewsletterActionResult> {
  const { supabase, user } = await requireRole(NEWSLETTER_SEND_ROLES);
  const loaded = await loadSendable(id, raw);
  if ("error" in loaded) return loaded.error!;

  const saved = await supabase
    .from("newsletter_campaigns")
    .update({ ...toRow(loaded.draft), updated_by: user.id, sent_by: user.id })
    .eq("id", id)
    .in("status", ["draft", "scheduled"])
    .select("id")
    .maybeSingle();
  if (saved.error) return { status: "error", message: saved.error.message };
  if (!saved.data) return { status: "error", message: "This newsletter has already been sent." };

  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "The sender isn't configured (no service role)." };
  const count = await startCampaign(id, admin);
  if (count === null) return { status: "error", message: "This newsletter has already been sent." };

  await logAudit({
    action: "newsletter.campaign_send",
    target_kind: "newsletter_campaign",
    target_id: id,
    after: { audience: loaded.draft.audience, recipients: count },
  });

  if (count > 0) {
    // A head start so a small list is done before the page reloads; the cron
    // carries anything left.
    await drainNewsletterQueue({ client: admin, maxBatches: 3, deadlineMs: 20_000 });
  }
  await finishCampaigns(admin);
  revalidatePath("/admin/newsletter");
  revalidatePath(`/admin/newsletter/${id}`);
  return {
    status: "ok",
    message: count === 0 ? "Nobody matched this audience, so nothing was sent." : `Sending to ${count} subscriber${count === 1 ? "" : "s"}.`,
  };
}

/** Save and schedule. The minute cron starts it when the time comes. */
export async function scheduleCampaign(id: string, raw: unknown, whenIso: string): Promise<NewsletterActionResult> {
  const { supabase, user } = await requireRole(NEWSLETTER_SEND_ROLES);
  const loaded = await loadSendable(id, raw);
  if ("error" in loaded) return loaded.error!;
  const when = new Date(whenIso);
  if (Number.isNaN(when.getTime())) return { status: "error", message: "Pick a date and time." };
  if (when.getTime() < Date.now() + 2 * 60_000) {
    return { status: "error", message: "Pick a time at least a few minutes from now — or send it now." };
  }
  const { data, error } = await supabase
    .from("newsletter_campaigns")
    .update({
      ...toRow(loaded.draft),
      status: "scheduled",
      scheduled_at: when.toISOString(),
      updated_by: user.id,
      sent_by: user.id,
    })
    .eq("id", id)
    .in("status", ["draft", "scheduled"])
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "This newsletter has already been sent." };
  await logAudit({
    action: "newsletter.campaign_schedule",
    target_kind: "newsletter_campaign",
    target_id: id,
    after: { scheduled_at: when.toISOString(), audience: loaded.draft.audience },
  });
  revalidatePath("/admin/newsletter");
  revalidatePath(`/admin/newsletter/${id}`);
  return { status: "ok", message: "Scheduled." };
}

/** A scheduled campaign back to a draft. */
export async function unscheduleCampaign(id: string): Promise<NewsletterActionResult> {
  const { supabase, user } = await requireRole(NEWSLETTER_SEND_ROLES);
  const { data, error } = await supabase
    .from("newsletter_campaigns")
    .update({ status: "draft", scheduled_at: null, updated_by: user.id })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "It isn't scheduled any more — it may already be sending." };
  await logAudit({ action: "newsletter.campaign_unschedule", target_kind: "newsletter_campaign", target_id: id });
  revalidatePath("/admin/newsletter");
  revalidatePath(`/admin/newsletter/${id}`);
  return { status: "ok", message: "Back to a draft — nothing will send." };
}

/** Delete a draft. A sent campaign stays, as the record of what went out. */
export async function deleteCampaign(id: string): Promise<NewsletterActionResult> {
  const { supabase } = await requireRole(NEWSLETTER_WRITE_ROLES);
  const { data, error } = await supabase
    .from("newsletter_campaigns")
    .delete()
    .eq("id", id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Only a draft can be deleted." };
  await logAudit({ action: "newsletter.campaign_delete", target_kind: "newsletter_campaign", target_id: id });
  revalidatePath("/admin/newsletter");
  redirect(ADMIN_PATH);
}

/** A new draft with this one's subject, body, Arabic edition and audience. */
export async function duplicateCampaign(id: string): Promise<void> {
  const { supabase, user } = await requireRole(NEWSLETTER_WRITE_ROLES);
  const { data: source, error } = await supabase
    .from("newsletter_campaigns")
    .select("subject, preheader, body, subject_ar, preheader_ar, body_ar, audience")
    .eq("id", id)
    .single();
  if (error || !source) throw new Error(error?.message ?? "Newsletter not found.");
  const { data, error: insertError } = await supabase
    .from("newsletter_campaigns")
    .insert({ ...source, created_by: user.id, updated_by: user.id })
    .select("id")
    .single();
  if (insertError || !data) throw new Error(insertError?.message ?? "Could not copy the newsletter.");
  await logAudit({
    action: "newsletter.campaign_duplicate",
    target_kind: "newsletter_campaign",
    target_id: data.id,
    after: { from: id },
  });
  redirect(`${ADMIN_PATH}/${data.id}`);
}

// ── Subscribers ──────────────────────────────────────────────────

/** Skip anyone whose last confirmation went out within this window. */
const RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Re-send the confirmation email to pending subscribers — the given ones, or
 * every pending address. A fresh token each time (the old link's 14 days may
 * have run out); anyone mailed in the last day is skipped.
 */
export async function resendConfirmations(ids: string[] | "all"): Promise<NewsletterActionResult> {
  const { supabase } = await requireRole(NEWSLETTER_SEND_ROLES);
  let query = supabase
    .from("newsletter_subscribers")
    .select("id, email, locale, confirmation_sent_at")
    .eq("status", "pending")
    .limit(500);
  if (ids !== "all") query = query.in("id", ids.slice(0, 500));
  const { data, error } = await query;
  if (error) return { status: "error", message: error.message };

  const cutoff = Date.now() - RESEND_COOLDOWN_MS;
  const due = (data ?? []).filter(
    (s) => !s.confirmation_sent_at || new Date(s.confirmation_sent_at).getTime() < cutoff,
  );
  let sent = 0;
  let failed = 0;
  let skippedReason: string | null = null;
  for (const s of due) {
    // Mail first, then store the new token: if the send fails, the link the
    // subscriber already has keeps working.
    const token = generateConfirmationToken();
    const locale = s.locale === "ar" ? "ar" : "en";
    const confirmUrl = `${emailSiteUrl()}/newsletter/confirm/${token}`;
    const template = await newsletterConfirmationEmail({ email: s.email, confirmUrl }, locale);
    const result = await sendEmail({ to: s.email, subject: template.subject, text: template.text, html: template.html });
    if (result.status === "skipped") {
      skippedReason = result.reason;
      continue;
    }
    if (result.status === "error") {
      failed += 1;
      continue;
    }
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("newsletter_subscribers")
      .update({ confirmation_token: token, subscribed_at: now, confirmation_sent_at: now })
      .eq("id", s.id)
      .eq("status", "pending");
    if (updateError) failed += 1;
    else sent += 1;
  }

  await logAudit({
    action: "newsletter.confirmation_resend",
    target_kind: "newsletter_subscriber",
    target_id: ids === "all" ? "all-pending" : ids.length === 1 ? ids[0]! : `${ids.length} subscribers`,
    after: { due: due.length, sent, failed, cooled_down: (data?.length ?? 0) - due.length },
  });
  revalidatePath("/admin/newsletter/subscribers");

  const cooled = (data?.length ?? 0) - due.length;
  const tail = cooled > 0 ? ` ${cooled} skipped — already mailed in the last 24 hours.` : "";
  if (skippedReason) {
    return { status: "error", message: `Email isn't configured here (${skippedReason}), so nothing was sent.${tail}` };
  }
  if (due.length === 0) return { status: "ok", message: `Nothing to send.${tail}` };
  if (failed > 0) return { status: "error", message: `Sent ${sent}, ${failed} failed.${tail}` };
  return { status: "ok", message: `Confirmation re-sent to ${sent} subscriber${sent === 1 ? "" : "s"}.${tail}` };
}

/** Unsubscribe someone who asked by other means (a reply, a call). */
export async function unsubscribeSubscriber(id: string): Promise<NewsletterActionResult> {
  const { supabase } = await requireRole(NEWSLETTER_SEND_ROLES);
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "unsubscribed")
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Already unsubscribed." };
  await logAudit({ action: "newsletter.subscriber_unsubscribe", target_kind: "newsletter_subscriber", target_id: id });
  revalidatePath("/admin/newsletter/subscribers");
  return { status: "ok", message: "Unsubscribed. They won't receive newsletters." };
}
