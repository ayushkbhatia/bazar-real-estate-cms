import { Award as AwardIcon } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { SEED_AWARDS } from "@/lib/seeds/awards";

/**
 * Awards band — designed for the /about page. Horizontal scroller on small
 * screens, 4-column grid on desktop. Each card is editorial: the issuer +
 * one-sentence context.
 */
export function AwardsBand() {
  return (
    <section className="px-12 py-16 border-t border-bz-border">
      <Eyebrow>Recognised by</Eyebrow>
      <h2
        className="serif text-[36px] mt-2 leading-tight max-w-[30ch]"
        style={{ letterSpacing: "-0.02em" }}
      >
        Performance markers we&apos;re proud of.
      </h2>
      <ul className="mt-9 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SEED_AWARDS.map((a) => (
          <li
            key={a.id}
            className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-3 h-full"
          >
            <div className="flex items-center justify-between gap-2">
              <AwardIcon
                size={16}
                strokeWidth={1.5}
                className="text-bz-accent"
              />
              <span className="mono text-[11px] text-bz-muted">{a.year}</span>
            </div>
            <div>
              <div className="eyebrow">{a.issuer}</div>
              <div
                className="serif text-[20px] mt-1.5 leading-tight"
                style={{ letterSpacing: "-0.015em" }}
              >
                {a.title}
              </div>
            </div>
            <p className="text-[12.5px] text-bz-ink-2 leading-relaxed mt-auto">
              {a.context}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
