import { getSiteSettings } from "@/lib/queries/site-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { BrandForm } from "../_forms";

export const dynamic = "force-dynamic";

/** Logos offered by the picker — the library's image assets, newest first. */
async function fetchLogoOptions() {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("media_assets")
    .select("id, filename, storage_key, mime_type")
    .is("deleted_at", null)
    .like("mime_type", "image/%")
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []).map((m) => ({
    id: m.id,
    filename: m.filename,
    url: mediaPublicUrl(m.storage_key),
  }));
}

export default async function AdminSettingsBrandPage() {
  const [settings, logoOptions] = await Promise.all([
    getSiteSettings(),
    fetchLogoOptions(),
  ]);
  return <BrandForm initial={settings.brand} logoOptions={logoOptions} />;
}
