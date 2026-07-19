import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import {
  getDeveloperBySlug,
  listDeveloperDevelopments,
} from "@/lib/queries/developers-extras";
import { DEVELOPERS, getDeveloperDir } from "../_data";

export function generateStaticParams() {
  return DEVELOPERS.map((d) => ({ slug: d.slug }));
}

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dir = getDeveloperDir(slug);
  if (!dir) return { title: "Developer not found" };
  return {
    title: `${dir.name} · Bazar Real Estate`,
    description: dir.blurb,
    alternates: { canonical: `/developers/${dir.slug}` },
  };
}

export default async function DeveloperProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Identity (name / logo / descriptor) comes from the directory so every
  // developer resolves even before it has a DB row.
  const dir = getDeveloperDir(slug);
  if (!dir) notFound();

  // Enrich with the live catalogue when Supabase is configured and this
  // developer has a matching row; otherwise the developments grid shows its
  // empty state.
  const detail = await getDeveloperBySlug(slug);
  const developments =
    detail && !detail.id.startsWith("seed:")
      ? await listDeveloperDevelopments(detail.id)
      : [];
  const description = detail?.description ?? dir.blurb;

  return (
    <div className="bg-bz-bg">
      {/* Crumb */}
      <div className="px-4 md:px-12 pt-10">
        <Link
          href="/developers"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-teal hover:text-bz-navy transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          All developers
        </Link>
      </div>

      {/* Hero — logo, name, short description */}
      <section className="px-4 md:px-12 pt-8 pb-14 md:pb-16 border-b border-bz-border">
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 md:gap-12 items-center">
          <div className="flex items-center justify-center bg-white rounded-xl border border-bz-border w-[160px] h-[160px] md:w-[200px] md:h-[200px] p-7">
            <Image
              src={dir.logo}
              alt={dir.name}
              width={dir.w}
              height={dir.h}
              className="h-full w-full object-contain"
              sizes="200px"
              priority
            />
          </div>
          <div>
            <Eyebrow>Developer</Eyebrow>
            <h1
              className="serif text-[40px] md:text-[64px] mt-3 font-normal leading-[1.02]"
              style={{ letterSpacing: "-0.025em" }}
            >
              {dir.name}
            </h1>
            {description ? (
              <p className="mt-6 text-[16px] md:text-[17px] text-bz-ink-2 leading-relaxed max-w-[64ch]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Developments */}
      <section className="px-4 md:px-12 py-14 md:py-20">
        <div className="flex items-end justify-between gap-8 flex-wrap">
          <div>
            <Eyebrow>Developments</Eyebrow>
            <h2
              className="serif text-[30px] md:text-[36px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              {dir.name}&apos;s projects.
            </h2>
          </div>
          <Button asChild variant="outline">
            <Link href="/off-plan">Browse all off-plan</Link>
          </Button>
        </div>

        {developments.length === 0 ? (
          <div className="mt-10 py-16 text-center border border-dashed border-bz-border rounded-xl">
            <p className="text-[14px] text-bz-ink-2">
              No developments published for {dir.name} yet.
            </p>
            <Button asChild variant="ghost" className="mt-4">
              <Link href="/off-plan">Explore the wider off-plan market</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {developments.map((d) => (
              <Link
                key={d.id}
                href={`/developments/${d.slug}`}
                className="group block rounded-lg border border-bz-border bg-bz-surface p-6 hover:border-bz-border-strong transition-colors"
              >
                <h3
                  className="serif text-[22px] leading-tight group-hover:text-bz-accent transition-colors"
                  style={{ letterSpacing: "-0.012em" }}
                >
                  {d.name}
                </h3>
                {d.area ? (
                  <div className="mt-2 text-[12.5px] text-bz-ink-2">
                    {d.area.name}
                  </div>
                ) : null}
                {d.starting_price ? (
                  <div className="mt-3 mono text-[12px] text-bz-ink">
                    From AED {d.starting_price.toLocaleString()}
                  </div>
                ) : null}
                {d.handover_date ? (
                  <div className="mt-1 text-[11px] text-bz-ink-2">
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
