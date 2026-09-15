import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import type { EmailContext } from "./email-html";
import {
  DEFAULT_EMAIL_BRAND,
  resolveEmailBrand,
  type EmailBrand,
} from "./email-brand";
import {
  SYSTEM_ASSETS,
  missingRequiredTokens,
  type SystemAssetKey,
} from "./system";
import {
  renderSystemEmail,
  type RenderedEmail,
  type SystemEmailCopy,
} from "./system-render";

/**
 * A published row → copy fit to send, or null. Shared by the send path and
 * the gallery, so the gallery can never show an override the send path would
 * refuse.
 */
export function usableCopy(
  key: SystemAssetKey,
  row: { subject: string | null; body: string; body_format: string },
): SystemEmailCopy | null {
  if (!row.subject || !row.body.trim()) return null;
  const copy: SystemEmailCopy = {
    subject: row.subject,
    body: row.body,
    format: row.body_format === "html" ? "html" : "text",
  };
  // The editor refuses to publish without these; a row that has them missing
  // anyway (a direct write, an older row) is not trusted to send.
  const missing = missingRequiredTokens(key, copy);
  if (missing.length > 0) {
    console.error(
      `[systemEmail:${key}] published override is missing ${missing.join(", ")}; using the built-in email`,
    );
    return null;
  }
  return copy;
}

/**
 * Read the published override for a system email, or nothing.
 *
 * SERVICE ROLE, deliberately. RLS on content_assets grants SELECT to staff
 * only — correct, because unpublished assets are internal drafting. But most
 * system emails are triggered by an anonymous visitor submitting a public
 * form, or by a cron with no session at all. The cookie-aware client would
 * return nothing on every one of those paths and the override would appear to
 * be ignored. Reading past RLS here exposes nothing new: the row is copy that
 * is about to be emailed to the person triggering it.
 *
 * No cache. One indexed single-row read per outbound transactional email is
 * not the egress worth optimising, and a stale cache would mean an editor
 * publishes a correction and watches the old wording keep sending.
 */
export async function readPublishedCopy(
  key: SystemAssetKey,
): Promise<SystemEmailCopy | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createAdminClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("content_assets")
      .select("subject, body, body_format")
      .eq("system_key", key)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? usableCopy(key, data) : null;
  } catch (error) {
    // A failed read must not stop the email. Fall through to the built-in.
    console.error(`[systemEmail:${key}]`, error);
    return null;
  }
}

/**
 * The email design from /admin/content-assets/design. Service role for the
 * same reason as above; any failure is the default design, never a failed
 * send.
 */
export async function readEmailBrand(): Promise<EmailBrand> {
  if (!isSupabaseConfigured) return DEFAULT_EMAIL_BRAND;
  const supabase = createAdminClient();
  if (!supabase) return DEFAULT_EMAIL_BRAND;
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("email_branding")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return resolveEmailBrand(data?.email_branding ?? null);
  } catch (error) {
    console.error("[emailBrand]", error);
    return DEFAULT_EMAIL_BRAND;
  }
}

/**
 * Walk the fallback chain: this email's own published copy, then the copy of
 * the email it falls back to, and so on. Returns the first found.
 */
export async function resolvePublishedCopy(
  key: SystemAssetKey,
): Promise<{ copy: SystemEmailCopy; from: SystemAssetKey } | null> {
  let current: SystemAssetKey | undefined = key;
  const seen = new Set<SystemAssetKey>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const copy = await readPublishedCopy(current);
    if (copy) return { copy, from: current };
    current = SYSTEM_ASSETS[current].fallsBackTo;
  }
  return null;
}

/**
 * The seam every transactional send goes through.
 *
 * `fallback` is the built-in template, passed as a function of the brand so
 * its arguments — which the override does not need — are only assembled when
 * it is actually used. It runs whenever there is no published override, which
 * is the state every system email ships in: migrations 0117 and 0127 seed the
 * rows as drafts, so applying them changes not one sent email.
 */
export async function resolveSystemEmail(
  key: SystemAssetKey,
  ctx: EmailContext,
  fallback: (brand: EmailBrand) => RenderedEmail,
): Promise<RenderedEmail> {
  const [published, brand] = await Promise.all([
    resolvePublishedCopy(key),
    readEmailBrand(),
  ]);
  if (!published) return fallback(brand);
  const rendered = renderSystemEmail(published.copy, ctx, brand);
  // A published row that renders to an empty subject or body is a worse
  // email than the built-in one. Belt and braces — the editor blocks both.
  if (!rendered.subject || !rendered.text.trim()) {
    console.error(
      `[systemEmail:${key}] published override rendered empty; using ${SYSTEM_ASSETS[key].label} built-in`,
    );
    return fallback(brand);
  }
  return rendered;
}
