import { getSiteSettings } from "@/lib/queries/site-settings";
import { BrandForm } from "../_forms";

export const dynamic = "force-dynamic";

export default async function AdminSettingsBrandPage() {
  const settings = await getSiteSettings();
  return <BrandForm initial={settings.brand} />;
}
