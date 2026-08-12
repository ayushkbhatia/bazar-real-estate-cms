import { getSiteSettings } from "@/lib/queries/site-settings";
import { DisplayForm } from "../_forms";

export const dynamic = "force-dynamic";

export default async function AdminSettingsHeroPage() {
  const settings = await getSiteSettings();
  return <DisplayForm initial={settings.display} />;
}
