import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PlaceholderImage } from "@/components/brand/placeholder-image";

/**
 * Home "Who we are" (handoff §6). Image + verbatim company copy + stat row.
 * All copy is real (from the client audit) — do not paraphrase.
 */
const STATS: [string, string][] = [
  ["20+", "Years in market"],
  ["ADREC & DLD", "Regulated"],
  ["Al Bateen", "Head office"],
];

export function WhoWeAre() {
  return (
    <section className="px-4 md:px-12 py-14 md:py-20">
      <div className="grid items-center gap-10 md:grid-cols-[1fr_1.05fr] md:gap-16">
        <div className="relative">
          <PlaceholderImage
            label="bazar abu dhabi office"
            className="aspect-[4/5] w-full rounded-xl"
          />
          <div className="absolute -right-3 bottom-6 rounded-lg border border-bz-border bg-bz-surface px-5 py-4 shadow-[0_4px_12px_rgba(0,0,0,0.06),0_16px_48px_rgba(0,0,0,0.08)] md:-right-6">
            <div className="serif text-[36px] md:text-[40px] leading-none tracking-tight">
              2005
            </div>
            <div className="mt-1 text-[12px] text-bz-muted">
              Established in Abu Dhabi
            </div>
          </div>
        </div>

        <div>
          <div
            className="text-[11px] font-medium uppercase text-bz-accent"
            style={{ letterSpacing: "0.12em" }}
          >
            Who we are
          </div>
          <h2 className="serif mt-2.5 text-[32px] md:text-[48px] font-normal leading-[1.05] tracking-tight">
            About Bazar Real Estate
          </h2>
          <p className="mt-5 max-w-[50ch] text-[15px] md:text-[16.5px] text-bz-ink-2 leading-relaxed">
            Established in 2005, Bazar Real Estate L.L.C. is a leading
            award-winning real estate agency in the UAE, recognized for its
            market expertise, professional excellence, and trusted presence in
            the region&apos;s ever-evolving property market.
          </p>
          <div className="mt-8 flex flex-wrap gap-8 border-t border-bz-border pt-7 md:gap-10">
            {STATS.map(([v, l]) => (
              <div key={l}>
                <div className="serif text-[22px] md:text-[24px] tracking-tight">
                  {v}
                </div>
                <div className="mt-1 text-[12px] text-bz-muted">{l}</div>
              </div>
            ))}
          </div>
          <Link
            href="/about"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-md bg-bz-ink px-5 text-[13.5px] font-medium text-bz-bg transition-colors hover:bg-bz-ink/90"
          >
            Know more <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
