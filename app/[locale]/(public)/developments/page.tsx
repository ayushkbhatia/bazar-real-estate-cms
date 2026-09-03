import type { Locale } from "@/lib/i18n/locales";
import { asLocale } from "@/lib/i18n/locales";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import Image from "next/image";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import {
  developmentUrl,
  listPublishedDevelopments,
} from "@/lib/queries/developments";
import { handoverQuarter, quarterArgs } from "@/lib/developments/handover";
import { PriceText } from "../_components/area-text";
import { mediaPublicUrl } from "@/lib/media";
import { getCardLabelResolver } from "@/lib/queries/card-labels";
import type { ResolvedCardLabel } from "@/lib/card-labels";
import { cn } from "@/lib/utils";

/** Mirrors the five chip styles the listing card draws — see the note beside
 *  the copy of this map in _components/marketing/development-card.tsx. */
const DEV_LABEL_STYLES: Record<ResolvedCardLabel["kind"], string> = {
  ink: "bg-bz-navy text-bz-bg",
  accent: "bg-bz-accent-soft text-bz-accent",
  success: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  warn: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  danger: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
};

export const metadata: Metadata = {
  title: "Developments · Off-plan in Abu Dhabi",
  description:
    "Pre-launch and on-sale developments by Aldar, Reportage, IMKAN, and Abu Dhabi's leading developers — curated by Bazar.",
  alternates: { canonical: "/developments" },
};

export const revalidate = 120;

export default async function DevelopmentsIndexPage({
  params,
}: {
  locale: Locale;
  params: Promise<{ locale: string }>;
}) {
  // Explicit locale, not the ambient lookup: `getTranslations("ns")` reaches
  // for `headers()` and takes this route and its siblings off prerendering,
  // which is what `check:routes` caught.
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pages.developments" });
  const developments = await listPublishedDevelopments();

  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-16 pb-10 border-b border-bz-border">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1
          className="serif text-[36px] md:text-[64px] font-normal mt-3 leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          New launches in Abu Dhabi
        </h1>
        <p className="mt-5 text-[16px] text-bz-muted max-w-[60ch] leading-[1.6]">
          Developments we&apos;ve closely diligenced — payment plans, escrow
          terms, and unit pricing. Many include Bazar-only pre-launch inventory
          weeks before public release.
        </p>
      </section>

      <section className="px-4 md:px-12 py-12">
        {developments.length === 0 ? (
          <div className="py-24 text-center">
            <Eyebrow>{t("empty")}</Eyebrow>
            <p className="mt-3 text-[15px] text-bz-muted">
              No published developments yet. Sign in to /admin to add one.
            </p>
          </div>
        ) : (
          /*
            One-up below md. The two-up grid was ungated, so on a 390px screen
            the 96px of `px-12` gutter left 135px per card; the card's own
            `px-6` and its `grid-cols-3 gap-4` stat row then cut that into 18px
            tracks — "AED 2.0M" alone needs 34px, and a 119px development name
            was clipped into an 85px box. The row *clips* rather than pushes,
            so no horizontal-scroll check ever saw it; `narrowTracks` in
            e2e/mobile-geometry.spec.ts was written for this route. One column
            gives each stat ~92px, which is why the card needs no other change
            — and it makes the card image's `(max-width: 1024px) 100vw` sizes
            hint true on a phone instead of wrong by 2x.
          */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {developments.map((d) => (
              <DevelopmentCard locale={locale} key={d.id} d={d} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function DevelopmentCard({
  locale,
  d,
}: {
  locale: Locale;
  d: Awaited<ReturnType<typeof listPublishedDevelopments>>[number];
}) {
  const t = await getTranslations({ locale, namespace: "pages.developments" });
  const tc = await getTranslations({ locale, namespace: "development.card" });
  const resolve = await getCardLabelResolver(locale);
  const cardLabels = resolve({ labels: d.card_labels });
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
        {/* Card labels, then the tagline — see the note on the sibling card in
            _components/marketing/development-card.tsx. */}
        {cardLabels.length || d.tagline ? (
          <div className="absolute top-4 start-4 z-10 flex max-w-[calc(100%-4rem)] flex-wrap items-start gap-1.5">
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
              <span className="inline-flex items-center h-[24px] px-2.5 rounded-full text-[11px] font-medium bg-bz-accent text-white">
                {d.tagline}
              </span>
            ) : null}
          </div>
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
            label={t("from")}
          />
          <Stat value={d.bedrooms_text ?? "—"} label={t("bedrooms")} />
          <Stat
            value={
              handoverQuarter(d.handover_date)
                ? tc("quarter", quarterArgs(handoverQuarter(d.handover_date)!))
                : "—"
            }
            label={t("handover")}
          />
        </div>
      </div>
    </Link>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
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
