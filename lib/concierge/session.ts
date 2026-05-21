/**
 * Server-side session I/O for the concierge.
 *
 * Each chat lives in a row of `concierge_sessions`. For authenticated users
 * the row is keyed by `user_id`; for anonymous users we mint a random
 * `anon_token` stored in an httpOnly cookie. The route handler uses the
 * service-role client so RLS doesn't block anonymous reads/writes — RLS
 * still gates whether an anon user is allowed to see the session via the
 * public API (we only respond if the cookie token matches).
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/db/types";
import {
  conciergeBriefSchema,
  mergeBrief,
  type ConciergeBrief,
} from "./brief";
import { MAX_ANON_TURNS } from "./anthropic";

const COOKIE_NAME = "bz_concierge";

/** Lazy service-role client. Throws when env is missing. */
function getServiceClient(): SupabaseClient<Database> {
  if (!isSupabaseConfigured || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Concierge requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type ConciergeSessionRow = {
  id: string;
  user_id: string | null;
  anon_token: string | null;
  brief: ConciergeBrief;
  pinned_property_ids: string[];
  input_tokens: number;
  output_tokens: number;
  turn_count: number;
  handed_off_to: string | null;
  handed_off_at: string | null;
};

function shapeSession(raw: Record<string, unknown>): ConciergeSessionRow {
  const parsedBrief = conciergeBriefSchema.safeParse(raw.brief ?? {});
  return {
    id: String(raw.id),
    user_id: (raw.user_id as string | null) ?? null,
    anon_token: (raw.anon_token as string | null) ?? null,
    brief: parsedBrief.success ? parsedBrief.data : { chips: [] },
    pinned_property_ids: Array.isArray(raw.pinned_property_ids)
      ? (raw.pinned_property_ids as string[])
      : [],
    input_tokens: Number(raw.input_tokens ?? 0),
    output_tokens: Number(raw.output_tokens ?? 0),
    turn_count: Number(raw.turn_count ?? 0),
    handed_off_to: (raw.handed_off_to as string | null) ?? null,
    handed_off_at: (raw.handed_off_at as string | null) ?? null,
  };
}

/** Load a session by id, optionally requiring an anon_token to match.
 *  Returns null if not found / token mismatch. */
export async function loadSession(
  id: string,
  opts: { userId?: string | null; anonToken?: string | null },
): Promise<ConciergeSessionRow | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("concierge_sessions")
    .select(
      "id, user_id, anon_token, brief, pinned_property_ids, input_tokens, output_tokens, turn_count, handed_off_to, handed_off_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  if (opts.userId && data.user_id !== opts.userId) return null;
  if (!opts.userId && data.user_id === null && data.anon_token !== opts.anonToken)
    return null;
  return shapeSession(data as unknown as Record<string, unknown>);
}

/** Create a fresh session for an authed or anon user. */
export async function createSession(opts: {
  userId: string | null;
  anonToken: string | null;
}): Promise<ConciergeSessionRow> {
  const supabase = getServiceClient();
  const insert = {
    user_id: opts.userId,
    anon_token: opts.userId ? null : opts.anonToken,
    brief: { chips: [] } as ConciergeBrief,
    pinned_property_ids: [],
  };
  const { data, error } = await supabase
    .from("concierge_sessions")
    .insert(insert)
    .select(
      "id, user_id, anon_token, brief, pinned_property_ids, input_tokens, output_tokens, turn_count, handed_off_to, handed_off_at",
    )
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create concierge session.");
  }
  return shapeSession(data as unknown as Record<string, unknown>);
}

/** Persist a user message + the assistant reply (single SSE turn). */
export async function appendMessages(
  sessionId: string,
  entries: Array<{
    role: "user" | "assistant";
    content: string;
    tool_use?: unknown;
    results?: unknown;
    input_tokens?: number | null;
    output_tokens?: number | null;
  }>,
): Promise<void> {
  if (entries.length === 0) return;
  const supabase = getServiceClient();
  type MessageInsert =
    Database["public"]["Tables"]["concierge_messages"]["Insert"];
  const rows: MessageInsert[] = entries.map((e) => ({
    session_id: sessionId,
    role: e.role,
    content: e.content,
    tool_use: e.tool_use as MessageInsert["tool_use"],
    results: e.results as MessageInsert["results"],
    input_tokens: e.input_tokens ?? null,
    output_tokens: e.output_tokens ?? null,
  }));
  await supabase.from("concierge_messages").insert(rows);
}

/** Persist session updates (brief, pinned ids, token counters, etc.). */
export async function updateSession(
  sessionId: string,
  patch: {
    brief?: Partial<ConciergeBrief>;
    pinned_property_ids?: string[];
    input_tokens?: number;
    output_tokens?: number;
    turn_count?: number;
    handed_off_to?: string | null;
    handed_off_at?: string | null;
  },
): Promise<void> {
  const supabase = getServiceClient();
  type SessionUpdate =
    Database["public"]["Tables"]["concierge_sessions"]["Update"];
  const row: SessionUpdate = {};
  if (patch.brief) {
    const existing = await loadSessionBriefOnly(sessionId);
    row.brief = mergeBrief(existing, patch.brief) as SessionUpdate["brief"];
  }
  if (patch.pinned_property_ids)
    row.pinned_property_ids = patch.pinned_property_ids;
  if (patch.input_tokens !== undefined) row.input_tokens = patch.input_tokens;
  if (patch.output_tokens !== undefined)
    row.output_tokens = patch.output_tokens;
  if (patch.turn_count !== undefined) row.turn_count = patch.turn_count;
  if (patch.handed_off_to !== undefined) row.handed_off_to = patch.handed_off_to;
  if (patch.handed_off_at !== undefined) row.handed_off_at = patch.handed_off_at;
  if (Object.keys(row).length === 0) return;
  await supabase.from("concierge_sessions").update(row).eq("id", sessionId);
}

async function loadSessionBriefOnly(
  sessionId: string,
): Promise<ConciergeBrief> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("concierge_sessions")
    .select("brief")
    .eq("id", sessionId)
    .maybeSingle();
  const parsed = conciergeBriefSchema.safeParse(data?.brief ?? {});
  return parsed.success ? parsed.data : { chips: [] };
}

/** Anon users get MAX_ANON_TURNS before we ask them to sign in. */
export function isOverAnonLimit(session: ConciergeSessionRow): boolean {
  return session.user_id === null && session.turn_count >= MAX_ANON_TURNS;
}

export { COOKIE_NAME };
