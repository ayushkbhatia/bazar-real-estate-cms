import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/db/types";
import type { DealStage } from "@/lib/deals";

export type DealListRow = {
  id: string;
  property_id: string;
  buyer_account_id: string;
  lead_agent_id: string | null;
  price_aed: number;
  advisory_fee_aed: number;
  stage: DealStage;
  mou_signed_at: string | null;
  noc_obtained_at: string | null;
  transferred_at: string | null;
  created_at: string;
  updated_at: string;
  properties: {
    reference: string;
    title: string;
    slug: string;
  } | null;
  buyer: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  agent: { display_name: string; slug: string } | null;
};

const LIST_FIELDS = `
  id, property_id, buyer_account_id, lead_agent_id,
  price_aed, advisory_fee_aed, stage,
  mou_signed_at, noc_obtained_at, transferred_at,
  created_at, updated_at,
  properties:property_id(reference, title, slug),
  buyer:buyer_account_id(first_name, last_name),
  agent:lead_agent_id(display_name, slug)
`;

type ListFilter = {
  stage?: DealStage | null;
  search?: string | null;
  limit?: number;
  offset?: number;
};

export async function listDeals(filter: ListFilter = {}): Promise<{
  rows: DealListRow[];
  total: number;
}> {
  if (!isSupabaseConfigured) return { rows: [], total: 0 };
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("deals")
    .select(LIST_FIELDS, { count: "exact" })
    .is("deleted_at", null);

  if (filter.stage) query = query.eq("stage", filter.stage);

  query = query
    .order("created_at", { ascending: false })
    .range(filter.offset ?? 0, (filter.offset ?? 0) + (filter.limit ?? 50) - 1);

  const { data, error, count } = await query;
  if (error || !data) return { rows: [], total: 0 };

  const rows = data as unknown as DealListRow[];

  // Search post-filter — keep the query SQL-simple; deals lists are short.
  let filtered = rows;
  if (filter.search && filter.search.trim()) {
    const term = filter.search.trim().toLowerCase();
    filtered = rows.filter((r) => {
      const ref = r.properties?.reference?.toLowerCase() ?? "";
      const title = r.properties?.title?.toLowerCase() ?? "";
      const buyer = [r.buyer?.first_name, r.buyer?.last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return ref.includes(term) || title.includes(term) || buyer.includes(term);
    });
  }

  return { rows: filtered, total: count ?? 0 };
}

export type DealDetail = DealListRow & {
  seller_account_id: string | null;
  commission_aed: number | null;
  notes: string | null;
  enquiry_id: string | null;
  seller: { first_name: string | null; last_name: string | null } | null;
  enquiry: {
    id: string;
    name: string;
    status: Database["public"]["Enums"]["enquiry_status"];
  } | null;
};

export async function getDealById(id: string): Promise<DealDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("deals")
    .select(
      `${LIST_FIELDS},
       seller_account_id, commission_aed, notes, enquiry_id,
       seller:seller_account_id(first_name, last_name),
       enquiry:enquiry_id(id, name, status)`,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as DealDetail;
}

export async function countDealsByStage(): Promise<
  Record<DealStage | "all", number>
> {
  const empty: Record<DealStage | "all", number> = {
    all: 0,
    mou: 0,
    deposit: 0,
    noc_pending: 0,
    dld_pending: 0,
    transferred: 0,
  };
  if (!isSupabaseConfigured) return empty;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("deals")
    .select("stage")
    .is("deleted_at", null);
  if (error || !data) return empty;

  const out = { ...empty };
  for (const row of data) {
    out.all += 1;
    out[row.stage as DealStage] += 1;
  }
  return out;
}
