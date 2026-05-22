import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { getSeedDeveloperBySlug } from "@/lib/seeds/developers";
import {
  getDeveloperBySlug,
  listDeveloperDevelopments,
  listDevelopers,
} from "@/lib/queries/developers-extras";

export async function generateStaticParams() {
  const developers = await listDevelopers();
  return developers.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dev = await getDeveloperBySlug(slug);
  if (!dev) return { title: "Developer not found" };
  return {
    title: dev.name,
    description: dev.description ?? undefined,
  };
}

export default async function DeveloperProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dev = await getDeveloperBySlug(slug);
  if (!dev) notFound();
  // Seed retains active_developments + total_handed_over_units +
  // flagship_developments until the DB grows those fields.
  const seed = getSeedDeveloperBySlug(slug);
  const developments = dev.id.startsWith("seed:")
    ? []
    : await listDeveloperDevelopments(dev.id);

  return (
    <div className="bg-bz-bg">
      {/* Crumb */}
      <div className="px-12 pt-10 max-w-[1280px]">
        <Link
          href="/developers"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink-2 transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          All developers
        </Link>
      </div>

      {/* Hero */}
      <section className="px-12 pt-8 pb-14 max-w-[1280px]">
        <div className="grid grid-cols-[120px_1fr] gap-12 items-start">
          <PlaceholderImage
            label={dev.slug}
            className="w-[120px] h-[120px] rounded-md"
          />
          <div>
            <Eyebrow>
              Developer{dev.founded_year ? ` · Est. ${dev.founded_year}` : ""}
            </Eyebrow>
            <h1
              className="serif text-[64px] mt-3 font-normal leading-[1.02]"
              style={{ letterSpacing: "-0.025em" }}
            >
              {dev.name}
            </h1>
            {dev.description ? (
              <p className="mt-6 text-[17px] text-bz-ink-2 leading-relaxed max-w-[64ch]">
                {dev.description}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-bz-border bg-bz-surface">
        <div className="px-12 py-10 max-w-[1280px]">
          <div className="grid grid-cols-4 gap-10">
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                Founded
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{ letterSpacing: "-0.018em" }}
              >
                {dev.founded_year ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                HQ
              </div>
              <div className="serif text-[20px] mt-2 leading-tight">
                {dev.headquarters ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                Active developments
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{ letterSpacing: "-0.018em" }}
              >
                {seed?.active_developments ?? developments.length}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                Units handed over
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{ letterSpacing: "-0.018em" }}
              >
                {seed?.total_handed_over_units.toLocaleString() ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bio */}
      <section className="px-12 py-16 max-w-[1200px]">
        <Eyebrow>About</Eyebrow>
        <p className="mt-4 text-[16px] text-bz-ink leading-relaxed max-w-[64ch]">
          {dev.bio ?? dev.description ?? ""}
        </p>
      </section>

      {/* Flagship + awards */}
      <section className="border-t border-bz-border bg-bz-surface">
        <div className="px-12 py-16 max-w-[1280px]">
          <div className="grid grid-cols-2 gap-16">
            <div>
              <Eyebrow>Flagship developments</Eyebrow>
              <ul className="mt-5 flex flex-col gap-3">
                {(seed?.flagship_developments ?? []).map((d) => (
                  <li
                    key={d}
                    className="serif text-[20px] text-bz-ink leading-tight"
                    style={{ letterSpacing: "-0.012em" }}
                  >
                    {d}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Eyebrow>Recognition</Eyebrow>
              {dev.awards.length > 0 ? (
                <ul className="mt-5 flex flex-col gap-3">
                  {dev.awards.map((a) => (
                    <li
                      key={`${a.name}-${a.year}`}
                      className="text-[14px] text-bz-ink-2 leading-relaxed"
                    >
                      · {a.name}
                      {a.year ? ` (${a.year})` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-[14px] text-bz-muted italic">
                  No public industry awards listed.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Current developments — wired via listDeveloperDevelopments() */}
      <section className="px-12 py-16 max-w-[1280px]">
        <Eyebrow>Current developments</Eyebrow>
        <div className="mt-2 flex items-end justify-between gap-8 flex-wrap">
          <h2
            className="serif text-[32px] leading-tight"
            style={{ letterSpacing: "-0.015em" }}
          >
            What&apos;s in market today.
          </h2>
          <Button asChild variant="outline">
            <Link href="/developments">View off-plan index</Link>
          </Button>
        </div>
        {developments.length === 0 ? (
          <div className="mt-8 py-12 text-center text-[14px] text-bz-muted border border-dashed border-bz-border rounded-md">
            No active developments published yet.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-3 gap-6">
            {developments.map((d) => (
              <Link
                key={d.id}
                href={`/developments/${d.slug}`}
                className="group block rounded-md border border-bz-border bg-bz-surface p-6 hover:border-bz-border-strong transition-colors"
              >
                <h3
                  className="serif text-[22px] leading-tight group-hover:text-bz-accent transition-colors"
                  style={{ letterSpacing: "-0.012em" }}
                >
                  {d.name}
                </h3>
                {d.area ? (
                  <div className="mt-2 text-[12.5px] text-bz-muted">
                    {d.area.name}
                  </div>
                ) : null}
                {d.starting_price ? (
                  <div className="mt-3 mono text-[12px] text-bz-ink">
                    From AED {d.starting_price.toLocaleString()}
                  </div>
                ) : null}
                {d.handover_date ? (
                  <div className="mt-1 text-[11px] text-bz-muted">
                    Handover · {d.handover_date}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
