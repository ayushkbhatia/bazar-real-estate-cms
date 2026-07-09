import Link from "next/link";
import Image from "next/image";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { mediaPublicUrl } from "@/lib/media";
import {
  developmentUrl,
  type listPublishedDevelopments,
} from "@/lib/queries/developments";
import { formatStartingPrice, quarterLabel } from "@/lib/schemas/development";

type Development = Awaited<
  ReturnType<typeof listPublishedDevelopments>
>[number];

/**
 * Featured off-plan development card for the New Projects master page. Mirrors
 * the card on /developments so the two surfaces stay visually consistent.
 */
export function DevelopmentCard({ d }: { d: Development }) {
  return (
    <Link
      href={developmentUrl(d)}
      className="group block rounded-xl overflow-hidden border border-bz-border bg-bz-surface hover:border-bz-ink-2 transition-colors"
    >
      <div className="relative aspect-[16/11] overflow-hidden">
        {d.hero ? (
          <Image
            src={mediaPublicUrl(d.hero.storage_key)}
            alt={d.hero.alt_text ?? d.name}
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <PlaceholderImage
            label={`${d.slug} · render`}
            dark
            className="absolute inset-0"
          />
        )}
        {d.tagline ? (
          <span className="absolute top-3.5 left-3.5 inline-flex items-center h-[24px] px-2.5 rounded-full text-[11px] font-medium bg-bz-ink text-bz-bg">
            {d.tagline}
          </span>
        ) : null}
      </div>
      <div className="p-6">
        <div className="eyebrow flex items-center gap-2">
          {d.developer ? <span>{d.developer.name}</span> : null}
        </div>
        <h3
          className="serif text-[26px] mt-1.5 leading-tight"
          style={{ letterSpacing: "-0.015em" }}
        >
          {d.name}
        </h3>
        {d.area ? (
          <div className="text-[13px] text-bz-muted mt-1">{d.area.name}</div>
        ) : null}
        <div className="mt-5 pt-4 border-t border-bz-border grid grid-cols-3 gap-3">
          {[
            ["From", formatStartingPrice(d.starting_price)],
            ["Bedrooms", d.bedrooms_text ?? "—"],
            ["Handover", quarterLabel(d.handover_date)],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[10.5px] uppercase tracking-wide text-bz-muted">
                {label}
              </div>
              <div className="mono text-[13px] mt-1">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}
