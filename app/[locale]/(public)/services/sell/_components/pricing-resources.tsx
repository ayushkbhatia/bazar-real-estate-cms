import type { ReactNode } from "react";
import Link from "@/components/i18n/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { ImageValue } from "@/lib/master-pages";
import type { TransactionSpark } from "../_data";
import { PricePerAreaUnitText } from "../../../_components/area-text";

/** One card as the master-page editor stores it. */
export type PricingCard = {
  enabled?: boolean;
  eyebrow?: string | null;
  title?: string | null;
  desc?: string | null;
  cta?: string | null;
  href?: string | null;
  primary?: boolean;
  /** `range` | `transactions` | `guides` — anything else draws no motif. */
  visual?: string | null;
  image?: ImageValue | null;
};

export type PricingGuide = {
  enabled?: boolean;
  title?: string | null;
  kicker?: string | null;
  href?: string | null;
};

type Props = {
  spark: TransactionSpark | null;
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  cards: PricingCard[];
  guides: PricingGuide[];
  rangeTitle: string | null;
  /** Low / midpoint / high, in that order. */
  rangeLabels: (string | null)[];
  sparkPlaceholder: string | null;
  sparkNote: string | null;
};

/**
 * "Three ways to get the number right" — the band that stops an owner
 * bouncing to price-check elsewhere. No photography by default: each card
 * carries a data motif instead (a range bar, a trend line, a guide list),
 * named by keyword on the card so the editor can reorder or drop one without
 * the motifs following the wrong card. Picking an image on a card replaces
 * its motif.
 */
