import { getCardLabelSettings } from "@/lib/queries/card-labels";
import { CardLabelsForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsCardLabelsPage() {
  const initial = await getCardLabelSettings();
  return <CardLabelsForm initial={initial} />;
}
