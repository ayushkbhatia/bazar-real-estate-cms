import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import {
  developmentUrl,
  listPublishedDevelopments,
} from "@/lib/queries/developments";
import { quarterLabel } from "@/lib/schemas/development";
import { PriceText } from "../_components/area-text";
import { mediaPublicUrl } from "@/lib/media";

export const metadata: Metadata = {
  title: "Developments · Off-plan in Abu Dhabi",
  description:
    "Pre-launch and on-sale developments by Aldar, Reportage, IMKAN, and Abu Dhabi's leading developers — curated by Bazar.",
  alternates: { canonical: "/developments" },
};

export const revalidate = 120;

export default async function DevelopmentsIndexPage() {
  const developments = await listPublishedDevelopments();

  return (
    <div className="bg-bz-bg">
      <section className="px-12 pt-16 pb-10 border-b border-bz-border">
        <Eyebrow>Off-plan developments</Eyebrow>
        <h1
          className="serif text-[64px] font-normal mt-3 leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          New launches in Abu Dhabi
        </h1>
        <p className="mt-5 text-[16px] text-bz-muted max-w-[60ch] leading-[1.6]">
          Developments we&apos;ve closely diligenced — payment plans, escrow
          terms, and unit pricing. Many include Bazar-only pre-launch
          inventory weeks before public release.
        </p>
      </section>

      <section className="px-12 py-12">
        {developments.length === 0 ? (
          <div className="py-24 text-center">
            <Eyebrow>Empty</Eyebrow>
            <p className="mt-3 text-[15px] text-bz-muted">
              No published developments yet. Sign in to /admin to add one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {developments.map((d) => (
              <DevelopmentCard key={d.id} d={d} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DevelopmentCard({
  d,
}: {
  d: Awaited<ReturnType<typeof listPublishedDevelopments>>[number];
}) {
  return (
    <Link
      href={developmentUrl(d)}
      className="group block rounded-xl overflow-hidden border border-bz-border bg-bz-surface hover:border-bz-ink-2 transition-colors"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        {d.hero ? (
          <Image
            src={mediaPublicUrl(d.hero.storage_key)}
            alt={d.hero.alt_text ?? d.name}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <PlaceholderImage label={d.slug} dark className="absolute inset-0" />
        )}
        {d.tagline ? (
          <span className="absolute top-4 left-4 inline-flex items-center h-[24px] px-2.5 rounded-full text-[11px] font-medium bg-bz-accent text-white">
            {d.tagline}
          </span>
        ) : null}
      </div>
      <div className="px-6 pt-5 pb-6">
        <div className="eyebrow flex items-center gap-2">
          {d.developer ? <span>{d.developer.name}</span> : null}
          {d.area ? (
            <>
              <span aria-hidden>·</span>
              <span>{d.area.name}</span>
            </>
          ) : null}
        </div>
        <h2
          className="serif text-[32px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.022em" }}
        >
          {d.name}
        </h2>
        {d.description ? (
          <p className="mt-2.5 text-[14px] text-bz-muted leading-[1.55] line-clamp-2">
            {d.description}
          </p>
        ) : null}
        <div className="mt-5 pt-5 border-t border-bz-border grid grid-cols-3 gap-4">
          <Stat
            value={<PriceText aed={d.starting_price} />}
            label="From"
          />
          <Stat
            value={d.bedrooms_text ?? "—"}
            label="Bedrooms"
          />
          <Stat
            value={quarterLabel(d.handover_date)}
            label="Handover"
          />
        </div>
      </div>
    </Link>
  );
}

function Stat({
  value,
  label,
}: {
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div>
      <div
        className="serif text-[20px] leading-tight"
        style={{ letterSpacing: "-0.015em" }}
      >
        {value}
      </div>
      <div className="text-[11px] text-bz-muted mt-0.5">{label}</div>
    </div>
  );
}
