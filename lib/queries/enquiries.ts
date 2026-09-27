import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { reportError } from "@/lib/observability";
import { originLabel, type OriginLabel } from "@/lib/enquiries/origin";
import {
  phoneDigits,
  phonePattern,
  phoneTail,
  sameEmail,
  samePhone,
} from "@/lib/enquiries/same-person";
import { isMissingTableError, splitSubmissionData } from "@/lib/queries/forms";
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
  /** The lib/forms registry key of the form it came through (0128). */
  form_key: string | null;
  /** The language the lead wrote in — `ar` for a submission from `/ar`. */
  locale: string;
  /**
   * Which form on which page, resolved server-side. `source` alone files half
   * the public forms as `contact_page`.
   */
  origin: OriginLabel;
};

const LIST_FIELDS = `
  id, name, email, phone, brief_raw, source, status, temperature,
  created_at, first_response_at, property_id, development_id, assigned_agent_id,
  archived_at, archived_by, form_key, locale,
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
    "unread_count" | "properties" | "developments" | "staff" | "origin"
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
      form_key: row.form_key,
      locale: row.locale,
      origin: originLabel(row.form_key, row.source),
    };
  });

  return { rows, total: count ?? 0 };
}

export type EnquiryDetail = Omit<
  EnquiryListRow,
  "properties" | "developments"
> & {
  /** The listing, with what the desk needs to know it is still worth quoting. */
  properties: {
    reference: string;
    title: string;
    slug: string;
    status: Database["public"]["Enums"]["property_status"];
    mode: Database["public"]["Enums"]["property_mode"];
    type: Database["public"]["Enums"]["property_type"];
    beds: number;
    baths: number;
    price_aed: number;
  } | null;
  developments: {
    name: string;
    slug: string;
    status: Database["public"]["Enums"]["development_status"];
    starting_price: number | null;
  } | null;
  budget_min: number | null;
  budget_max: number | null;
  timeline: Database["public"]["Enums"]["enquiry_timeline"] | null;
  pre_approved: boolean;
  internal_notes: string | null;
  inferred_constraints: Record<string, unknown> | null;
  closed_at: string | null;
  close_reason: string | null;
  account_id: string | null;
  /** Stamped by the auto-reply sweep. Null does NOT mean nothing was sent. */
  ack_sent_at: string | null;
  crm_sync_state: string;
  crm_external_id: string | null;
  crm_synced_at: string | null;
  crm_last_error: string | null;
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
       form_key, locale, ack_sent_at,
       crm_sync_state, crm_external_id, crm_synced_at, crm_last_error,
       properties:property_id(reference, title, slug, status, mode, type,
                              beds, baths, price_aed),
       developments:development_id(name, slug, status, starting_price),
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

  const row = data as unknown as Omit<
    EnquiryDetail,
    "conversation_id" | "messages" | "unread_count" | "origin"
  >;
  return {
    ...row,
    origin: originLabel(row.form_key, row.source),
    conversation_id: conversation?.id ?? null,
    messages,
    unread_count,
  };
}

// ── what they sent ───────────────────────────────────────────────────────

export type EnquirySubmission = {
  id: string;
  form_key: string;
  /** Answers keyed by field key, `_labels` split off. */
  data: Record<string, unknown>;
  /** The question labels as frozen at submission. */
  labels: Record<string, string>;
  /** The page it was sent from, locale prefix and slug included. */
  source_path: string | null;
  created_at: string;
};

/**
 * The submission-log rows that became this lead — what the visitor actually
 * filled in, on which page (0094).
 *
 * Normally exactly one. None for a lead that came through no form, or that
 * predates the log. Read on its own rather than embedded in `getEnquiryById`
 * so that a failure here costs the page its answers, not the whole page: an
 * embed that errored would 404 the enquiry.
 */
export async function listEnquirySubmissions(
  enquiryId: string,
): Promise<EnquirySubmission[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("form_submissions")
      .select("id, form_key, data, source_path, created_at")
      .eq("enquiry_id", enquiryId)
      .order("created_at", { ascending: true })
      .limit(5);
    if (error) {
      if (!isMissingTableError(error)) {
        await reportError(error, {
          source: "enquiry/submissions",
          context: { enquiry: { id: enquiryId } },
        });
      }
      return [];
    }
    return (data ?? []).map((row) => {
      const split = splitSubmissionData(row.data);
      return {
        id: row.id,
        form_key: row.form_key,
        data: split.data,
        labels: split.labels,
        source_path: row.source_path,
        created_at: row.created_at,
      };
    });
  } catch (err) {
    await reportError(err, {
      source: "enquiry/submissions",
      context: { enquiry: { id: enquiryId } },
    });
    return [];
  }
}

// ── the same person, before ──────────────────────────────────────────────

export type RelatedEnquiry = {
  id: string;
  name: string;
  created_at: string;
  status: EnquiryStatus;
  archived_at: string | null;
  origin: OriginLabel;
  property: { reference: string; title: string } | null;
  development: { name: string } | null;
  /** How we know it is the same person — shown, because a shared family number is not. */
  matchedOn: ("email" | "phone")[];
};

const RELATED_FIELDS = `
  id, name, email, phone, created_at, status, source, form_key, archived_at,
  properties:property_id(reference, title),
  developments:development_id(name)
