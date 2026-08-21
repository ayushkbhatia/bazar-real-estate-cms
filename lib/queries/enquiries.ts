import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/db/types";

type EnquiryStatus = Database["public"]["Enums"]["enquiry_status"];
type EnquiryTemperature = Database["public"]["Enums"]["enquiry_temperature"];
type EnquirySource = Database["public"]["Enums"]["enquiry_source"];

export type EnquiryListRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brief_raw: string | null;
  source: EnquirySource;
  status: EnquiryStatus;
  temperature: EnquiryTemperature;
  created_at: string;
  first_response_at: string | null;
  property_id: string | null;
  properties: {
    reference: string;
    title: string;
    slug: string;
  } | null;
  /** Set when the lead came from a development page — e.g. a brochure request. */
  development_id: string | null;
  developments: { name: string; slug: string } | null;
  assigned_agent_id: string | null;
  staff: { display_name: string; slug: string } | null;
  unread_count: number;
  /** Set when an admin archived the lead. Orthogonal to `status`. */
  archived_at: string | null;
  archived_by: string | null;
};

const LIST_FIELDS = `
  id, name, email, phone, brief_raw, source, status, temperature,
  created_at, first_response_at, property_id, development_id, assigned_agent_id,
  archived_at, archived_by,
  properties:property_id(reference, title, slug),
  developments:development_id(name, slug),
  staff:assigned_agent_id(display_name, slug),
  conversations(
    messages(id, direction, read_at)
  )
`;

type ListFilter = {
  status?: EnquiryStatus | null;
  /** 'mine' restricts to the current staff user's assigned leads. */
  scope?: "all" | "mine" | "unassigned";
  temperature?: EnquiryTemperature | null;
  /**
   * Which side of the archive to read. Defaults to the live inbox — an
   * archived lead is out of the working set, so it must not reappear in a
   * scope tab, the Kanban board or a count unless the caller asked for it.
   */
  archived?: boolean;
  limit?: number;
  offset?: number;
};

export async function listEnquiries(filter: ListFilter = {}): Promise<{
  rows: EnquiryListRow[];
  total: number;
}> {
  if (!isSupabaseConfigured) return { rows: [], total: 0 };
  const supabase = await createSupabaseServerClient();
  // Request-cached: the caller almost always resolved the same user already.
  const user = await getCurrentUser();

  let query = supabase
    .from("enquiries")
    .select(LIST_FIELDS, { count: "exact" });

  query = filter.archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);

  if (filter.status) query = query.eq("status", filter.status);
  if (filter.temperature) query = query.eq("temperature", filter.temperature);
  if (filter.scope === "mine" && user)
    query = query.eq("assigned_agent_id", user.id);
  if (filter.scope === "unassigned")
    query = query.is("assigned_agent_id", null);

  // The archive reads as a filing cabinet — most recently filed first, which
  // is also the order its partial index is built in. The live inbox stays on
  // submission order.
  query = query
    .order(filter.archived ? "archived_at" : "created_at", {
      ascending: false,
    })
    .range(
      filter.offset ?? 0,
      (filter.offset ?? 0) + (filter.limit ?? 100) - 1,
    );

  const { data, error, count } = await query;
  if (error || !data) return { rows: [], total: 0 };

  type RawRow = Omit<
    EnquiryListRow,
    "unread_count" | "properties" | "developments" | "staff"
  > & {
    properties: EnquiryListRow["properties"];
    developments: EnquiryListRow["developments"];
    staff: EnquiryListRow["staff"];
    conversations:
      | {
          messages: { id: string; direction: string; read_at: string | null }[];
        }[]
      | null;
  };

  const rows: EnquiryListRow[] = (data as unknown as RawRow[]).map((row) => {
    const messages = row.conversations?.[0]?.messages ?? [];
    const unread_count = messages.filter(
      (m) => m.direction === "inbound" && m.read_at === null,
    ).length;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      brief_raw: row.brief_raw,
      source: row.source,
      status: row.status,
      temperature: row.temperature,
      created_at: row.created_at,
      first_response_at: row.first_response_at,
      property_id: row.property_id,
      properties: row.properties,
      development_id: row.development_id,
      developments: row.developments,
      assigned_agent_id: row.assigned_agent_id,
      staff: row.staff,
      unread_count,
      archived_at: row.archived_at,
      archived_by: row.archived_by,
    };
  });

  return { rows, total: count ?? 0 };
}

