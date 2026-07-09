import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { SEED_DEVELOPERS } from "@/lib/seeds/developers";
import { listDevelopers } from "@/lib/queries/developers-extras";
import { fluid } from "../_components/marketing/fluid";
import { SectionHead } from "../_components/marketing/section-head";

export const metadata: Metadata = {
  title: "Developers · Bazar Real Estate",
  description:
    "Direct relationships with the UAE's leading developers give Bazar clients early access to landmark communities, new launches, and off-plan opportunities.",
  alternates: { canonical: "/developers" },
};

export const revalidate = 300;

const PARTNERS: [string, string][] = [
  ["Aldar Properties", "Landmark Abu Dhabi communities"],
  ["Eagle Hills", "Global waterfront destinations"],
  ["Reportage Properties", "Off-plan residential communities"],
  ["Bloom Holding", "Curated residential communities"],
  ["Burtville Developments", "Premium Abu Dhabi projects"],
  ["Radiant Real Estate", "Al Reem residential towers"],
  ["Nine Yards", "Luxury iconic-location projects"],
  ["Baraka Real Estate", "Modern lifestyle-led projects"],
  ["IMKAN Properties", "Design-led communities"],
  ["Deyaar", "Dubai residential & hospitality"],
  ["Taraf", "Boutique luxury residences"],
  ["SAAS Properties", "Residential & commercial"],
  ["Emaar", "Iconic master communities"],
  ["Binghatti", "Bold branded residences"],
  ["Nakheel", "Iconic waterfront communities"],
  ["Dubai Properties", "Established Dubai communities"],
  ["Sobha Realty", "High-quality villas & apartments"],
  ["Tiger Group", "Mixed-use developments"],
  ["DAMAC", "Premium branded projects"],
  ["Meraas", "Lifestyle destinations"],
  ["Arada", "Destination communities"],
  ["Samana Developers", "Investor-focused off-plan"],
  ["Nshama", "Town Square community"],
  ["RAK Properties", "Northern-emirates waterfront"],
  ["Ohana Development", "Branded waterfront residences"],
  ["ICT Real Estate", "Waterfront residential living"],
];

const REGULATORS: [string, string, string][] = [
  [
    "ADREC",
    "Abu Dhabi Real Estate Centre",
    "The official real estate authority supporting Abu Dhabi's property sector through regulation, services, market information, and compliance.",
  ],
  [
    "DLD",
    "Dubai Land Department",
    "The government authority responsible for real estate registration, services, transactions, and market regulation in Dubai.",
  ],
];

const BANKS: [string, string, string][] = [
  [
    "ADIB",
    "Abu Dhabi Islamic Bank",
    "Sharia-compliant banking and home finance solutions for eligible property buyers.",
  ],
  [
    "ADCB",
    "Abu Dhabi Commercial Bank",
    "Mortgage and home finance for UAE nationals, residents, and eligible non-residents.",
  ],
  [
    "FAB",
    "First Abu Dhabi Bank",
    "One of the UAE's leading institutions, supporting clients with banking and mortgage services.",
  ],
  [
    "DIB",
    "Dubai Islamic Bank",
    "Islamic banking and home finance solutions for property buyers across the UAE.",
  ],
];