`;

/**
 * Every other enquiry from the same person, newest first — matched on email,
 * or on the phone number however it was spelled (see `lib/enquiries/same-person`).
 *
 * Archived leads are only included for admins, the one role that may see the
 * archive at all; for anyone else they must not leak in through this card.
 *
 * Null means "couldn't tell", which the page must not render as "first
 * enquiry": a failed read, or a lead with nothing to match on.
 */
export async function listRelatedEnquiries(opts: {
  excludeId: string;
  email: string | null;
  phone: string | null;
  includeArchived: boolean;
  limit?: number;
}): Promise<RelatedEnquiry[] | null> {
  if (!isSupabaseConfigured) return null;
  const limit = opts.limit ?? 8;
  const email = opts.email?.trim() || null;
  const digits = phoneDigits(opts.phone);
  if (!email && !digits) return null;

  type RawRelated = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    created_at: string;
    status: EnquiryStatus;
    source: EnquirySource;
    form_key: string | null;
    archived_at: string | null;
    properties: { reference: string; title: string } | null;
    developments: { name: string } | null;
  };

  try {
    const supabase = await createSupabaseServerClient();
    const scoped = () => {
      let query = supabase
        .from("enquiries")
        .select(RELATED_FIELDS)
        .neq("id", opts.excludeId);
      if (!opts.includeArchived) query = query.is("archived_at", null);
      return query;
    };

    const reads = [];
    if (email) {
      // Intake lower-cases every address but the valuation gate's, which
      // stores it as typed — so both spellings, exactly.
      const spellings = [...new Set([email.toLowerCase(), email])];
      reads.push(
        scoped()
          .in("email", spellings)
          .order("created_at", { ascending: false })
          .limit(limit),
      );
    }
    if (digits) {
      reads.push(
        scoped()
          .filter("phone", "match", phonePattern(phoneTail(digits)))
          .order("created_at", { ascending: false })
          .limit(limit),
      );
    }

    const results = await Promise.all(reads);
    const byId = new Map<string, RawRelated>();
    for (const result of results) {
      if (result.error) {
        // Half a history reads as the whole of one. Say nothing instead.
        await reportError(result.error, {
          source: "enquiry/related",
          context: { enquiry: { id: opts.excludeId } },
        });
        return null;
      }
      for (const row of (result.data ?? []) as unknown as RawRelated[]) {
        byId.set(row.id, row);
      }
    }

    return [...byId.values()]
      .map((row): RelatedEnquiry => {
        const matchedOn: RelatedEnquiry["matchedOn"] = [];
        if (sameEmail(email, row.email)) matchedOn.push("email");
        if (samePhone(opts.phone, row.phone)) matchedOn.push("phone");
        return {
          id: row.id,
          name: row.name,
          created_at: row.created_at,
          status: row.status,
          archived_at: row.archived_at,
          origin: originLabel(row.form_key, row.source),
          property: row.properties,
          development: row.developments,
          matchedOn,
        };
      })
      // The regex is a filter on shape; this is the check on substance.
      .filter((row) => row.matchedOn.length > 0)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  } catch (err) {
    await reportError(err, {
      source: "enquiry/related",
      context: { enquiry: { id: opts.excludeId } },
    });
    return null;
  }
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
    "unread_count" | "properties" | "developments" | "staff" | "origin"
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
      form_key: row.form_key,
      locale: row.locale,
      origin: originLabel(row.form_key, row.source),
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
