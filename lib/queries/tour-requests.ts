/**
 * Tour requests — the "Schedule viewing" button on /p/[slug] writes here.
 *
 * Distinct from `viewings` (confirmed slots booked with a specific agent).
 * tour_requests captures *interest* + the requested window before any
 * staff assignment.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { s8 } from "@/lib/supabase/sprint-8";
import type {
  TourRequestRow,
  TourRequestStatus,
} from "@/lib/types/sprint-8";

export type TourRequestEntry = {
  id: string;
  property_id: string;
  property_reference: string | null;
  property_title: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_window: string | null;
  message: string | null;
  status: TourRequestStatus;
  scheduled_at: string | null;
  created_at: string;
};

export type CreateTourRequestInput = {
  property_id: string;
  account_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_window?: string | null;
  message?: string | null;
};

/** Insert a tour request. Returns the new row id, or null on failure. */
export async function createTourRequest(
  input: CreateTourRequestInput,
): Promise<string | null> {
  if (!isSupabaseConfigured || !input.property_id) return null;
  try {
    const sb = await createSupabaseServerClient();
    const { data, error } = await s8(sb)
      .from("tour_requests")
      .insert({
        property_id: input.property_id,
        account_id: input.account_id ?? null,
        full_name: input.full_name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        preferred_window: input.preferred_window ?? null,
        message: input.message ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error) console.error("[createTourRequest]", error);
      return null;
    }
    return (data as { id: string }).id;
  } catch (e) {
    console.error("[createTourRequest]", e);
    return null;
  }
}

/** Tour requests for a given account, newest first. */
export async function listTourRequests(
  userId: string,
): Promise<TourRequestEntry[]> {
  if (!isSupabaseConfigured || !userId) return [];
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await s8(sb)
      .from("tour_requests")
      .select(
        "id, property_id, full_name, email, phone, preferred_window, message, status, scheduled_at, created_at, property:property_id(reference, title)",
      )
      .eq("account_id", userId)
      .order("created_at", { ascending: false });
    if (!data) return [];
    return (data as RawTourWithProperty[]).map((r) => {
      const prop = Array.isArray(r.property) ? r.property[0] : r.property;
      return {
        id: r.id,
        property_id: r.property_id,
        property_reference: prop?.reference ?? null,
        property_title: prop?.title ?? null,
        full_name: r.full_name,
        email: r.email,
        phone: r.phone,
        preferred_window: r.preferred_window,
        message: r.message,
        status: r.status,
        scheduled_at: r.scheduled_at,
        created_at: r.created_at,
      };
    });
  } catch {
    return [];
  }
}

type RawTourWithProperty = TourRequestRow & {
  property:
    | { reference: string; title: string }
    | { reference: string; title: string }[]
    | null;
};