export type EnquiryDetail = EnquiryListRow & {
  budget_min: number | null;
  budget_max: number | null;
  timeline: Database["public"]["Enums"]["enquiry_timeline"] | null;
  pre_approved: boolean;
  internal_notes: string | null;
  inferred_constraints: Record<string, unknown> | null;
  closed_at: string | null;
  close_reason: string | null;
  account_id: string | null;
  conversation_id: string | null;
  messages: {
    id: string;
    direction: "inbound" | "outbound";
    author_kind: "lead" | "staff" | "system" | "ai";
    body: string;
    channel: string;
    sent_at: string;
    read_at: string | null;
    author_id: string | null;
  }[];
};

export async function getEnquiryById(
  id: string,
): Promise<EnquiryDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("enquiries")
    .select(
      `id, name, email, phone, brief_raw, source, status, temperature,
       created_at, first_response_at, property_id, development_id,
       assigned_agent_id, archived_at, archived_by,
       budget_min, budget_max, timeline, pre_approved, internal_notes,
       inferred_constraints, closed_at, close_reason, account_id,
       properties:property_id(reference, title, slug),
       developments:development_id(name, slug),
       staff:assigned_agent_id(display_name, slug),
       conversations(id,
         messages(id, direction, author_kind, body, channel, sent_at,
                  read_at, author_id)
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  type RawConv = {
    id: string;
    messages: {
      id: string;
      direction: "inbound" | "outbound";
      author_kind: "lead" | "staff" | "system" | "ai";
      body: string;
      channel: string;
      sent_at: string;
      read_at: string | null;
      author_id: string | null;
    }[];
  };
  const conversation = (
    data as unknown as {
      conversations: RawConv[] | null;
    }
  ).conversations?.[0];
  const messages = (conversation?.messages ?? [])
    .slice()
    .sort(
      (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
    );
  const unread_count = messages.filter(
    (m) => m.direction === "inbound" && m.read_at === null,
  ).length;

  return {
    ...(data as unknown as Omit<
      EnquiryDetail,
      "conversation_id" | "messages" | "unread_count"
    >),
    conversation_id: conversation?.id ?? null,
    messages,
    unread_count,
  };
}

/**
 * User-side enquiries listing — RLS-enforced via `enquiries_own_select`:
 * `account_id = auth.uid()`. Returns the current account's enquiries only.
 */
export async function listEnquiriesForUser(): Promise<EnquiryListRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  // Request-cached: the caller almost always resolved the same user already.
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("enquiries")
    .select(LIST_FIELDS)
    .eq("account_id", user.id)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  type RawRow = Omit<
    EnquiryListRow,
    "unread_count" | "properties" | "developments" | "staff"
  > & {
    properties: EnquiryListRow["properties"];
    developments: EnquiryListRow["developments"];
    staff: EnquiryListRow["staff"];
    conversations: {
      messages: { id: string; direction: string; read_at: string | null }[];
    }[];
  };
  return (data as unknown as RawRow[]).map((row) => {
    const messages = row.conversations?.[0]?.messages ?? [];
    const unread_count = messages.filter(
      (m) => m.direction === "outbound" && m.read_at === null,
    ).length;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      brief_raw: row.brief_raw,
      source: row.source,
      status: row.status,
      temperature: row.temperature,
      created_at: row.created_at,
      first_response_at: row.first_response_at,
      property_id: row.property_id,
      properties: row.properties,
      development_id: row.development_id,
      developments: row.developments,
      assigned_agent_id: row.assigned_agent_id,
      staff: row.staff,
      unread_count,
      archived_at: row.archived_at,
      archived_by: row.archived_by,
    };
  });
}

export type DashboardKpis = {
  new_enquiries_today: number;
  active_listings: number;
  unassigned: number;
  hot: number;
};

export async function fetchInboxKpis(): Promise<DashboardKpis> {
  if (!isSupabaseConfigured)
    return {
      new_enquiries_today: 0,
      active_listings: 0,
      unassigned: 0,
      hot: 0,
    };
  const supabase = await createSupabaseServerClient();
  const todayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Every enquiry count here is a "needs attention" number, so all three
  // exclude the archive — an archived lead that still counted as unassigned
  // would keep nagging from the dashboard after being deliberately filed.
  const [todayCount, active, unassigned, hot] = await Promise.all([
    supabase
      .from("enquiries")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .gte("created_at", todayIso),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null),
    supabase
      .from("enquiries")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .is("assigned_agent_id", null)
      .neq("status", "closed_won")
      .neq("status", "closed_lost"),
    supabase
      .from("enquiries")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .eq("temperature", "hot"),
  ]);

  return {
    new_enquiries_today: todayCount.count ?? 0,
    active_listings: active.count ?? 0,
    unassigned: unassigned.count ?? 0,
    hot: hot.count ?? 0,
  };
}
