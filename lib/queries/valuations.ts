import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/db/types";

export type ValuationStatus =
  Database["public"]["Enums"]["valuation_status"];

export type ValuationListRow = {
  id: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string | null;
  property_type: Database["public"]["Enums"]["property_type"];
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  building_name: string | null;
  address_line: string | null;
  area_id: string | null;
  area_name: string | null;
  estimate_low_aed: string | null;
  estimate_mid_aed: string | null;
  estimate_high_aed: string | null;
  status: ValuationStatus;
  assigned_advisor_id: string | null;
  advisor_display_name: string | null;
  created_at: string;
  reviewed_at: string | null;
  sent_at: string | null;
};

const LIST_FIELDS =
  "id, owner_name, owner_email, owner_phone, property_type, beds, baths, built_up_ft2, building_name, address_line, area_id, estimate_low_aed, estimate_mid_aed, estimate_high_aed, status, assigned_advisor_id, created_at, reviewed_at, sent_at, areas:area_id(name), staff:assigned_advisor_id(display_name)";

const DETAIL_FIELDS =
  "id, account_id, owner_name, owner_email, owner_phone, marketing_opt_in, property_type, beds, baths, built_up_ft2, floor, building_name, address_line, area_id, unit_number, condition, upgrades, furnishing, view_description, tenancy, mortgage_state, estimate_low_aed, estimate_mid_aed, estimate_high_aed, estimate_basis, status, assigned_advisor_id, advisor_estimate_aed, advisor_notes, reviewed_at, sent_at, created_at, updated_at, areas:area_id(name, slug), staff:assigned_advisor_id(display_name, user_id)";

export async function listValuationRequests(opts: {
  status?: ValuationStatus | "all";
  limit?: number;
} = {}): Promise<ValuationListRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("valuation_requests")
    .select(LIST_FIELDS)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((r) => {
    const row = r as unknown as Record<string, unknown> & {
      areas?: { name: string } | null;
      staff?: { display_name: string | null } | null;
    };
    return {
      ...(row as object),
      area_name: row.areas?.name ?? null,
      advisor_display_name: row.staff?.display_name ?? null,
    } as ValuationListRow;
  });
}

export type ValuationDetail = Awaited<
  ReturnType<typeof getValuationRequest>
>;

export async function getValuationRequest(id: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("valuation_requests")
    .select(DETAIL_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as Record<string, unknown> & {
    areas?: { name: string; slug: string } | null;
    staff?: { display_name: string | null; user_id: string } | null;
  };
  return {
    ...(row as object),
    area_name: row.areas?.name ?? null,
    area_slug: row.areas?.slug ?? null,
    advisor_display_name: row.staff?.display_name ?? null,
    advisor_user_id: row.staff?.user_id ?? null,
  } as unknown as Record<string, unknown> & {
    area_name: string | null;
    area_slug: string | null;
    advisor_display_name: string | null;
    advisor_user_id: string | null;
  };
}
