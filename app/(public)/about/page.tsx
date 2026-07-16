import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { fluid } from "../_components/marketing/fluid";
import { SectionHead } from "../_components/marketing/section-head";
import { HqMapCanvas } from "../contact/_components/hq-map-canvas";
import { PartnerEcosystemSection } from "../_components/partner-ecosystem-section";

// Bazar HQ — Al Bateen, Abu Dhabi. Same coordinate as the /contact HQ map so
// the two location surfaces stay 1:1.
const HQ_LAT = 24.4619;
const HQ_LNG = 54.3487;
const HQ_DIRECTIONS = `https://www.google.com/maps/dir/?api=1&destination=${HQ_LAT},${HQ_LNG}`;

export const metadata: Metadata = {
  title: "About Bazar Real Estate",
  description:
    "A trusted name in UAE real estate since 2005 — over 20 years of trust, transparency, and proven market experience across Abu Dhabi and the wider UAE.",
  alternates: { canonical: "/about" },
};

const VALUES: [string, string][] = [
  ["Trust", "Transparency, reliability, and long-term confidence."],
  ["Excellence", "Premium standards across every client experience."],
  [
    "Access",
    "Strong connections with developers, banks, and industry partners.",
  ],
  ["Customer Focus", "Client satisfaction, success, and long-term value."],
  ["Innovation", "Smart solutions for evolving market needs."],
];

const EXPERTISE = [
  "Off-Plan Sales",
  "Secondary Market",
  "Listing Services",
  "Property Investment",
  "Property Management",
  "Real Estate Consulting",
  "Luxury Properties",
  "Commercial Real Estate",
  "Mortgage & Banking Guidance",
];

const PARTNERS = [
  "Aldar Properties",
  "Modon Properties",
  "Bloom Holding",
  "IMKAN Properties",
  "Reportage Properties",
  "Eagle Hills",
  "Radiant Real Estate",
  "Ohana Development",
  "Taraf",
];

const HIGHLIGHTS = [
  "Established in 2005",
  "Two decades of experience",
  "Award-winning UAE agency",
  "Strong Abu Dhabi presence",
  "Experienced local team",
  "Trusted developer relationships",
];

