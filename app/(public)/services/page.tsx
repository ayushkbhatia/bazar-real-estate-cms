import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { fluid } from "../_components/marketing/fluid";
import { SectionHead } from "../_components/marketing/section-head";
import { StepFlow } from "../_components/marketing/step-flow";
import { WhyBand } from "../_components/marketing/why-band";
import { Faq } from "../_components/marketing/faq";

export const metadata: Metadata = {
  title: "Services · Bazar Real Estate",
  description:
    "Buy, sell, rent, manage, or finance — every service is backed by over 20 years of UAE market experience and a single, senior point of contact.",
  alternates: { canonical: "/services" },
};

type Practice = {
  id: string;
  n: string;
  title: string;
  sub: string;
  help: string[];
  helpLabel?: string;
  steps: [string, string][];
  cta: string;
  ctaHref: string;
};

const PRACTICES: Practice[] = [
  {
    id: "buy",
    n: "01",
    title: "Buy a Property",
    sub: "Find the right property with confidence — residential, commercial, and land opportunities across Abu Dhabi's most sought-after communities.",
    help: [
      "Apartments",
      "Villas",
      "Townhouses",
      "Penthouses",
      "Commercial",
      "Land",
      "Off-Plan",
      "Ready & Resale",
      "Investment",
    ],
    steps: [
      ["Understand your needs", "Location, budget, property type, and goals."],
      ["Shortlist properties", "Suitable options based on your requirements."],
      [
        "Provide market guidance",
        "Insight on value, demand, and growth potential.",
      ],
      ["Arrange viewings", "Clear property comparisons and viewing support."],
      ["Support the process", "Guidance from offer to completion."],
    ],
    cta: "Start a buying enquiry",
    ctaHref: "/buy",
  },
  {
    id: "sell",
    n: "02",
    title: "Sell Your Property",
    sub: "Looking to sell in Abu Dhabi? Our experts support you at every step — from valuation to closing.",
    help: [
      "Apartments",
      "Villas",
      "Townhouses",
      "Penthouses",
      "Commercial",
      "Land",
      "Investment",
      "Ready & Resale",
    ],
    steps: [
      [
        "Property valuation",
        "Location, condition, size, view, demand and recent activity.",
      ],
      ["Pricing strategy", "A realistic price that attracts serious buyers."],
      ["Listing support", "Clear details and strong presentation."],
      ["Marketing exposure", "Promotion across suitable channels."],
      [
        "Buyer qualification",
        "We filter serious enquiries and arrange viewings.",
      ],
      ["Negotiation & closing", "Support from offer to completion."],
    ],
    cta: "Request a valuation",
    ctaHref: "/services/sell",
  },
  {
    id: "rent",
    n: "03",
    title: "Rent a Property",
    sub: "Our team helps tenants find the right rental with clarity and confidence.",
    help: [
      "Apartments",
      "Villas",
      "Townhouses",
      "Penthouses",
      "Commercial Spaces",
      "Offices",
      "Retail Units",
    ],
    steps: [
      ["Understand your needs", "Location, budget, size, and move-in date."],
      ["Shortlist rentals", "Suitable options based on your requirements."],
      [
        "Arrange viewings",
        "Viewing coordination and property comparisons.",
      ],
      [
        "Rental guidance",
        "Clear guidance on payments and tenancy details.",
      ],
      ["Move-in support", "Help with the next steps after selection."],
    ],
    cta: "Find a rental",
    ctaHref: "/rent",
  },
  {
    id: "manage",
    n: "04",
    title: "Property Management",
    sub: "Professional property management for landlords and investors — protect your asset and keep tenants satisfied.",
    help: [
      "Apartments",
      "Villas",
      "Townhouses",
      "Penthouses",
      "Commercial Units",
      "Offices",
      "Retail Spaces",
      "Investment",
    ],
    steps: [
      ["Tenant coordination", "Communication and daily property matters."],
      [
        "Leasing support",
        "Tenant placement, renewals, and rental guidance.",
      ],
      ["Maintenance coordination", "Maintenance follow-up and support."],
      ["Inspections & updates", "Property checks and owner updates."],
      ["Documentation support", "Rental records and document coordination."],
      ["Owner support", "Ongoing support for landlords."],
    ],
    cta: "Request management support",
    ctaHref: "/services/manage",
  },
  {
    id: "mortgage",
    n: "05",
    title: "Mortgage Support",
    sub: "Mortgage guidance for confident property decisions — know your budget early and search with focus.",
    helpLabel: "Who this service is for",
    help: [
      "First-time buyers",
      "UAE residents",
      "Non-resident buyers",
      "Investors",
      "End-users",
      "Cash vs. mortgage",
    ],
    steps: [
      ["Budget guidance", "Understand your buying power."],
      ["Pre-approval support", "Plan before selecting a property."],
      ["Banking coordination", "Connect with trusted mortgage partners."],
      ["Property matching", "Search based on your financing position."],
      ["Process support", "Guidance from search to completion."],
    ],
    cta: "Request mortgage guidance",
    ctaHref: "/tools/mortgage",
  },
];

