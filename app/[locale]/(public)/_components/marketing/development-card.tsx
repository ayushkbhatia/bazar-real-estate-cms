import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/link";
import Image from "next/image";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { mediaPublicUrl } from "@/lib/media";
import {
  developmentUrl,
  type listPublishedDevelopments,
} from "@/lib/queries/developments";
import { handoverQuarter, quarterArgs } from "@/lib/developments/handover";
import { PriceText } from "../area-text";
import { getCardLabelResolver } from "@/lib/queries/card-labels";
import type { ResolvedCardLabel } from "@/lib/card-labels";
import { cn } from "@/lib/utils";

/**
 * The same five chip styles `components/brand/listing-card.tsx` draws, so a
 * label looks the same over a development render as it does over a property
 * photograph. Duplicated rather than exported from the card, because the card
 * is a shared brand component and this is a page-level composition — importing
 * a style map across that line is the kind of coupling that makes the shared
 * component harder to change later.
 */
const DEV_LABEL_STYLES: Record<ResolvedCardLabel["kind"], string> = {
  ink: "bg-bz-navy text-bz-bg",
  accent: "bg-bz-accent-soft text-bz-accent",
  success: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  warn: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  danger: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
};

type Development = Awaited<
  ReturnType<typeof listPublishedDevelopments>
>[number];

/**
 * Featured off-plan development card for the New Projects master page. Mirrors
 * the card on /developments so the two surfaces stay visually consistent.
 */
export async function DevelopmentCard({ d }: { d: Development }) {
  const tc = await getTranslations("development.card");
  const resolve = await getCardLabelResolver();
  const cardLabels = resolve({ labels: d.card_labels });
  const handover = handoverQuarter(d.handover_date);
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
        {/*
          Card labels, then the tagline.

          Both, not one or the other: the tagline is this development's own
          sentence and a label is the client's vocabulary applied to it, so a
          project can be "Launching Q4" AND carry "New launch". They share one
          wrapping row so a long tagline pushes the chips down rather than
          under the card's other corner.
        */}
        {cardLabels.length || d.tagline ? (
          <div className="absolute top-3.5 start-3.5 z-10 flex max-w-[calc(100%-4rem)] flex-wrap items-start gap-1.5">
            {cardLabels.map((l) => (
              <span
                key={l.id}
                className={cn(
                  "inline-flex items-center h-[24px] px-2.5 rounded-full text-[11px] font-medium",
                  DEV_LABEL_STYLES[l.kind],
                )}
              >
                {l.label}
              </span>
            ))}
            {d.tagline ? (
              <span className="inline-flex items-center h-[24px] px-2.5 rounded-full text-[11px] font-medium bg-bz-navy text-bz-bg">
                {d.tagline}
              </span>
            ) : null}
          </div>
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
          {(
            [
              [tc("from"), <PriceText key="from" aed={d.starting_price} />],
              [tc("bedrooms"), d.bedrooms_text ?? "—"],
              [
                tc("handoverLabel"),
                handover ? tc("quarter", quarterArgs(handover)) : "—",
              ],
            ] as [string, React.ReactNode][]
          ).map(([label, value]) => (
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
