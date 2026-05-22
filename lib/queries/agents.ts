/**
 * Public-facing agent profile queries — backs /agents and /agents/[slug].
 *
 * Not the same as `staff-agents.ts` (a thin picker used by admin
 * reassign flows). This file is the profile API: full bio, photo,
 * BRN, languages, specialty, area routing.
 *
 * Falls back to `lib/seeds/agents.ts` when Supabase isn't configured or
 * the staff table is empty so the public surface always renders during
 * pre-launch. Sprint 9 stops relying on the seed once admin /agents is
 * populated.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { SEED_AGENTS } from "@/lib/seeds/agents";
import type { Database } from "@/db/types";

type StaffRole = Database["public"]["Enums"]["staff_role"];
type StaffStatus = Database["public"]["Enums"]["staff_status"];

export type AgentProfile = {
  user_id: string;
  slug: string;
  display_name: string;
  title: string | null;
  brn: string | null;
  photo_url: string | null;
  bio: string | null;
  specialties: string[];
  languages: string[];
  role: StaffRole;
  status: StaffStatus;
  joined_at: string | null;
};

const PROFILE_FIELDS =
  "user_id, slug, display_name, title, brn, photo_url, bio, specialties, languages, role, status, joined_at";

/** Convert seed entry → AgentProfile so the API shape stays consistent. */
function seedToProfile(s: (typeof SEED_AGENTS)[number]): AgentProfile {
  return {
    user_id: `seed:${s.slug}`,
    slug: s.slug,
    display_name: s.display_name,
    title: s.title,
    brn: s.brn,
    photo_url: null,
    bio: s.bio,
    specialties: s.specialties,
    languages: s.languages,
    role: "agent",
    status: "active",
    joined_at: null,
  };
}

function parseLanguages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

/** All publishable agents (role=agent, status=active), ordered by name.
 *  Falls back to SEED_AGENTS when Supabase is offline or empty. */
export async function listAgents(): Promise<AgentProfile[]> {
  if (!isSupabaseConfigured) return SEED_AGENTS.map(seedToProfile);
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("staff")
      .select(PROFILE_FIELDS)
      .eq("role", "agent")
      .eq("status", "active")
      .order("display_name", { ascending: true });
    if (error || !data || data.length === 0) {
      return SEED_AGENTS.map(seedToProfile);
    }
    return data.map(toAgentProfile);
  } catch {
    return SEED_AGENTS.map(seedToProfile);
  }
}

/** Get agent by public slug. Falls back to seed if not in DB. */
export async function getAgentBySlug(
  slug: string,
): Promise<AgentProfile | null> {
  if (!slug) return null;
  if (isSupabaseConfigured) {
    try {
      const supabase = createSupabasePublicClient();
      const { data } = await supabase
        .from("staff")
        .select(PROFILE_FIELDS)
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (data) return toAgentProfile(data);
    } catch {
      // fall through to seed
    }
  }
  const seed = SEED_AGENTS.find((s) => s.slug === slug);
  return seed ? seedToProfile(seed) : null;
}

/** Admin-side: get agent by user_id. Returns null when not found. */
export async function getAgentById(
  userId: string,
): Promise<AgentProfile | null> {
  if (!isSupabaseConfigured || !userId) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("staff")
      .select(PROFILE_FIELDS)
      .eq("user_id", userId)
      .maybeSingle();
    return data ? toAgentProfile(data) : null;
  } catch {
    return null;
  }
}

/** Admin-side upsert. Returns updated/inserted row or null on error.
 *  RLS requires `is_admin()` to write — the API route gates this. */
export async function upsertAgent(input: {
  user_id: string;
  display_name: string;
  slug: string;
  title?: string | null;
  brn?: string | null;
  bio?: string | null;
  specialties?: string[];
  languages?: string[];
  role?: StaffRole;
  status?: StaffStatus;
}): Promise<AgentProfile | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const payload = {
      user_id: input.user_id,
      display_name: input.display_name,
      slug: input.slug,
      title: input.title ?? null,
      brn: input.brn ?? null,
      bio: input.bio ?? null,
      specialties: input.specialties ?? [],
      languages: input.languages ?? [],
      role: input.role ?? "agent",
      status: input.status ?? "active",
    };
    const { data, error } = await supabase
      .from("staff")
      .upsert(payload, { onConflict: "user_id" })
      .select(PROFILE_FIELDS)
      .single();
    if (error || !data) {
      if (error) console.error("[upsertAgent]", error);
      return null;
    }
    return toAgentProfile(data);
  } catch (e) {
    console.error("[upsertAgent]", e);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAgentProfile(row: any): AgentProfile {
  return {
    user_id: row.user_id,
    slug: row.slug,
    display_name: row.display_name,
    title: row.title,
    brn: row.brn,
    photo_url: row.photo_url,
    bio: row.bio,
    specialties: row.specialties ?? [],
    languages: parseLanguages(row.languages),
    role: row.role,
    status: row.status,
    joined_at: row.joined_at,
  };
}
