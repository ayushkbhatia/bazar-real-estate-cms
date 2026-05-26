/**
 * T1-E: Short-lived OTP issue + verify helpers.
 *
 * Codes are 6-digit numeric, stored as HMAC-SHA256(code | identifier)
 * because we only ever need to compare. We never persist the raw code.
 *
 * Storage: `otp_codes` (migration 0032). Until the migration is applied to
 * the remote DB, `issueOtp()` will throw — wrap callers in try/catch and
 * surface a friendly "service unavailable" so dev/preview without DB still
 * loads the rest of the page.
 */

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { s8 } from "@/lib/supabase/sprint-8";
import { env } from "@/lib/env";

export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;

export type OtpChannel = "email" | "whatsapp";
export type OtpPurpose = "valuation_lead";

function hashCode(code: string, identifier: string): string {
  // Use the service-role key (or a build-time fallback) as the HMAC secret.
  // Anyone who could read the table also has service-role anyway, so this
  // is defense-in-depth, not a single-line-of-defence secret.
  const secret = env.SUPABASE_SERVICE_ROLE_KEY ?? "bazar-otp-dev";
  return crypto
    .createHmac("sha256", secret)
    .update(`${code}|${identifier}|otp-v1`)
    .digest("hex");
}

function generateNumericCode(): string {
  // 6-digit; leading-zero preserved
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

/**
 * Issue a fresh OTP. Returns the code in the result for the calling route
 * to dispatch via Resend / WhatsApp. We deliberately surface the code from
 * the function (instead of dispatching here) so the caller picks the
 * transport — keeps this module pure.
 */
export async function issueOtp(opts: {
  identifier: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  ip?: string;
  user_agent?: string;
}): Promise<{ code: string; expires_at: string }> {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("OTP service unavailable: Supabase admin client not configured.");
  }
  const code = generateNumericCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  await s8(supabase)
    .from("otp_codes")
    .insert({
      identifier: opts.identifier.toLowerCase().trim(),
      channel: opts.channel,
      code_hash: hashCode(code, opts.identifier.toLowerCase().trim()),
      purpose: opts.purpose,
      expires_at: expiresAt,
      ip: opts.ip ?? null,
      user_agent: opts.user_agent ?? null,
    });

  return { code, expires_at: expiresAt };
}

/**
 * Verify an OTP. Returns true on success and consumes the code (so it
 * can't be reused). Returns false on miss / expired / locked out.
 */
export async function verifyOtp(opts: {
  identifier: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<{ ok: boolean; reason?: "expired" | "wrong" | "locked" | "not_found" }> {
  const identifier = opts.identifier.toLowerCase().trim();
  const expected = hashCode(opts.code, identifier);
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, reason: "not_found" };

  const { data: rows } = await s8(supabase)
    .from("otp_codes")
    .select("id, code_hash, attempts, max_attempts, expires_at, consumed_at")
    .eq("identifier", identifier)
    .eq("purpose", opts.purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  type Row = {
    id: string;
    code_hash: string;
    attempts: number;
    max_attempts: number;
    expires_at: string;
    consumed_at: string | null;
  };
  const row = (rows as Row[] | null)?.[0];

  if (!row) return { ok: false, reason: "not_found" };
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, reason: "expired" };
  }
  if (row.attempts >= row.max_attempts) {
    return { ok: false, reason: "locked" };
  }

  if (row.code_hash !== expected) {
    await s8(supabase)
      .from("otp_codes")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return { ok: false, reason: "wrong" };
  }

  // Success — mark consumed atomically.
  await s8(supabase)
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  return { ok: true };
}
