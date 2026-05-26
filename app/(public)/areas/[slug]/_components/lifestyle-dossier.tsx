import { Car, Footprints, Train } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { SeedAreaGuide } from "@/lib/seeds/areas";

type Props = {
  area: SeedAreaGuide;
};

/**
 * T3-E: lifestyle dossier — commute-time chips, editorial prose, and
 * curated dining picks. All three blocks are optional in the seed; the
 * section returns null entirely when none are populated so the page
 * stays clean for areas that haven't been editorially-enriched yet.
 */
export function LifestyleDossier({ area }: Props) {
  const hasChips = !!area.commute_chips?.length;
  const hasProse = !!area.lifestyle_prose;
  const hasDining = !!area.dining_picks?.length;
  if (!hasChips && !hasProse && !hasDining) return null;

  return (
    <section className="px-12 py-16 max-w-[1280px] border-t border-bz-border">
      <Eyebrow>Lifestyle</Eyebrow>
      <h2
        className="serif text-[36px] mt-2 leading-tight max-w-[28ch]"
        style={{ letterSpacing: "-0.02em" }}
      >
        What it feels like to live in {area.name}.
      </h2>

      {hasChips ? (
        <div className="mt-10">
          <div className="text-[11px] uppercase tracking-wider text-bz-ink-2 mb-3">
            Commute snapshot
          </div>
          <ul className="flex flex-wrap gap-2 max-w-[820px]">
            {area.commute_chips!.map((c) => (
              <li
                key={c.label}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-full bg-bz-surface border border-bz-border text-[12.5px]"
              >
                <CommuteIcon mode={c.mode} />
                <span className="text-bz-ink">{c.label}</span>
                <span className="text-bz-ink-2">·</span>
                <span className="mono text-bz-ink-2">{c.minutes} min</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasProse ? (
        <div className="mt-10 max-w-[58ch]">
          <div className="text-[11px] uppercase tracking-wider text-bz-ink-2 mb-3">
            The rhythm of the week
          </div>
          <p
            className="serif text-[22px] leading-[1.55]"
            style={{ letterSpacing: "-0.012em" }}
          >
            {area.lifestyle_prose}
          </p>
        </div>
      ) : null}

      {hasDining ? (
        <div className="mt-12">
          <div className="text-[11px] uppercase tracking-wider text-bz-ink-2 mb-4">
            Where the advisors take their clients
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {area.dining_picks!.map((d) => (
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
            Curated by the {area.name} advisor desk. We update this list
            whenever a regular spot slips or a new one earns its place.
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
