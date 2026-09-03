import { getUnitLabelSettings } from "@/lib/queries/site-settings";
import { UnitLabelsForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsUnitsPage() {
  const initial = await getUnitLabelSettings();
  return <UnitLabelsForm initial={initial} />;
}
