import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { SELL_GUIDE_LINKS } from "../_content";
import type { TransactionSpark } from "../_data";

type Props = { spark: TransactionSpark | null };

/**
 * "Three ways to get the number right" — the band that stops an owner
 * bouncing to price-check elsewhere. No photography by design: each card
 * carries a data motif instead (a range bar, a trend line, a guide list).
 */
export function PricingResources({ spark }: Props) {
  return (
    <section className="px-4 md:px-12 py-14 md:py-18 bg-bz-surface-2 border-t border-bz-border">
      <div className="max-w-[1280px]">
        <Eyebrow>Before you price it</Eyebrow>
        <h2
          className="serif text-[30px] md:text-[40px] mt-2.5"
          style={{ letterSpacing: "-0.025em" }}
        >
          Three ways to get the number right.
        </h2>
        <p className="text-[15px] text-bz-ink-2 mt-3 max-w-[560px] leading-relaxed">
          Overpricing costs more time than any other decision an owner makes.
          Start with the data before you start with an opinion.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-9">
          <Card
            eyebrow="Valuation tool"
            title="Start with the right price"
            body="An instant, data-backed range for your unit — built from registered Abu Dhabi transactions and comparable listings."
            visual={<RangeVisual />}
            href="/tools/valuation"
            cta="Get your estimate"
            primary
          />
          <Card
            eyebrow="Abu Dhabi transactions"
            title="See what buyers actually paid"
            body="Browse registered sales in your community and benchmark against real closings, not asking prices."
            visual={<SparkVisual spark={spark} />}
            href="/market-reports"
            cta="Explore transactions"
          />
          <Card
            eyebrow="Seller guides"
            title="Everything you need to know"
            body="Written by the advisors who do this daily — the paperwork, the fees, and the mistakes that cost owners months."
            visual={<GuidesVisual />}
            href="/guides"
            cta="Read the guides"
          />
        </div>
      </div>
    </section>
  );
}

function Card({
  eyebrow,
  title,
  body,
  visual,
  href,
  cta,
  primary,
}: {
  eyebrow: string;
  title: string;
  body: string;
  visual: ReactNode;
  href: string;
  cta: string;
  primary?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-bz-border bg-bz-surface p-6 md:p-[26px]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3
        className="serif text-[22px] md:text-[25px] mt-2 leading-tight"
        style={{ letterSpacing: "-0.02em" }}
      >
        {title}
      </h3>
      <p className="text-[13.5px] text-bz-ink-2 mt-2.5 leading-relaxed">
        {body}
      </p>
      <div className="my-6">{visual}</div>
      <Link
        href={href}
        className={
          primary
            ? "mt-auto h-11 rounded inline-flex items-center justify-center gap-2 bg-bz-accent text-bz-accent-fg text-[13.5px] font-medium transition-colors hover:bg-bz-accent-hover"
            : "mt-auto h-11 rounded inline-flex items-center justify-center gap-2 border border-bz-border text-[13.5px] transition-colors hover:bg-bz-surface-2"
        }
      >
        {cta}
        <ArrowRight size={15} strokeWidth={1.7} />
      </Link>
    </div>
  );
}

/**
 * The valuation range motif. Deliberately unnumbered — the real range is the
 * one the tool computes for the owner's own unit, and a headline figure here
 * would be a number we made up.
 */
function RangeVisual() {
  return (
    <div>
      <div
        className="serif text-[22px] md:text-[26px]"
        style={{ letterSpacing: "-0.02em" }}
      >
        Your range, in AED
      </div>
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
        <span>Low</span>
        <span>Midpoint</span>
        <span>High</span>
      </div>
    </div>
  );
}

function SparkVisual({ spark }: { spark: TransactionSpark | null }) {
  // No DLD data loaded yet. Rather than draw an invented trend line, the card
  // says what the surface holds — and keeps the same height so the three
  // cards' buttons still bottom-align.
  if (!spark) {
    return (
      <div>
        <div className="h-16 rounded bg-bz-surface-2 border border-bz-border flex items-center justify-center px-4">
          <span className="text-[11.5px] text-bz-muted text-center leading-snug">
            Registered sales by community, building and property type
          </span>
        </div>
        <p className="text-[11.5px] text-bz-muted mt-2 leading-relaxed">
          DLD-sourced · updated each quarter
        </p>
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
        <span className="mono">AED {Math.round(first).toLocaleString("en-GB")}/ft²</span>
        <span className="mono">AED {Math.round(last).toLocaleString("en-GB")}/ft²</span>
      </div>
      <div className="text-[11.5px] text-bz-muted mt-2">{caption}</div>
    </div>
  );
}

function GuidesVisual() {
  return (
    <ul>
      {SELL_GUIDE_LINKS.map((g, i) => (
        <li
          key={g.href}
          className="flex items-center gap-3 py-2.5 border-b border-bz-border last:border-b-0"
        >
          <span className="mono text-[10.5px] text-bz-muted-2">
            {String(i + 1).padStart(2, "0")}
          </span>
          <Link
            href={g.href}
            className="flex-1 text-[12.5px] leading-snug hover:text-bz-accent transition-colors"
          >
            {g.title}
          </Link>
          <span className="text-[10.5px] text-bz-muted">{g.kicker}</span>
        </li>
      ))}
    </ul>
  );
}
