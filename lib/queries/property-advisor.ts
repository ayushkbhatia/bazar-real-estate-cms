/**
 * The advisor actually assigned to a listing.
 *
 * The property page used to pick a *seed* advisor by area overlap
 * (`SEED_AGENTS.find(a => a.areas.includes(...))`), so the name, BRN, photo
 * and phone number on every listing belonged to whichever of the six
 * hardcoded entries happened to cover that area — never to the agent staff
 * chose in the admin editor. `properties.assigned_agent_id` is the real link;
 * this resolves it against `staff`.
 *
 * Lives outside `lib/queries/properties.ts` (locked) so the canonical listing
 * query is untouched — same pattern as `lib/queries/listings-by-agent.ts`.
 *
 * Visibility: the `staff_public_agents` policy (0036) exposes rows to `anon`
 * only when `role = 'agent' and status = 'active'`. A listing assigned to an
 * admin, or to an advisor who has since been suspended, therefore resolves to
 * `null` here, and the page drops the advisor card rather than inventing one.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";

export type PropertyAdvisor = {
  user_id: string;
  slug: string;
  display_name: string;
  title: string | null;
  brn: string | null;
  photo_url: string | null;
  languages: string[];
  /** Publishable contact details (0077). Null until staff fill them in. */
  email: string | null;
  phone: string | null;
  /** Falls back to `phone` when the WhatsApp field is blank. */
  whatsapp: string | null;
};

const ADVISOR_FIELDS =
  "user_id, slug, display_name, title, brn, photo_url, languages, public_email, public_phone, whatsapp";

function parseLanguages(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String) : [];
}

function blankToNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

/** Resolve a staff user_id into a publishable advisor profile. */
export async function getAdvisorByUserId(
  userId: string | null | undefined,
): Promise<PropertyAdvisor | null> {
  if (!isSupabaseConfigured || !userId) return null;
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("staff")
      .select(ADVISOR_FIELDS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error("[getAdvisorByUserId]", error);
      return null;
    }
    const row = data as unknown as Record<string, unknown>;
    const phone = blankToNull(row.public_phone);
    return {
      user_id: String(row.user_id),
      slug: String(row.slug),
      display_name: String(row.display_name),
      title: blankToNull(row.title),
      brn: blankToNull(row.brn),
      photo_url: blankToNull(row.photo_url),
      languages: parseLanguages(row.languages),
      email: blankToNull(row.public_email),
      phone,
      whatsapp: blankToNull(row.whatsapp) ?? phone,
    };
  } catch (e) {
    console.error("[getAdvisorByUserId]", e);
    return null;
  }
}

/**
 * The advisor for one property. Returns null when the listing is
 * unassigned, or when the assignee isn't publicly visible (see the note at
 * the top of this file).
 */
export async function getPropertyAdvisor(
  propertyId: string,
): Promise<PropertyAdvisor | null> {
  if (!isSupabaseConfigured || !propertyId) return null;
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("properties")
      .select("assigned_agent_id")
      .eq("id", propertyId)
      .maybeSingle();
    return getAdvisorByUserId(data?.assigned_agent_id ?? null);
  } catch (e) {
    console.error("[getPropertyAdvisor]", e);
    return null;
  }
}