export default async function DevelopersPage() {
  const developers = await listDevelopers();
  const seedBySlug = new Map(SEED_DEVELOPERS.map((s) => [s.slug, s]));
  const featured = developers.slice(0, 9);

  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-12">
        <Eyebrow>Developers</Eyebrow>
        <h1
          className="serif mt-3.5 max-w-[1000px]"
          style={{
            fontSize: fluid(84),
            letterSpacing: "-0.03em",
            lineHeight: 0.98,
          }}
        >
          The developers
          <br />
          shaping <em className="italic">the UAE.</em>
        </h1>
        <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[680px] leading-relaxed mt-5">
          Direct relationships with the region&apos;s leading developers give
          Bazar clients early access to landmark communities, new launches, and
          off-plan opportunities.
        </p>
      </section>

      {/* Top developers */}
      {featured.length > 0 ? (
        <section className="px-4 md:px-12 pb-16 md:pb-24">
          <div className="max-w-[1200px]">
            <SectionHead
              eyebrow="Top developers"
              title="Landmark builders we work with."
              size={40}
              className="mb-9"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((d) => {
                const seed = seedBySlug.get(d.slug);
                return (
                  <Link
                    key={d.id}
                    href={`/developers/${d.slug}`}
                    className="group flex flex-col rounded-lg border border-bz-border bg-bz-surface overflow-hidden hover:border-bz-border-strong transition-colors"
                  >
                    <div
                      className="relative w-full"
                      style={{ aspectRatio: "16/9" }}
                    >
                      <PlaceholderImage
                        label={`${d.slug} · community`}
                        className="absolute inset-0 h-full w-full"
                      />
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-bz-surface-3 flex items-center justify-center serif text-[18px]">
                          {d.name[0]}
                        </div>
                        <div
                          className="serif text-[23px] leading-tight"
                          style={{ letterSpacing: "-0.01em" }}
                        >
                          {d.name}
                        </div>
                      </div>
                      {d.description ? (
                        <p className="text-[13px] text-bz-ink-2 leading-relaxed mt-4 flex-1">
                          {d.description}
                        </p>
                      ) : (
                        <div className="flex-1" />
                      )}
                      {seed ? (
                        <div className="mt-4 text-[12px] text-bz-muted">
                          Active developments ·{" "}
                          <span className="mono text-bz-ink">
                            {seed.active_developments}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 mt-4 text-[13px] font-medium text-bz-accent">
                        View all developments
                        <ArrowRight size={14} strokeWidth={1.8} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* Our partners */}
      <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border bg-bz-ink text-white">
        <div className="max-w-[1200px]">
          <SectionHead
            eyebrow="Our partners"
            title="Working with leading developers across the UAE."
            sub="Access to established communities, new launches, luxury residences, and investment opportunities across Abu Dhabi, Dubai and the wider UAE."
            size={44}
            dark
            className="mb-10"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/15 border border-white/15 rounded-xl overflow-hidden">
            {PARTNERS.map(([name, desc]) => (
              <div
                key={name}
                className="bg-bz-ink p-6 min-h-[120px] flex flex-col justify-between"
              >
                <div
                  className="serif text-white text-[22px]"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {name}
                </div>
                <div className="text-[11.5px] text-white/60 leading-snug mt-3">
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Accreditations & banking */}
      <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border">
        <div className="max-w-[1200px]">
          <SectionHead
            eyebrow="Accreditations & banking partners"
            title="Recognised across the UAE real estate market."
            sub="Bazar operates within the UAE's regulated property market, working with recognised regulatory bodies and trusted financial institutions."
            size={44}
            className="mb-11"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-14">
            <div>
              <div className="eyebrow mb-5">Regulatory bodies</div>
              {REGULATORS.map(([abbr, name, desc]) => (
                <div
                  key={abbr}
                  className="flex gap-5 py-5 border-t border-bz-border"
                >
                  <div className="w-14 h-14 rounded-md bg-bz-surface-2 flex items-center justify-center mono text-[13px] font-medium flex-shrink-0">
                    {abbr}
                  </div>
                  <div>
                    <div className="serif text-[20px]">{name}</div>
                    <p className="text-[13px] text-bz-muted leading-relaxed mt-1.5">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="eyebrow mb-5">Banking & mortgage partners</div>
              {BANKS.map(([abbr, name, desc]) => (
                <div
                  key={abbr}
                  className="flex gap-5 py-4 border-t border-bz-border items-center"
                >
                  <div className="w-14 h-11 rounded-md bg-bz-surface-2 flex items-center justify-center mono text-[13px] font-medium flex-shrink-0">
                    {abbr}
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] font-medium">{name}</div>
                    <p className="text-[12.5px] text-bz-muted leading-snug mt-0.5">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
              <Button asChild className="mt-6">
                <Link href="/tools/mortgage">
                  <Phone size={15} strokeWidth={1.8} />
                  Speak to a mortgage advisor
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
