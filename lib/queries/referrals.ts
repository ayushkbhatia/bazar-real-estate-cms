/**
 * Referrals — readable from /account/referrals and admin reports.
 *
 * The referral code is stable per referrer (auto-issued on first request).
 * The referee_account_id binds when an invitee signs up via the code.
 * Payout AED is set by admin when status transitions to 'paid'.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { ReferralRow, ReferralStatus } from "@/lib/types/sprint-8";

export type ReferralEntry = {
  id: string;
  code: string;
  referee_name: string | null;
  status: ReferralStatus;
  payout_amount_aed: number;
  signed_up_at: string | null;
  first_deal_at: string | null;
  paid_at: string | null;
  created_at: string;
};

/** Get (or create) the stable referral code for the signed-in user.
 *  Returns null when not configured / not signed in. Empty string means
 *  the user has no referrals row yet — caller decides whether to issue. */
export async function getReferralCode(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured || !userId) return null;
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("referrals")
      .select("code")
      .eq("referrer_account_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as { code: string } | null)?.code ?? "";
  } catch {
    return null;
  }
}

/** Issue a deterministic-but-collision-resistant new code if the user
 *  doesn't have one. Returns the code. */
export async function ensureReferralCode(userId: string): Promise<string> {
  if (!isSupabaseConfigured || !userId) return "";
  try {
    const existing = await getReferralCode(userId);
    if (existing) return existing;
    const code = generateCode(userId);
    const sb = await createSupabaseServerClient();
    const { error } = await sb
      .from("referrals")
      .insert({
        code,
        referrer_account_id: userId,
        status: "pending",
      });
    if (error) {
      console.error("[ensureReferralCode]", error);
      return "";
    }
    return code;
  } catch (e) {
    console.error("[ensureReferralCode]", e);
    return "";
  }
}

/** All referrals for a user. Ordered newest first. */
export async function listReferrals(userId: string): Promise<ReferralEntry[]> {
  if (!isSupabaseConfigured || !userId) return [];
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("referrals")
      .select(
        "id, code, status, payout_amount_aed, signed_up_at, first_deal_at, paid_at, created_at, referee:referee_account_id(first_name, last_name)",
      )
      .eq("referrer_account_id", userId)
      .order("created_at", { ascending: false });
    if (!data) return [];
    // referrals has two FKs into accounts (referrer_account_id and
    // referee_account_id), so supabase-js cannot infer the embed and widens
    // `referee` to SelectQueryError. The `referee:referee_account_id(...)`
    // form names the column explicitly and is accepted by PostgREST, so cast
    // through `unknown`.
    return (data as unknown as RawReferralWithReferee[]).map(toReferralEntry);
  } catch {
    return [];
  }
}

/** Exactly the columns the listReferrals select fetches, plus the embedded
 *  referee. Narrower than ReferralRow on purpose: the query omits
 *  referrer_account_id, referee_account_id, notes, and updated_at, and
 *  toReferralEntry never reads them. */
type RawReferralWithReferee = Pick<
  ReferralRow,
  | "id"
  | "code"
  | "status"
  | "payout_amount_aed"
  | "signed_up_at"
  | "first_deal_at"
  | "paid_at"
  | "created_at"
> & {
  referee:
    | { first_name: string | null; last_name: string | null }
    | { first_name: string | null; last_name: string | null }[]
    | null;
};

function toReferralEntry(r: RawReferralWithReferee): ReferralEntry {
  const ref = Array.isArray(r.referee) ? r.referee[0] : r.referee;
  const name =
    ref && (ref.first_name || ref.last_name)
      ? `${ref.first_name ?? ""} ${ref.last_name ?? ""}`.trim()
      : null;
  return {
    id: r.id,
    code: r.code,
    referee_name: name,
    status: r.status,
    payout_amount_aed: r.payout_amount_aed,
    signed_up_at: r.signed_up_at,
    first_deal_at: r.first_deal_at,
    paid_at: r.paid_at,
    created_at: r.created_at,
  };
}

/** 6-char base32 from sha-like userId hash. Stable per user. */
function generateCode(userId: string): string {
  // Hash a few characters of the user id + 'bz' salt — enough entropy
  // for ~100k users without collision (we're at v1).
  const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const seed = `bz_${userId}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHA[h % ALPHA.length];
    h = Math.floor(h / ALPHA.length) + ((h * 7) >>> 0);
  }
  return out;
}
