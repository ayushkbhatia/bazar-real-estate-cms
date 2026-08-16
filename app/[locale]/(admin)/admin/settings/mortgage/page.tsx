import { getMortgageSettings } from "@/lib/queries/site-settings";
import { MortgageForm } from "../_forms";

export const dynamic = "force-dynamic";

export default async function AdminSettingsMortgagePage() {
  const settings = await getMortgageSettings();
  return <MortgageForm initial={settings} />;
}
