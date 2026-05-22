import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { SEED_AGENTS } from "@/lib/seeds/agents";

export const metadata: Metadata = {
  title: "About Bazar",
  description:
    "Twelve capped advisors. Fiduciary-aligned. A boutique Abu Dhabi advisory firm built on referrals, not portal traffic.",
};

const PRINCIPLES: { eyebrow: string; title: string; body: string }[] = [
  {
    eyebrow: "01 · Capped",
    title: "Twelve advisors. By design.",
    body: "Bazar caps senior advisor headcount at twelve. When a thirteenth seat opens, we turn most candidates away. The cap is the product. It is how we keep the relationships dense and the deals quiet.",
  },
  {
    eyebrow: "02 · Fiduciary",
    title: "Paid by the client, not the developer.",
    body: "Most Abu Dhabi brokers are paid by the listing side. Our advisory fee is on the buyer or seller we represent. That is the only way the conversation is honest.",
  },
  {
    eyebrow: "03 · Off-market",
    title: "The best stock never lists.",
    body: "About 40% of Bazar transactions don't appear on Property Finder or Bayut. Owners who don't want their property publicly listed bring it to us. That deal flow is the moat.",
  },
  {
    eyebrow: "04 · Editorial",
    title: "We write the Brief — and we mean it.",
    body: "The Bazar Brief is read by ~14,400 people in Abu Dhabi, Riyadh, and London. We send it once a week, and it shapes our buyer demand. The market reads us; we read the market.",
  },
];

const STATS: { label: string; value: string; sub: string }[] = [
  { label: "Founded", value: "2018", sub: "By Rashid Bin Faris" },
  { label: "Advisors", value: "12", sub: "Capped, senior only" },
  { label: "Closed lifetime", value: "AED 11.2B", sub: "Across all engagements" },
  { label: "Repeat clients", value: "68%", sub: "Of last year's closes" },
];

export default function AboutPage() {
  return (
    <div className="bg-bz-bg">
      {/* Hero */}
      <section className="px-12 pt-20 pb-16 max-w-[1200px]">
        <Eyebrow>About Bazar</Eyebrow>
        <h1
          className="serif text-[80px] mt-3 font-normal leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Abu Dhabi,<br />
          properly understood.
        </h1>
        <p className="mt-8 text-[17px] text-bz-ink-2 leading-relaxed max-w-[64ch]">
          Bazar is a capped, fiduciary-aligned advisory firm based in Abu Dhabi.
          We do not run a portal. We do not employ junior brokers. We work for
          twelve senior advisors and the people they represent — most often,
          quietly, off-market.
        </p>
      </section>

      {/* Stats */}
      <section className="border-y border-bz-border bg-bz-surface">
        <div className="px-12 py-10 max-w-[1200px]">
          <div className="grid grid-cols-4 gap-10">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                  {s.label}
                </div>
                <div
                  className="serif text-[40px] mt-1 leading-none"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {s.value}
                </div>
                <div className="mt-2 text-[12.5px] text-bz-ink-2">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="px-12 py-20 max-w-[1200px]">
        <Eyebrow>Principles</Eyebrow>
        <h2
          className="serif text-[44px] mt-3 leading-[1.05] max-w-[20ch]"
          style={{ letterSpacing: "-0.02em" }}
        >
          Four rules we organise the firm around.
        </h2>
        <div className="mt-12 grid grid-cols-2 gap-10 gap-y-14">
          {PRINCIPLES.map((p) => (
            <div key={p.eyebrow}>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-accent">
                {p.eyebrow}
              </div>
              <h3
                className="serif text-[26px] mt-3 leading-tight"
                style={{ letterSpacing: "-0.012em" }}
              >
                {p.title}
              </h3>
              <p className="mt-4 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[52ch]">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Team teaser */}
      <section className="border-t border-bz-border bg-bz-surface">
        <div className="px-12 py-20 max-w-[1200px]">
          <Eyebrow>Team</Eyebrow>
          <div className="mt-3 flex items-end justify-between gap-8 flex-wrap">
            <h2
              className="serif text-[44px] leading-[1.05] max-w-[20ch]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Six of our twelve advisors.
            </h2>
            <Button asChild variant="outline">
              <Link href="/agents">Meet the team</Link>
            </Button>
          </div>
          <div className="mt-12 grid grid-cols-3 gap-8 gap-y-12">
            {SEED_AGENTS.slice(0, 6).map((a) => (
              <Link
                key={a.slug}
                href={`/agents/${a.slug}`}
                className="group block"
              >
                <PlaceholderImage
                  label={a.slug}
                  className="w-full aspect-[4/5] rounded-md"
                />
                <div className="mt-4">
                  <div className="text-[15.5px] text-bz-ink group-hover:text-bz-accent transition-colors">
                    {a.display_name}
                  </div>
                  <div className="text-[12.5px] text-bz-muted mt-0.5">
                    {a.title}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-12 py-20 max-w-[1200px]">
        <div className="bg-bz-accent text-bz-accent-fg rounded-lg p-12 grid grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <Eyebrow className="text-bz-accent-fg/70">Get in touch</Eyebrow>
            <h2
              className="serif text-[36px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.015em" }}
            >
              Book a 30-minute advisory call.
            </h2>
            <p className="mt-3 text-[14.5px] opacity-90 max-w-[52ch]">
              We&apos;ll ask what you&apos;re solving for. If we&apos;re the right firm, we&apos;ll
              tell you. If we&apos;re not, we&apos;ll point you to who is.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/contact">Talk to an advisor</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
