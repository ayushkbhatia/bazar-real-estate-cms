import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type ActiveAgent = {
  user_id: string;
  display_name: string;
  title: string | null;
  photo_url: string | null;
};

/**
 * Active agents available as bulk-reassign targets. Read-side only — extend
 * `lib/queries/staff.ts` only when broader staff metadata is needed (it
 * already pulls auth metadata via the service-role admin client, which is
 * overkill for a picker).
 */
export async function listActiveAgents(): Promise<ActiveAgent[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("staff")
    .select("user_id, display_name, title, photo_url")
    .eq("role", "agent")
    .eq("status", "active")
    .order("display_name", { ascending: true });
  if (error || !data) {
    if (error) console.error("[listActiveAgents]", error);
    return [];
  }
  return data.map((r) => ({
    user_id: r.user_id,
    display_name: r.display_name,
    title: r.title,
    photo_url: r.photo_url,
  }));
}
