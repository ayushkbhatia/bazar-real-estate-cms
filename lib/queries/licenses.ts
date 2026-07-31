/**
 * Licenses (ORN, BRN, trakheesi, RERA, DMT).
 *
 * /admin/settings/compliance lists rows + flags expirations < 30 days as
 * 'expiring_soon'. Status is DERIVED from `expires_at` on every read — a cron
 * used to roll the stored column forward, but deriving it cannot go stale and
 * needs no scheduled job.
 *
 * BRN gating: the publish-blocking check in Sprint 7c reads the assigned
 * agent's BRN here and refuses publish when status != 'active'.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  LicenseHolderKind,
  LicenseKind,
  LicenseRow,
  LicenseStatus,
} from "@/lib/types/sprint-8";

export type LicenseDisplay = {
  id: string;
  kind: LicenseKind;
  holder_kind: LicenseHolderKind;
  holder_id: string | null;
  holder_name: string | null;
  number: string;
  issued_at: string | null;
  expires_at: string;
  status: LicenseStatus;
  days_to_expiry: number;
  notes: string | null;
};

/** All licenses, sorted by closest expiry first. */
export async function listLicenses(): Promise<LicenseDisplay[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("licenses")
      .select(
        "id, kind, holder_kind, holder_id, number, issued_at, expires_at, status, notes",
      )
      .order("expires_at", { ascending: true });
    if (!data) return [];

    // Resolve holder names for 'staff' rows in one batched read.
    const staffIds = (data as LicenseRow[])
      .filter((l) => l.holder_kind === "staff" && l.holder_id)
      .map((l) => l.holder_id as string);
    let nameMap = new Map<string, string>();
    if (staffIds.length > 0) {
      const { data: staff } = await sb
        .from("staff")
        .select("user_id, display_name")
        .in("user_id", staffIds);
      nameMap = new Map(
        (staff ?? []).map((s) => [s.user_id, s.display_name]),
      );
    }
    return (data as LicenseRow[]).map((l) => {
      const exp = new Date(l.expires_at);
      const now = new Date();
      const days = Math.ceil(
        (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        id: l.id,
        kind: l.kind,
        holder_kind: l.holder_kind,
        holder_id: l.holder_id,
        holder_name:
          l.holder_kind === "staff" && l.holder_id
            ? nameMap.get(l.holder_id) ?? null
            : l.holder_kind === "firm"
              ? "Bazar (firm)"
              : null,
        number: l.number,
        issued_at: l.issued_at,
        expires_at: l.expires_at,
        // Derived, not the stored column: a cron used to roll `status`
        // forward and it no longer exists, so a licence would otherwise read
        // "active" for ever after it expired.
        status: deriveStatus(l.expires_at as string),
        days_to_expiry: days,
        notes: l.notes,
      };
    });
  } catch {
    return [];
  }
}

/** Latest BRN for a given staff user. Returns null if no active BRN. */
export async function getActiveBrn(staffUserId: string): Promise<LicenseRow | null> {
  if (!isSupabaseConfigured || !staffUserId) return null;
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("licenses")
      .select("*")
      .eq("kind", "brn")
      .eq("holder_kind", "staff")
      .eq("holder_id", staffUserId)
      .eq("status", "active")
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as LicenseRow | null) ?? null;
  } catch {
    return null;
  }
}

/** Upsert a license row. Admin-only via RLS. */
export async function upsertLicense(input: {
  id?: string;
  kind: LicenseKind;
  holder_kind: LicenseHolderKind;
  holder_id?: string | null;
  number: string;
  issued_at?: string | null;
  expires_at: string;
  file_id?: string | null;
  notes?: string | null;
}): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const sb = await createSupabaseServerClient();
    const payload = {
      kind: input.kind,
      holder_kind: input.holder_kind,
      holder_id: input.holder_id ?? null,
      number: input.number,
      issued_at: input.issued_at ?? null,
      expires_at: input.expires_at,
      file_id: input.file_id ?? null,
      notes: input.notes ?? null,
      status: deriveStatus(input.expires_at),
      ...(input.id ? { id: input.id } : {}),
    };
    const { error } = await sb
      .from("licenses")
      .upsert(payload, { onConflict: "kind,number" });
    if (error) {
      console.error("[upsertLicense]", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[upsertLicense]", e);
    return false;
  }
}

function deriveStatus(expiresAt: string): LicenseStatus {
  const days =
    (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return "expired";
  if (days < 30) return "expiring_soon";
  return "active";
}
