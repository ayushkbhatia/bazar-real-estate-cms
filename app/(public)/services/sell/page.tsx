import type { Metadata } from "next";
import { CalendarDays, Check } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { listLeadAreaOptions } from "@/lib/queries/lead-routing";
import { getPublicSiteSettings } from "@/lib/queries/site-settings";
import { fluid } from "../../_components/marketing/fluid";
import { SELL_FAQ, SELL_TRUST_POINTS } from "./_content";
import { getSellHeroStats, getTransactionSpark } from "./_data";
import { FaqAccordion } from "./_components/faq-accordion";
import { ListPropertyForm } from "./_components/list-property-form";
import { PricingResources } from "./_components/pricing-resources";

export const metadata: Metadata = {
  title: "Sell or rent out your property in Abu Dhabi | Bazar",
  description:
    "Tell us about your property and we'll match you with the senior Bazar advisor who covers your community — ADREC-licensed, no upfront fees, one point of contact from valuation through to transfer.",
  alternates: { canonical: "/services/sell" },
};

const DEFAULT_DESK_PHONE = "+971 2 632 2223";

// The hero rail counts live rows and the transactions card reads DLD data, so
// the page is static-with-refresh rather than frozen at build time.
export const revalidate = 3600;

export default async function ListYourPropertyPage() {
  const [areas, stats, spark, settings] = await Promise.all([
    listLeadAreaOptions(),
    getSellHeroStats(),
    getTransactionSpark(),
    getPublicSiteSettings(),
  ]);

  const deskPhone = settings.brand.contact_phone?.trim() || DEFAULT_DESK_PHONE;

  // The page is an SEO landing target for "sell my property Abu Dhabi", so the
  // FAQ ships as structured data as well as an accordion.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SELL_FAQ.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  return (
    <div className="bg-bz-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero — pitch left, form right. Stacks form-first on mobile: an owner
          on a phone should land on the first question, not on the pitch. */}
      <section className="px-4 md:px-12 pt-10 md:pt-[72px] pb-14 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-10 lg:gap-[72px] items-start max-w-[1280px]">
          <div className="order-2 lg:order-1 lg:pt-2">
            <Eyebrow>Owners · Abu Dhabi &amp; Al Ain</Eyebrow>
            <h1
              className="serif mt-3.5"
              style={{
                fontSize: fluid(64),
                letterSpacing: "-0.03em",
                lineHeight: 1.02,
              }}
            >
              Sell or rent out,
              <br />
              with one advisor <em className="italic">accountable.</em>
            </h1>
            <p className="text-[16px] md:text-[17px] text-bz-ink-2 leading-relaxed mt-5 max-w-[480px]">
              Tell us about the property. We match you with the senior Bazar
              advisor who covers your community — the same person runs it from
              valuation through to transfer.
            </p>

            <ul className="flex flex-col gap-3.5 mt-8">
              {SELL_TRUST_POINTS.map(([title, detail]) => (
                <li key={title} className="flex gap-3 items-start">
                  <span className="size-[26px] shrink-0 mt-0.5 rounded-full bg-bz-accent-soft text-bz-accent inline-flex items-center justify-center">
                    <Check size={14} strokeWidth={2} />
                  </span>
                  <div>
                    <div className="text-[14px] font-medium">{title}</div>
                    <div className="text-[12.5px] text-bz-muted mt-0.5 leading-snug">
                      {detail}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {stats.length > 0 ? (
              <div className="flex flex-wrap gap-8 md:gap-9 mt-10 pt-6 border-t border-bz-border">
                {stats.map((s) => (
                  <div key={s.label}>
                    <div
                      className="serif text-[26px] md:text-[30px]"
                      style={{ letterSpacing: "-0.02em" }}
                    >
                      {s.value}
                    </div>
                    <div className="text-[11.5px] text-bz-muted mt-1 max-w-[130px] leading-snug">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="order-1 lg:order-2">
            <ListPropertyForm areas={areas} deskPhone={deskPhone} />
          </div>
        </div>
      </section>

      <PricingResources spark={spark} />

      <section className="px-4 md:px-12 py-16 md:py-20 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[0.62fr_1.38fr] gap-10 lg:gap-[72px] items-start max-w-[1280px]">
          <div>
            <Eyebrow>Questions</Eyebrow>
            <h2
              className="serif text-[30px] md:text-[40px] mt-2.5 leading-[1.1]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Frequently asked
            </h2>
            <p className="text-[14px] text-bz-ink-2 mt-3.5 leading-relaxed">
              Not covered here? Call the desk on{" "}
              <a
                href={`tel:${deskPhone.replace(/\s+/g, "")}`}
                className="text-bz-ink font-medium underline underline-offset-4 decoration-bz-taupe"
              >
                {deskPhone}
              </a>{" "}
              — you&apos;ll get an advisor, not a call centre.
            </p>
            <a
              href="/contact"
              className="mt-5 h-11 px-4 rounded border border-bz-border inline-flex items-center gap-2 text-[13px] transition-colors hover:bg-bz-surface-2"
            >
              <CalendarDays size={15} strokeWidth={1.7} />
              Book a consultation
            </a>
          </div>

          <FaqAccordion items={SELL_FAQ} />
        </div>
      </section>
    </div>
  );
}
