import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { EnquiryForm } from "../../_components/enquiry-form";
import { fluid } from "../../_components/marketing/fluid";
import { SectionHead } from "../../_components/marketing/section-head";
import { WhyBand } from "../../_components/marketing/why-band";

export const metadata: Metadata = {
  title: "List Your Property with Bazar",
  description:
    "Looking to sell or rent your property in Abu Dhabi? Our experts support you every step of the way — with market insight, professional exposure, and dedicated support.",
  alternates: { canonical: "/services/sell" },
};

const LIST_TYPES = [
  "Apartments",
  "Villas",
  "Townhouses",
  "Penthouses",
  "Commercial Properties",
  "Offices",
  "Retail Spaces",
  "Warehouses",
  "Land",
];

const SUPPORT: [string, string][] = [
  ["Review the property", "Location, condition, and rental potential."],
  ["Set rental guidance", "Market-based pricing support."],
  ["Prepare the listing", "Clear details and professional presentation."],
  ["Manage enquiries", "Filtering suitable tenant interest."],
  ["Arrange viewings", "Viewing coordination and updates."],
  ["Support leasing", "Guidance through the tenancy process."],
];

const GUIDE_TEASERS: [string, string, string, string][] = [
  [
    "For Landlords",
    "How to Rent Out Your Property",
    "Prepare, price, list, and register your tenancy the right way.",
    "/guides/how-to-rent-out",
  ],
  [
    "For Landlords",
    "Property Management",
    "What professional management covers and how it protects your asset.",
    "/guides/property-management",
  ],
  [
    "For Tenants",
    "Abu Dhabi Rental Process",
    "A step-by-step guide from budget to move-in and renewal.",
    "/guides/rental-process",
  ],
];

export default function ListYourPropertyPage() {
  return (
    <div className="bg-bz-bg">
      {/* Hero + lead form */}
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-14 md:pb-[72px]">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-10 lg:gap-16 items-center max-w-[1280px]">
          <div>
            <Eyebrow>List Your Property</Eyebrow>
            <h1
              className="serif mt-3.5"
              style={{
                fontSize: fluid(76),
                letterSpacing: "-0.03em",
                lineHeight: 0.97,
              }}
            >
              Your journey
              <br />
              starts <em className="italic">here.</em>
            </h1>
            <p className="text-[16px] md:text-[17px] text-bz-ink-2 max-w-[500px] leading-relaxed mt-5">
              Looking to sell or rent your property in Abu Dhabi? Our real estate
              experts are here to support you every step of the way — with market
              insight, professional exposure, and dedicated support.
            </p>
            <div className="flex flex-wrap gap-8 md:gap-12 mt-11 pt-8 border-t border-bz-border">
              {[
                ["Sell · Rent · Manage", "one dedicated team"],
                ["Multi-channel", "professional exposure"],
              ].map(([v, l]) => (
                <div key={l}>
                  <div
                    className="serif"
                    style={{ fontSize: fluid(24), letterSpacing: "-0.02em" }}
                  >
                    {v}
                  </div>
                  <div className="text-[12.5px] text-bz-muted mt-1">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-bz-border bg-bz-surface p-6 md:p-8 bz-shadow-1">
            <div
              className="serif text-[24px] md:text-[26px]"
              style={{ letterSpacing: "-0.015em" }}
            >
              Tell us about your property
            </div>
            <p className="text-[13.5px] text-bz-muted mt-1.5">
              Sell, rent, or hand it to us to manage — pick what you&apos;re
              looking to do below.
            </p>
            <EnquiryForm source="contact_page" showIntent className="mt-5" />
          </div>
        </div>
      </section>

      {/* What we help landlords list */}
      <section className="px-4 md:px-12 py-14 md:py-18 border-t border-bz-border">
        <div className="max-w-[1200px]">
          <SectionHead
            eyebrow="What we help landlords list"
            title="Every property type, listed properly."
            size={40}
            className="mb-8"
          />
          <div className="flex flex-wrap gap-2.5">
            {LIST_TYPES.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full bg-bz-surface border border-bz-border text-[15px]"
              >
                <Building2 size={16} strokeWidth={1.7} className="text-bz-accent" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How we support landlords */}
      <section className="px-4 md:px-12 py-14 md:py-18 border-t border-bz-border bg-bz-surface-2">
        <div className="max-w-[1200px]">
          <SectionHead
            eyebrow="How we support landlords"
            title="From review to leasing."
            size={40}
            className="mb-9"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SUPPORT.map(([t, d], i) => (
              <div
                key={t}
                className="rounded-lg border border-bz-border bg-bz-surface p-7"
              >
                <div className="serif text-bz-accent text-[32px]" style={{ letterSpacing: "-0.02em" }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div
                  className="serif text-[22px] mt-3"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {t}
                </div>
                <p className="text-[13.5px] text-bz-ink-2 leading-relaxed mt-2">
                  {d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WhyBand
        title="Access, exposure, and a team that does the work."
        body="Bazar Real Estate gives landlords access to market insight, professional exposure across major UAE portals and channels, and dedicated support designed to make the leasing process smoother — from the first review to a signed, registered tenancy."
        stats={[
          ["Portals + direct", "marketing exposure"],
          ["Sell · Rent · Manage", "one point of contact"],
        ]}
      />

      {/* Guides teaser */}
      <section className="px-4 md:px-12 py-14 md:py-20">
        <div className="max-w-[1200px]">
          <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
            <SectionHead
              eyebrow="Before you list"
              title="Landlord & tenant guides."
              size={40}
            />
            <Button asChild variant="outline">
              <Link href="/guides">
                All guides
                <ArrowRight size={15} strokeWidth={1.7} />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {GUIDE_TEASERS.map(([k, t, d, href]) => (
              <Link
                key={t}
                href={href}
                className="group flex flex-col rounded-lg border border-bz-border bg-bz-surface overflow-hidden hover:border-bz-ink transition-colors"
              >
                <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
                  <PlaceholderImage
                    label={t.toLowerCase()}
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
                <div className="p-6">
                  <div className="eyebrow">{k}</div>
                  <div
                    className="serif text-[22px] mt-2 leading-tight"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {t}
                  </div>
                  <p className="text-[13px] text-bz-muted leading-relaxed mt-2">
                    {d}
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-[13px] font-medium text-bz-accent">
                    Read guide
                    <ArrowRight size={14} strokeWidth={1.8} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
