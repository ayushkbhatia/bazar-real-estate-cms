import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { SEED_DEVELOPERS } from "@/lib/seeds/developers";
import { listDevelopers } from "@/lib/queries/developers-extras";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "Abu Dhabi master-developers and the major private operators we transact with — Aldar, Modon, Bloom, IMKAN, and others.",
};

export default async function DevelopersIndexPage() {
  const developers = await listDevelopers();
  // Seed retains active_developments + units_handed_over for cards
  // until the developers table grows those fields.
  const seedBySlug = new Map(SEED_DEVELOPERS.map((s) => [s.slug, s]));
  return (
    <div className="bg-bz-bg">
      <section className="px-12 pt-20 pb-14 max-w-[1200px]">
        <Eyebrow>Developers</Eyebrow>
        <h1
          className="serif text-[80px] mt-3 font-normal leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Who builds Abu Dhabi.
        </h1>
        <p className="mt-8 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          The master-developers and private operators we transact with. Bazar
          does not have an exclusive agency with any of them — our advisory is
          buyer- and seller-side, not developer-side.
        </p>
      </section>

      <section className="px-12 pb-24 max-w-[1280px]">
        <div className="grid grid-cols-2 gap-8">
          {developers.map((d) => {
            const seed = seedBySlug.get(d.slug);
            return (
              <Link
                key={d.id}
                href={`/developers/${d.slug}`}
                className="group block rounded-lg border border-bz-border bg-bz-surface p-8 hover:border-bz-border-strong transition-colors"
              >
                <div className="flex gap-6 items-start">
                  <PlaceholderImage
                    label={d.slug}
                    className="w-20 h-20 rounded-md flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <h2
                        className="serif text-[26px] leading-tight group-hover:text-bz-accent transition-colors"
                        style={{ letterSpacing: "-0.012em" }}
                      >
                        {d.name}
                      </h2>
                      {d.founded_year ? (
                        <span className="mono text-[11px] text-bz-muted">
                          Est. {d.founded_year}
                        </span>
                      ) : null}
                    </div>
                    {d.description ? (
                      <p className="mt-2 text-[14px] text-bz-ink-2 leading-relaxed">
                        {d.description}
                      </p>
                    ) : null}
                    {seed ? (
                      <div className="mt-5 flex gap-8 text-[12px]">
                        <span className="text-bz-muted">
                          Active developments ·{" "}
                          <span className="mono text-bz-ink">
                            {seed.active_developments}
                          </span>
                        </span>
                        <span className="text-bz-muted">
                          Units handed over ·{" "}
                          <span className="mono text-bz-ink">
                            {seed.total_handed_over_units.toLocaleString()}
                          </span>
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
