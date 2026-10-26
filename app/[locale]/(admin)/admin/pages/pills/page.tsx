import {
  getCardLabelSettings,
  getStatusPillSettings,
} from "@/lib/queries/card-labels";
import { CardLabelsForm } from "../../settings/card-labels/_form";
import { StatusPillsForm } from "./_status-form";

export const dynamic = "force-dynamic";

/**
 * Pages & blocks → Pills: every chip a card wears, in one place, English and
 * Arabic (client, Oct 2026).
 *
 * Two kinds, and the screen keeps them apart because they are chosen apart:
 * status pills follow from what a listing is (off-plan, for sale, for rent),
 * card labels are ticked per listing (Exclusive, Vacant on Transfer, any the
 * client adds). Both are stored in `site_settings.card_labels`; the card-label
 * form is the same one Settings → Card labels renders.
 */
export default async function AdminPillsPage() {
  const [status, labels] = await Promise.all([
    getStatusPillSettings(),
    getCardLabelSettings(),
  ]);
  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-3xl">
        <h1 className="serif text-[28px] leading-tight">Pills</h1>
        <p className="mt-2 text-[13.5px] text-bz-ink-2 leading-relaxed">
          Every chip a property or project card wears over its photograph, in
          English and Arabic. Saving here relabels every card on the site — no
          deploy.
        </p>
      </header>
      <StatusPillsForm initial={status} />
      <div className="border-t border-bz-border pt-8">
        <CardLabelsForm initial={labels} />
      </div>
    </div>
  );
}
