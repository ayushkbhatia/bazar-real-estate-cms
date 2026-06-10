import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

export const metadata: Metadata = {
  title: "Guides · UAE residency, tax, and KYC for buyers",
  description:
    "Plain-English walk-throughs of the Golden Visa, 2-year property-linked residency, UAE Tax Residency Certificate, and KYC paperwork for non-resident property buyers.",
  alternates: { canonical: "/guides" },
};

const GUIDES = [
  {
    slug: "golden-visa",
    eyebrow: "Residency · 10-year",
    title: "Golden Visa via property",
    intro:
      "The AED 2M+ route to a 10-year renewable residency. Eligibility, dependants, off-plan rules, and the 4–6 week timeline.",
  },
  {
    slug: "property-linked-residency",
    eyebrow: "Residency · 2-year",
    title: "Property-linked residency",
    intro:
      "The AED 750K+ route. When the 2-year visa is the better fit, mortgage rules, and the realistic application window.",
  },
  {
    slug: "tax-residency",
    eyebrow: "Tax · TRC",
    title: "UAE Tax Residency Certificate",
    intro:
      "The 183-day and 90-day-plus-anchor routes to a TRC. What the certificate does and doesn't cover under the UAE's 130+ treaties.",
  },
  {
    slug: "kyc-non-residents",
    eyebrow: "Compliance · KYC",
    title: "KYC for non-resident buyers",
    intro:
      "The KYC and source-of-funds paperwork to expect at the trustee desk. Compile this before MoU and the transfer day runs smoothly.",
  },
];

export default function GuidesIndexPage() {
  return (
    <article className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-24 pb-12 border-b border-bz-border">
        <Eyebrow>Guides</Eyebrow>
        <h1
          className="serif text-[38px] md:text-[72px] mt-3 leading-[0.98] max-w-[24ch]"
          style={{ letterSpacing: "-0.028em" }}
        >
          Buying paperwork, demystified.
        </h1>
        <p className="mt-6 max-w-[58ch] text-[17px] text-bz-ink-2 leading-relaxed">
          Plain-English walk-throughs of the residency, tax, and KYC paperwork
          that surrounds a UAE property purchase. Each guide includes an
          eligibility checker where useful and a CTA into Bazar&apos;s visa
          desk when you&apos;re ready to act.
        </p>
      </section>

      <section className="px-4 md:px-12 py-16">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1100px]">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="group block rounded-lg border border-bz-border bg-bz-surface p-7 h-full hover:border-bz-ink transition-colors"
              >
                <div className="text-[11px] uppercase tracking-wider text-bz-ink-2">
                  {g.eyebrow}
                </div>
                <h2
                  className="serif text-[28px] mt-2 leading-tight"
                  style={{ letterSpacing: "-0.018em" }}
                >
                  {g.title}
                </h2>
                <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed">
                  {g.intro}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-bz-ink group-hover:text-bz-accent transition-colors">
                  Read the guide
                  <ArrowRight size={13} strokeWidth={1.7} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
