import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { fluid } from "../../_components/marketing/fluid";

export const metadata: Metadata = {
  title: "Guides for Landlords · Renting Out in Abu Dhabi",
  description:
    "Owning a rental in Abu Dhabi is a strong long-term investment when managed properly. These guides cover professional property management and how to rent out your property.",
  alternates: { canonical: "/guides/for-landlords" },
};

const GUIDES: [string, string, string, string][] = [
  [
    "Property Management",
    "Abu Dhabi Landlord Guide: Property Management",
    "What property management covers, why it matters in a regulated market, and how it protects your income and your property.",
    "/guides/property-management",
  ],
  [
    "Renting Out",
    "How to Rent Out Your Property",
    "Prepare, price, list, screen tenants, agree terms, sign, register Tawtheeq, and hand over — the right way.",
    "/guides/how-to-rent-out",
  ],
];

export default function LandlordsHub() {
  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-10">
        <Eyebrow>Guide · For Landlords</Eyebrow>
        <h1
          className="serif mt-3.5 max-w-[900px]"
          style={{
            fontSize: fluid(72),
            letterSpacing: "-0.03em",
            lineHeight: 0.98,
          }}
        >
          Rent it out, well — and protect the asset.
        </h1>
        <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[700px] leading-relaxed mt-5">
          Owning a rental in Abu Dhabi is a strong long-term investment when
          managed properly. These guides cover professional property management
          and the full process of renting out your property.
        </p>
      </section>

      <section className="px-4 md:px-12 pb-20 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[900px]">
          {GUIDES.map(([label, title, desc, href]) => (
            <Link
              key={title}
              href={href}
              className="group flex flex-col rounded-lg border border-bz-border bg-bz-surface overflow-hidden hover:border-bz-ink transition-colors"
            >
              <div className="relative w-full" style={{ aspectRatio: "16/10" }}>
                <PlaceholderImage
                  label={title.toLowerCase()}
                  className="absolute inset-0 h-full w-full"
                />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="eyebrow">{label}</div>
                <div
                  className="serif text-[24px] mt-2 leading-tight"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {title}
                </div>
                <p className="text-[14px] text-bz-ink-2 leading-relaxed mt-3 flex-1">
                  {desc}
                </p>
                <div className="flex items-center gap-2 mt-5 text-[13.5px] font-medium text-bz-accent">
                  Read the guide
                  <ArrowRight size={14} strokeWidth={1.8} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