export default function AboutPage() {
  return (
    <div className="bg-bz-bg">
      {/* Hero — text left, office image right, at the same level */}
      <section className="px-4 md:px-12 pt-10 md:pt-16 pb-12 md:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
          <div>
            <Eyebrow>About Bazar Real Estate</Eyebrow>
            <h1
              className="serif mt-4"
              style={{
                fontSize: fluid(64),
                letterSpacing: "-0.03em",
                lineHeight: 1.0,
              }}
            >
              A trusted name in UAE
              <br />
              real estate <em className="italic">since 2005.</em>
            </h1>
            <div className="eyebrow mt-6">Established Abu Dhabi · 2005</div>
            <div className="text-[15.5px] md:text-[17px] leading-[1.65] text-bz-ink-2 mt-3.5 max-w-[620px]">
              <p className="m-0">
                Established in Abu Dhabi in 2005, Bazar Real Estate L.L.C. is a
                leading award-winning real estate agency in the UAE, built on
                over 20 years of trust, transparency, and proven market
                experience.
              </p>
              <p className="mt-4">
                With deep roots in Abu Dhabi and a growing presence across the
                wider UAE, Bazar has developed a trusted reputation for market
                expertise, professional excellence, and strong industry
                relationships in one of the region&apos;s most dynamic real
                estate markets.
              </p>
            </div>
          </div>
          <div className="relative w-full" style={{ aspectRatio: "4/3" }}>
            <PlaceholderImage
              label="bazar office · al bateen · abu dhabi"
              className="absolute inset-0 h-full w-full rounded-xl"
            />
          </div>
        </div>
      </section>

      {/* Beyond property + Our story */}
      <section className="px-4 md:px-12 py-14 md:py-18 border-t border-bz-border">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-[72px]">
          {[
            [
              "Beyond property",
              "A partner, not just a broker.",
              [
                "At Bazar Real Estate, we go beyond property transactions. We act as a trusted partner for clients navigating Abu Dhabi and the wider UAE real estate market, combining local expertise with a modern, investor-focused approach.",
                "With direct relationships with leading developers, financial partners, and key industry stakeholders, Bazar provides clients with the knowledge, access, and confidence needed to make informed property decisions.",
              ],
            ],
            [
              "Our story",
              "Twenty years, built on the ground.",
              [
                "Founded in Abu Dhabi in 2005 by Azmi Mohamdin, Bazar Real Estate was built on deep, hands-on knowledge of the local property market.",
                "Over the years, the company has grown into a trusted real estate partner, known for clear guidance, market insight, professionalism, transparency, and long-term value. Our journey reflects the growth of the UAE property sector itself — from established communities to landmark developments and emerging investment destinations.",
              ],
            ],
          ].map(([eyebrow, title, paras]) => (
            <div key={eyebrow as string}>
              <div className="eyebrow">{eyebrow as string}</div>
              <h2
                className="serif mt-3.5"
                style={{
                  fontSize: fluid(36),
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                }}
              >
                {title as string}
              </h2>
              {(paras as string[]).map((p, i) => (
                <p
                  key={i}
                  className="text-[15.5px] text-bz-ink-2 leading-[1.7] mt-4"
                >
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="px-4 md:px-12 py-16 md:py-24 bg-bz-ink text-white text-center">
        <div className="max-w-[1000px] mx-auto">
          <Eyebrow className="text-white/60">Our mission</Eyebrow>
          <h2
            className="serif text-white mt-5 mx-auto"
            style={{
              fontSize: fluid(52),
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
            }}
          >
            To guide clients through the UAE real estate market with clarity,
            integrity, and strategic insight.
          </h2>
          <p className="text-[15px] md:text-[16px] text-white/75 leading-[1.7] mt-6 max-w-[700px] mx-auto">
            Drawing on over 20 years of local expertise, strong developer
            relationships, and in-depth market knowledge, we deliver tailored
            property guidance that creates lasting value and a seamless client
            experience.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border">
        <div>
          <SectionHead
            eyebrow="Our values"
            title="What we stand on."
            size={44}
            className="mb-11"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 border-t border-bz-border">
            {VALUES.map(([t, d], i) => (
              <div
                key={t}
                className="pt-9 pb-2 lg:pr-6 lg:border-r border-bz-border last:border-r-0 lg:[&:not(:first-child)]:pl-6"
              >
                <div className="serif italic text-bz-accent text-[30px]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div
                  className="serif text-[24px] mt-3.5"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {t}
                </div>
                <p className="text-[13px] text-bz-muted leading-relaxed mt-2.5">
                  {d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footprint */}
      <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border bg-bz-surface-2">
        <div>
          <SectionHead
            eyebrow="Our footprint"
            title="Rooted in Abu Dhabi, reaching the wider UAE."
            size={44}
            className="mb-9"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              [
                "Abu Dhabi",
                "Our home market",
                "Abu Dhabi is our home market and core area of expertise. From prime island communities to the heart of the city, Bazar covers residential, investment, and commercial opportunities across the capital.",
                "abu dhabi · corniche",
              ],
              [
                "Dubai & Wider UAE",
                "Selected opportunities",
                "Expanding beyond Abu Dhabi, Bazar connects clients to selected opportunities across Dubai and other key UAE markets — established communities, new developments, and investment-focused destinations.",
                "dubai skyline",
              ],
            ].map(([t, tag, d, img]) => (
              <article
                key={t}
                className="rounded-lg border border-bz-border bg-bz-surface overflow-hidden"
              >
                <div className="relative w-full" style={{ aspectRatio: "2/1" }}>
                  <PlaceholderImage
                    label={img}
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
                <div className="p-7">
                  <div className="eyebrow">{tag}</div>
                  <div
                    className="serif text-[30px] mt-2"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {t}
                  </div>
                  <p className="text-[14.5px] text-bz-ink-2 leading-[1.65] mt-3">
                    {d}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Expertise + track record */}
      <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-[72px] items-start">
          <div>
            <div className="eyebrow">Our areas of expertise</div>
            <h2
              className="serif mt-3.5"
              style={{
                fontSize: fluid(40),
                letterSpacing: "-0.025em",
                lineHeight: 1.05,
              }}
            >
              Where our knowledge runs deep.
            </h2>
            <p className="text-[15px] text-bz-ink-2 leading-relaxed mt-3.5 max-w-[520px]">
              We combine market expertise, strong industry relationships, and a
              client-focused approach to support buyers, investors, landlords,
              sellers, and tenants across the UAE.
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {EXPERTISE.map((e) => (
                <span
                  key={e}
                  className="px-4 py-2 rounded-full bg-bz-surface-2 border border-bz-border text-[13.5px]"
                >
                  {e}
                </span>
              ))}
            </div>
            <Button
              asChild
              className="mt-7 bg-bz-ink text-bz-bg hover:bg-bz-ink/90"
            >
              <Link href="/services">
                Our services
                <ArrowRight size={15} strokeWidth={1.7} />
              </Link>
            </Button>
          </div>
          <div>
            <div className="eyebrow">Our track record</div>
            <div className="mt-4 border-t border-bz-border">
              {HIGHLIGHTS.map((h) => (
                <div
                  key={h}
                  className="flex items-center gap-3.5 py-4 border-b border-bz-border text-[15.5px]"
                >
                  <Check size={16} strokeWidth={2} className="text-bz-accent" />
                  {h}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Developer partners */}
      <section className="px-4 md:px-12 py-14 md:py-18 border-t border-bz-border">
        <div>
          <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
            <SectionHead
              eyebrow="Our developer partners"
              title="Trusted by the region's builders."
              size={40}
            />
            <Button asChild variant="outline">
              <Link href="/developers">
                All developers
                <ArrowRight size={15} strokeWidth={1.7} />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-bz-border border border-bz-border rounded-xl overflow-hidden">
            {PARTNERS.map((p) => (
              <div
                key={p}
                className="bg-bz-surface px-7 py-9 flex items-center justify-center serif text-[26px] min-h-[110px]"
                style={{ letterSpacing: "-0.01em" }}
              >
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner ecosystem — banking + regulatory (shared with home) */}
      <PartnerEcosystemSection />

      {/* Location — 1:1 with the /contact HQ map + details */}
      <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-10 lg:gap-14 items-center">
          <div>
            <div className="eyebrow">Our location</div>
            <h2
              className="serif mt-3.5"
              style={{
                fontSize: fluid(40),
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
              }}
            >
              Based in Abu Dhabi, serving the UAE.
            </h2>
            <div className="text-[16px] text-bz-ink-2 leading-[1.7] mt-5">
              <div className="font-medium text-bz-ink">
                Bazar Real Estate L.L.C.
              </div>
              Sheikha Salama Building, Office 4
              <br />
              Zayed The First Street, Al Bateen
              <br />
              Abu Dhabi, United Arab Emirates
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <a href={HQ_DIRECTIONS} target="_blank" rel="noopener noreferrer">
                  <Navigation size={15} strokeWidth={1.8} />
                  Get directions
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact">
                  <MapPin size={15} strokeWidth={1.8} />
                  Contact us
                </Link>
              </Button>
            </div>
          </div>
          <HqMapCanvas
            lat={HQ_LAT}
            lng={HQ_LNG}
            label="Bazar HQ — Al Bateen"
            className="w-full aspect-[16/10] rounded-xl overflow-hidden border border-bz-border"
          />
        </div>
      </section>
    </div>
  );
}
