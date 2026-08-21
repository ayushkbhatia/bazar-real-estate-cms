import { getTranslations } from "next-intl/server";
import { Car, Footprints, Train } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { SeedAreaGuide } from "@/lib/seeds/areas";

export type CommuteChip = NonNullable<SeedAreaGuide["commute_chips"]>[number];
export type DiningPick = NonNullable<SeedAreaGuide["dining_picks"]>[number];

type Props = {
  area: SeedAreaGuide;
  /**
   * The section document's overrides, from /admin/pages/sub/area/<slug>.
   *
   * Null means "nothing stored", which falls back to the seed — the same
   * contract every other band on the guide keeps. The seed reaching this
   * component has already been folded to the request's locale by
   * `localiseSeed`, so the fallback is Arabic on `/ar`.
   */
  heading?: string | null;
  chips?: CommuteChip[] | null;
  prose?: string | null;
  dining?: DiningPick[] | null;
};

/**
 * T3-E: lifestyle dossier — commute-time chips, editorial prose, and
 * curated dining picks. All three blocks are optional in the seed; the
 * section returns null entirely when none are populated so the page
 * stays clean for areas that haven't been editorially-enriched yet.
 */
export async function LifestyleDossier({
  area,
  heading,
  chips,
  prose,
  dining,
}: Props) {
  const t = await getTranslations("area");
  const liveChips = chips ?? area.commute_chips ?? [];
  const liveProse = prose ?? area.lifestyle_prose ?? null;
  const liveDining = dining ?? area.dining_picks ?? [];
  if (!liveChips.length && !liveProse && !liveDining.length) return null;

  return (
    <section className="px-4 md:px-12 py-16 border-t border-bz-border">
      <Eyebrow>{t("bands.lifestyle")}</Eyebrow>
      <h2
        className="serif text-[28px] md:text-[36px] mt-2 leading-tight max-w-[28ch]"
        style={{ letterSpacing: "-0.02em" }}
      >
        {heading ?? t("lifestyle.heading", { area: area.name })}
      </h2>

      {liveChips.length > 0 ? (
        <div className="mt-10">
          <div className="text-[11px] uppercase tracking-wider text-bz-ink-2 mb-3">
            {t("lifestyle.commute")}
          </div>
          <ul className="flex flex-wrap gap-2 max-w-[820px]">
            {liveChips.map((c) => (
              <li
                key={c.label}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-full bg-bz-surface border border-bz-border text-[12.5px]"
              >
                <CommuteIcon mode={c.mode} />
                <span className="text-bz-ink">{c.label}</span>
                <span className="text-bz-ink-2">·</span>
                <span className="mono text-bz-ink-2">
                  {t("lifestyle.minutes", { count: c.minutes })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {liveProse ? (
        <div className="mt-10 max-w-[58ch]">
          <div className="text-[11px] uppercase tracking-wider text-bz-ink-2 mb-3">
            {t("lifestyle.rhythm")}
          </div>
          <p
            className="serif text-[22px] leading-[1.55]"
            style={{ letterSpacing: "-0.012em" }}
          >
            {liveProse}
          </p>
        </div>
      ) : null}

      {liveDining.length > 0 ? (
        <div className="mt-12">
          <div className="text-[11px] uppercase tracking-wider text-bz-ink-2 mb-4">
            {t("lifestyle.dining")}
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {liveDining.map((d) => (
              <li
                key={d.name}
                className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-1.5"
              >
                <div className="text-[15px] font-medium text-bz-ink">
                  {d.name}
                </div>
                <div className="text-[12px] text-bz-ink-2">{d.kind}</div>
                <p className="mt-1 text-[12.5px] text-bz-ink-2 leading-relaxed">
                  {d.note}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11.5px] text-bz-ink-2 italic max-w-[60ch]">
            {t("lifestyle.curated", { area: area.name })}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function CommuteIcon({ mode }: { mode: "car" | "metro" | "walk" }) {
  const props = { size: 12, strokeWidth: 1.8, className: "text-bz-ink-2" };
  if (mode === "metro") return <Train {...props} />;
  if (mode === "walk") return <Footprints {...props} />;
  return <Car {...props} />;
}
