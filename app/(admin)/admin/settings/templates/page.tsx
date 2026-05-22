import { getSiteSettings } from "@/lib/queries/site-settings";
import { EmailTemplatesEditor } from "../_forms";

export const dynamic = "force-dynamic";

export default async function AdminSettingsTemplatesPage() {
  const settings = await getSiteSettings();
  return <EmailTemplatesEditor overrides={settings.email_templates} />;
}