export function PricingResources({
  spark,
  eyebrow,
  heading,
  body,
  cards,
  guides,
  rangeTitle,
  rangeLabels,
  sparkPlaceholder,
  sparkNote,
}: Props) {
  const visible = cards.filter((c) => c.enabled !== false && c.title);
  const visibleGuides = guides.filter((g) => g.enabled !== false && g.title);

  const motif = (card: PricingCard): ReactNode => {
    const url = card.image?.url ?? null;
    if (url) {
      return (
        <div className="relative aspect-[16/9] rounded overflow-hidden bg-bz-surface-2">
          <Image
            src={url}
            alt={card.image?.alt ?? ""}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        </div>
      );
    }
    switch (card.visual) {
      case "range":
        return <RangeVisual title={rangeTitle} labels={rangeLabels} />;
      case "transactions":
        return (
          <SparkVisual
            spark={spark}
            placeholder={sparkPlaceholder}
            note={sparkNote}
          />
        );
      case "guides":
        return <GuidesVisual guides={visibleGuides} />;
      default:
        return null;
    }
  };

  return (
    <section className="px-4 md:px-12 py-14 md:py-18 bg-bz-surface-2 border-t border-bz-border">
      <div className="max-w-[1280px]">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2
          className="serif text-[30px] md:text-[40px] mt-2.5"
          style={{ letterSpacing: "-0.025em" }}
        >
          {heading}
        </h2>
        {body ? (
          <p className="text-[15px] text-bz-ink-2 mt-3 max-w-[560px] leading-relaxed">
            {body}
          </p>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-9">
          {visible.map((card, i) => (
            <Card key={`${card.title}-${i}`} card={card} visual={motif(card)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Card({ card, visual }: { card: PricingCard; visual: ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border border-bz-border bg-bz-surface p-6 md:p-[26px]">
      {card.eyebrow ? <Eyebrow>{card.eyebrow}</Eyebrow> : null}
      <h3
        className="serif text-[22px] md:text-[25px] mt-2 leading-tight"
        style={{ letterSpacing: "-0.02em" }}
      >
        {card.title}
      </h3>
      {card.desc ? (
        <p className="text-[13.5px] text-bz-ink-2 mt-2.5 leading-relaxed">
          {card.desc}
        </p>
      ) : null}
      {visual ? <div className="my-6">{visual}</div> : <div className="mb-6" />}
      {card.cta && card.href ? (
        <Link
          href={card.href}
          className={
            card.primary
              ? "mt-auto h-11 rounded inline-flex items-center justify-center gap-2 bg-bz-accent text-bz-accent-fg text-[13.5px] font-medium transition-colors hover:bg-bz-accent-hover"
              : "mt-auto h-11 rounded inline-flex items-center justify-center gap-2 border border-bz-border text-[13.5px] transition-colors hover:bg-bz-surface-2"
          }
        >
          {card.cta}
          <ArrowRight size={15} strokeWidth={1.7} />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The valuation range motif. Deliberately unnumbered — the real range is the
 * one the tool computes for the owner's own unit, and a headline figure here
 * would be a number we made up.
 */
function RangeVisual({
  title,
  labels,
}: {
  title: string | null;
  labels: (string | null)[];
}) {
  return (
    <div>
      {title ? (
        <div
          className="serif text-[22px] md:text-[26px]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {title}
        </div>
      ) : null}
      <div className="relative mt-3">
        <div
          className="h-1.5 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--bz-surface-3) 0%, var(--bz-accent-soft) 30%, var(--bz-accent) 50%, var(--bz-accent-soft) 70%, var(--bz-surface-3) 100%)",
          }}
        />
        <span className="absolute -top-[3px] left-1/2 -translate-x-1/2 size-3 rounded-full bg-white border-2 border-bz-ink" />
      </div>
      <div className="flex justify-between mt-2 text-[10.5px] text-bz-muted">
        {labels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function SparkVisual({
  spark,
  placeholder,
  note,
}: {
  spark: TransactionSpark | null;
  placeholder: string | null;
  note: string | null;
}) {
  // No DLD data loaded yet. Rather than draw an invented trend line, the card
  // says what the surface holds — and keeps the same height so the three
  // cards' buttons still bottom-align.
  if (!spark) {
    return (
      <div>
        <div className="h-16 rounded bg-bz-surface-2 border border-bz-border flex items-center justify-center px-4">
          <span className="text-[11.5px] text-bz-muted text-center leading-snug">
            {placeholder}
          </span>
        </div>
        {note ? (
          <p className="text-[11.5px] text-bz-muted mt-2 leading-relaxed">
            {note}
          </p>
        ) : null}
      </div>
    );
  }

  const { points, first, last, caption } = spark;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = 300 / Math.max(points.length - 1, 1);
  const coords = points.map((v, i) => ({
    x: i * step,
    y: 58 - ((v - min) / span) * 50,
  }));
  const line = coords.map((c) => `${c.x},${c.y.toFixed(1)}`).join(" L");
  const end = coords[coords.length - 1]!;

  return (
    <div>
      <svg
        width="100%"
        height="64"
        viewBox="0 0 300 64"
        preserveAspectRatio="none"
        role="img"
        aria-label={caption}
      >
        <defs>
          <linearGradient id="bz-sell-spark" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--bz-accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--bz-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M${line} L300,64 L0,64 Z`} fill="url(#bz-sell-spark)" />
        <path
          d={`M${line}`}
          stroke="var(--bz-accent)"
          strokeWidth="1.8"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={end.x} cy={end.y} r="3" fill="var(--bz-accent)" />
      </svg>
      <div className="flex justify-between mt-1.5 text-[10.5px] text-bz-muted">
        <span className="mono">
          <PricePerAreaUnitText aedPerFt2={Math.round(first)} />
        </span>
        <span className="mono">
          <PricePerAreaUnitText aedPerFt2={Math.round(last)} />
        </span>
      </div>
      <div className="text-[11.5px] text-bz-muted mt-2">{caption}</div>
    </div>
  );
}

function GuidesVisual({ guides }: { guides: PricingGuide[] }) {
  if (guides.length === 0) return null;
  return (
    <ul>
      {guides.map((g, i) => (
        <li
          key={`${g.href}-${i}`}
          className="flex items-center gap-3 py-2.5 border-b border-bz-border last:border-b-0"
        >
          <span className="mono text-[10.5px] text-bz-muted-2">
            {String(i + 1).padStart(2, "0")}
          </span>
          {g.href ? (
            <Link
              href={g.href}
              className="flex-1 text-[12.5px] leading-snug hover:text-bz-accent transition-colors"
            >
              {g.title}
            </Link>
          ) : (
            <span className="flex-1 text-[12.5px] leading-snug">{g.title}</span>
          )}
          {g.kicker ? (
            <span className="text-[10.5px] text-bz-muted">{g.kicker}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
