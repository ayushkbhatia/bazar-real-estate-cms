/**
 * Public-facing agent profile queries — backs /agents and /agents/[slug].
 *
 * Not the same as `staff-agents.ts` (a thin picker used by admin
 * reassign flows). This file is the profile API: full bio, photo,
 * BRN, languages, specialty, area routing.
 *
 * Reads `staff` and nothing else. It used to fall back to
 * `lib/seeds/agents.ts` — eleven invented advisors with invented BRN numbers
 * — whenever Supabase was unconfigured, the query errored, the result was
 * empty, or a slug missed. The last of those was the dangerous one: it meant
 * suspending an advisor removed them from /agents while /agents/<slug> went
 * on publishing them from the seed, so there was no way to take an advisor
 * off the site. A roster this site cannot read is an empty roster.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import type { Locale } from "@/lib/i18n/locales";
import { localiseRow } from "@/lib/i18n/localise";
import { readFailed } from "@/lib/queries/read-failure";
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
  /**
   * Publishable contact details (0077). Null until staff fill them in.
   *
   * These were missing from the profile shape, so every surface that needed a
   * number for an advisor reached into `SEED_AGENTS` for one — and where the
   * slug missed, published a hardcoded placeholder instead. The columns have
   * been there since 0077.
   */
  email: string | null;
  phone: string | null;
  /** Falls back to `phone` when the WhatsApp field is blank. */
  whatsapp: string | null;
};

/* The `_ar` twins ride along and are folded away by `localiseRow` before
 * `toAgentProfile` shapes the row — that shaper builds explicit literals, so
 * folding after it would silently do nothing, as it did in the megamenu. */
const PROFILE_FIELDS =
  "user_id, slug, display_name, display_name_ar, title, title_ar, brn, photo_url, bio, bio_ar, specialties, specialties_ar, languages, languages_ar, role, status, joined_at, public_email, public_phone, whatsapp";

function blankToNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

function parseLanguages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

/** All publishable agents (role=agent, status=active), ordered by name.
 *  Empty when there are none — never a substitute roster. */
export async function listAgents(
  /** Pass the route's locale; the ambient one is lost on some prerenders. */
  locale?: Locale,
): Promise<AgentProfile[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("staff")
      .select(PROFILE_FIELDS)
      .eq("role", "agent")
      .eq("status", "active")
      .order("display_name", { ascending: true });
    if (error || !data) return [];
    const resolved = locale ?? (await currentLocale());
    return data.map((row) =>
      toAgentProfile(
        localiseRow(row as unknown as Record<string, unknown>, resolved),
      ),
    );
  } catch (error) {
    console.error("[listAgents]", error);
    return [];
  }
}

/** Get agent by public slug. Null when there is no publishable row. */
export async function getAgentBySlug(
  slug: string,
  locale?: Locale,
): Promise<AgentProfile | null> {
  if (!slug || !isSupabaseConfigured) return null;
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("staff")
    .select(PROFILE_FIELDS)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  // With the seed fallback gone this read is one `null` away from a
  // `notFound()`, which is exactly the shape `read-failure` exists for: a
  // blip here would otherwise be cached as a 404 for the whole revalidate
  // window. An absent row still returns null — that 404 is the true one.
  if (error) readFailed("getAgentBySlug", error);
  if (!data) return null;
  return toAgentProfile(
    localiseRow(
      data as unknown as Record<string, unknown>,
      locale ?? (await currentLocale()),
    ),
  );
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
    email: blankToNull(row.public_email),
    phone: blankToNull(row.public_phone),
    whatsapp: blankToNull(row.whatsapp) ?? blankToNull(row.public_phone),
  };
}
