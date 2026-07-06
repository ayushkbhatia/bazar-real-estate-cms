import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";

export const metadata: Metadata = {
  title: "Sitemap",
  description:
    "Every public surface on bazar.ae — listings, market reports, guides, services, communities, developers, and editorial.",
  alternates: { canonical: "/sitemap" },
};

/**
 * T1.5 quick win: human-readable sitemap.  Complements the auto-generated
 * `/sitemap.xml` (which Next emits via `app/sitemap.ts`) with a
 * navigation-style overview a real visitor (or crawler) can click through.
 */

const SECTIONS: { title: string; links: { label: string; href: string }[] }[] =
  [
    {
      title: "Marketplace",
      links: [
        { label: "Buy", href: "/buy" },
        { label: "Rent", href: "/rent" },
        { label: "Off-plan", href: "/off-plan" },
        { label: "Commercial", href: "/commercial" },
        { label: "Exclusive listings", href: "/exclusive" },
        { label: "New this week", href: "/new-this-week" },
        { label: "Price drops", href: "/price-drops" },
        { label: "Sold archive", href: "/sold" },
      ],
    },
    {
      title: "Market reports",
      links: [{ label: "All market reports", href: "/market-reports" }],
    },
    {
      title: "Communities",
      links: [
        { label: "All communities", href: "/communities" },
        { label: "Saadiyat Island", href: "/communities/saadiyat-island" },
        { label: "Yas Island", href: "/communities/yas-island" },
        { label: "Al Reem Island", href: "/communities/al-reem-island" },
        { label: "Al Raha", href: "/communities/al-raha" },
        { label: "Corniche", href: "/communities/corniche" },
      ],
    },
    {
      title: "Developers",
      links: [{ label: "All developers", href: "/developers" }],
    },
    {
      title: "Off-plan projects",
      links: [{ label: "All projects", href: "/developments" }],
    },
    {
      title: "Services",
      links: [
        { label: "Services overview", href: "/services" },
        { label: "Buy with Bazar", href: "/services/buy" },
        { label: "Sell with Bazar", href: "/services/sell" },
        { label: "Property management", href: "/services/manage" },
        { label: "Investment advisory", href: "/services/invest" },
        { label: "Conveyancing", href: "/services/conveyancing" },
        { label: "Snagging inspection", href: "/services/snagging" },
        { label: "Handover support", href: "/services/handover" },
        { label: "Interior design", href: "/services/interior-design" },
        { label: "Residency visas", href: "/services/residency-visas" },
        { label: "Consulting", href: "/services/consulting" },
      ],
    },
    {
      title: "Guides",
      links: [
        { label: "All guides", href: "/guides" },
        { label: "Golden Visa via property", href: "/guides/golden-visa" },
        {
          label: "Property-linked residency",
          href: "/guides/property-linked-residency",
        },
        { label: "UAE Tax Residency Certificate", href: "/guides/tax-residency" },
        {
          label: "KYC for non-resident buyers",
          href: "/guides/kyc-non-residents",
        },
      ],
    },
    {
      title: "Tools",
      links: [
        { label: "Free valuation", href: "/tools/valuation" },
        { label: "Mortgage calculator", href: "/tools/mortgage" },
        { label: "Compare properties", href: "/tools/compare" },
      ],
    },
    {
      title: "Editorial",
      links: [{ label: "Insights & briefs", href: "/insights" }],
    },
    {
      title: "About",
      links: [
        { label: "About Bazar", href: "/about" },
        { label: "The team", href: "/agents" },
        { label: "Press", href: "/press" },
        { label: "Careers", href: "/careers" },
        { label: "Contact", href: "/contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy policy", href: "/legal/privacy" },
        { label: "Terms of use", href: "/legal/terms" },
        { label: "Cookie policy", href: "/legal/cookies" },
      ],
    },
  ];

export default function SitemapPage() {
  return (
    <article className="bg-bz-bg">
      <section className="px-12 pt-24 pb-12 border-b border-bz-border">
        <Eyebrow>Sitemap</Eyebrow>
        <h1
          className="serif text-[64px] mt-3 leading-[1.0] max-w-[24ch]"
          style={{ letterSpacing: "-0.028em" }}
        >
          Everything on bazar.ae.
        </h1>
        <p className="mt-6 max-w-[58ch] text-[17px] text-bz-ink-2 leading-relaxed">
          The public surface of the site, organised by section. The crawler
          version lives at{" "}
          <Link
            href="/sitemap.xml"
            className="underline underline-offset-2 hover:text-bz-ink"
          >
            /sitemap.xml
          </Link>
          .
        </p>
      </section>

      <section className="px-12 py-16">
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 max-w-[1200px]">
          {SECTIONS.map((s) => (
            <li key={s.title}>
              <Eyebrow>{s.title}</Eyebrow>
              <ul className="mt-4 flex flex-col gap-2">
                {s.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[14px] text-bz-ink hover:text-bz-accent transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
