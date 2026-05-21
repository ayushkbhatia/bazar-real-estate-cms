import { redirect } from "next/navigation";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { currentUserIsAdmin } from "@/lib/queries/staff";
import { getSiteSettings } from "@/lib/queries/site-settings";
import {
  BrandForm,
  DisplayForm,
  EmailTemplatesEditor,
  LeadRoutingForm,
  type AgentOption,
  type AreaOption,
} from "./_forms";

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

export default async function AdminSettingsPage() {
  if (!(await currentUserIsAdmin())) {
    redirect("/admin?error=admins_only");
  }
  const [settings, agents, areas] = await Promise.all([
    getSiteSettings(),
    fetchAgents(),
    fetchAreas(),
  ]);

  return (
    <CmsShell title="Site settings" breadcrumbs="Admin">
      <div className="grid grid-cols-[1fr] gap-6 max-w-[920px]">
        <BrandForm initial={settings.brand} />
        <DisplayForm initial={settings.display} />
        <LeadRoutingForm
          initial={settings.lead_routing}
          agents={agents}
          areas={areas}
        />
        <EmailTemplatesEditor overrides={settings.email_templates} />
      </div>
    </CmsShell>
  );
}
