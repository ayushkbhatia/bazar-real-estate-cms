import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getSiteSettings } from "@/lib/queries/site-settings";
import {
  LeadRoutingForm,
  type AgentOption,
  type AreaOption,
} from "../_forms";

export const dynamic = "force-dynamic";

async function fetchAgents(): Promise<AgentOption[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("staff")
    .select("user_id, display_name, role, status")
    .in("role", ["admin", "agent"])
    .eq("status", "active")
    .order("display_name", { ascending: true });
  return ((data as { user_id: string; display_name: string }[] | null) ?? []).map(
    (r) => ({ user_id: r.user_id, display_name: r.display_name }),
  );
}

async function fetchAreas(): Promise<AreaOption[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("areas")
    .select("slug, name, kind")
    .in("kind", ["area", "sub_community"])
    .order("name", { ascending: true });
  return ((data as { slug: string; name: string }[] | null) ?? []).map(
    (r) => ({ slug: r.slug, name: r.name }),
  );
}

export default async function AdminSettingsRoutingPage() {
  const [settings, agents, areas] = await Promise.all([
    getSiteSettings(),
    fetchAgents(),
    fetchAreas(),
  ]);
  return (
    <LeadRoutingForm
      initial={settings.lead_routing}
      agents={agents}
      areas={areas}
    />
  );
}
