import { getArabicFontSettings } from "@/lib/queries/site-settings";
import { ArabicTypographyForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsTypographyPage() {
  const initial = await getArabicFontSettings();
  return <ArabicTypographyForm initial={initial} />;
}