export default function ServicesPage() {
  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-12">
        <Eyebrow>What we do</Eyebrow>
        <h1
          className="serif mt-3.5 max-w-[1040px]"
          style={{
            fontSize: fluid(88),
            letterSpacing: "-0.03em",
            lineHeight: 0.97,
          }}
        >
          Five practices,
          <br />
          one bench of <em className="italic">advisors.</em>
        </h1>
        <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[680px] leading-relaxed mt-5">
          Buy, sell, rent, manage, or finance — every service is backed by over
          20 years of UAE market experience and a single, senior point of
          contact.
        </p>
        <div className="flex flex-wrap gap-2 mt-8">
          {PRACTICES.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-bz-border bg-bz-surface text-[13.5px]"
            >
              <span className="mono text-bz-accent text-[11px]">{p.n}</span>
              {p.title}
            </span>
          ))}
        </div>
      </section>

      {PRACTICES.map((p, i) => (
        <section
          key={p.id}
          className={
            "px-4 md:px-12 py-12 md:py-14 border-t border-bz-border " +
            (i % 2 ? "bg-bz-surface-2" : "")
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.4fr] gap-10 lg:gap-16 items-start max-w-[1280px]">
            <div>
              <div
                className="serif text-bz-muted-2"
                style={{ fontSize: fluid(60), letterSpacing: "-0.02em", lineHeight: 1 }}
              >
                {p.n}
              </div>
              <h2
                className="serif mt-4"
                style={{ fontSize: fluid(42), letterSpacing: "-0.025em", lineHeight: 1.05 }}
              >
                {p.title}
              </h2>
              <p className="text-[15px] md:text-[16px] text-bz-ink-2 leading-relaxed mt-4 max-w-[420px]">
                {p.sub}
              </p>
              <div className="eyebrow mt-7">
                {p.helpLabel ??
                  `What we help you ${
                    p.id === "manage" ? "manage" : p.title.split(" ")[0].toLowerCase()
                  }`}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {p.help.map((h) => (
                  <span
                    key={h}
                    className="px-3 py-1 rounded-full bg-bz-surface border border-bz-border text-[12.5px]"
                  >
                    {h}
                  </span>
                ))}
              </div>
              <Button
                asChild
                className="mt-7 bg-bz-ink text-bz-bg hover:bg-bz-ink/90"
              >
                <Link href={p.ctaHref}>
                  {p.cta}
                  <ArrowRight size={15} strokeWidth={1.7} />
                </Link>
              </Button>
            </div>
            <div>
              <div className="eyebrow mb-2">How we support you</div>
              <StepFlow steps={p.steps} />
            </div>
          </div>
        </section>
      ))}

      <WhyBand
        title="Every practice, one senior partner on your file."
        body="Over 20 years of UAE real estate experience, direct developer and banking relationships, and client-focused guidance — combined so you make confident decisions whether you're buying, selling, renting, managing, or financing."
        stats={[
          ["20+ yrs", "UAE market experience"],
          ["1", "senior partner per file"],
        ]}
      />

      <section className="px-4 md:px-12 py-14 md:py-20">
        <div className="max-w-[1200px]">
          <SectionHead
            eyebrow="Common questions"
            title="Across every service."
            size={44}
            className="mb-8"
          />
          <Faq
            items={[
              [
                "Can Bazar help me buy both ready and off-plan properties?",
                "Yes. We assist with ready, resale, and off-plan property purchases across Abu Dhabi and the wider UAE.",
              ],
              [
                "How do I know how much my property is worth?",
                "Property value depends on location, size, condition, view, demand, and recent market activity. We provide a considered valuation before you list.",
              ],
              [
                "Is property management useful for overseas landlords?",
                "Yes. It is especially helpful for owners who are not based near their property or prefer professional support.",
              ],
              [
                "Can non-residents get a mortgage in the UAE?",
                "Some banks offer mortgage options for eligible non-residents, subject to bank criteria and approval. We connect you with suitable partners.",
              ],
            ]}
          />
        </div>
      </section>
    </div>
  );
}
