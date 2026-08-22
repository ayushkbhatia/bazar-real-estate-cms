import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import type { TokenContext } from "./tokens";
import {
  SYSTEM_ASSETS,
  renderSystemEmail,
  type RenderedEmail,
  type SystemAssetKey,
} from "./system";

/**
 * Read the published override for a system email, or nothing.
 *
 * SERVICE ROLE, deliberately. RLS on content_assets grants SELECT to staff
 * only — correct, because unpublished assets are internal drafting. But three
 * of the four system emails are triggered by an anonymous visitor submitting
 * a public form, and one by a cron with no session at all. The cookie-aware
 * client would return nothing on every one of those paths and the override
 * would appear to be ignored. Reading past RLS here exposes nothing new: the
 * row is copy that is about to be emailed to the person triggering it.
 *
 * No cache. One indexed single-row read per outbound transactional email is
 * not the egress worth optimising, and a stale cache would mean an editor
 * publishes a correction and watches the old wording keep sending.
 */
async function readPublishedCopy(
  key: SystemAssetKey,
): Promise<{ subject: string; body: string } | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createAdminClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("content_assets")
      .select("subject, body")
      .eq("system_key", key)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data?.subject || !data.body.trim()) return null;
    return { subject: data.subject, body: data.body };
  } catch (error) {
    // A failed read must not stop the email. Fall through to the built-in.
    console.error(`[systemEmail:${key}]`, error);
    return null;
  }
}

/**
 * The seam every transactional send goes through.
 *
 * `fallback` is the built-in template from lib/email-templates.ts, passed as
 * a thunk so its arguments — which the override does not need — are only
 * assembled when it is actually used. It runs whenever there is no published
 * override, which is the state the system ships in: migration 0117 seeds all
 * four rows as drafts, so applying it changes not one sent email.
 */
export async function resolveSystemEmail(
  key: SystemAssetKey,
  ctx: TokenContext,
  fallback: () => RenderedEmail,
): Promise<RenderedEmail> {
  const copy = await readPublishedCopy(key);
  if (!copy) return fallback();
  const rendered = renderSystemEmail(copy, ctx);
  // A published row that renders to an empty subject or body is a worse
  // email than the built-in one. Belt and braces — the editor blocks both.
  if (!rendered.subject || !rendered.text.trim()) {
    console.error(
      `[systemEmail:${key}] published override rendered empty; using ${SYSTEM_ASSETS[key].label} built-in`,
    );
    return fallback();
  }
  return rendered;
}
