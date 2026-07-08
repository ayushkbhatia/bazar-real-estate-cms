import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { fluid } from "../../_components/marketing/fluid";

export const metadata: Metadata = {
  title: "Guides for Tenants · Renting in Abu Dhabi",
  description:
    "Renting in Abu Dhabi is straightforward when you know the steps — the move-in process, the documents to prepare, and the full rental journey from budget to renewal.",
  alternates: { canonical: "/guides/for-tenants" },
};

const GUIDES: [string, string, string, string][] = [
  [
    "Move-In Guide",
    "Abu Dhabi Tenant Move-In Guide",
    "From signing your tenancy contract to setting up utilities and completing your move-in checklist — prepare for a smooth move.",
    "/guides/tenant-move-in",
  ],
  [
    "Required Documents",
    "Required Documents for Renting",
    "The identification, Tawtheeq, utility, and building-approval documents every tenant should prepare in advance.",
    "/guides/required-documents",
  ],
  [
    "Rental Process",
    "Abu Dhabi Rental Process, Step by Step",
    "The complete tenant journey — set your budget, view, offer, sign, register Tawtheeq, and move in.",
    "/guides/rental-process",
  ],
];

export default function TenantsHub() {
  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-10">
        <Eyebrow>Guide · For Tenants</Eyebrow>
        <h1
          className="serif mt-3.5 max-w-[900px]"
          style={{
            fontSize: fluid(72),
            letterSpacing: "-0.03em",
            lineHeight: 0.98,
          }}
        >
          Everything a tenant needs, before signing.
        </h1>
        <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[700px] leading-relaxed mt-5">
          Renting in Abu Dhabi is straightforward when you know the steps. These
          guides cover the move-in process, the documents to prepare, and the
          full rental journey from budget to renewal.
        </p>
      </section>

      <section className="px-4 md:px-12 pb-20 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1200px]">
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
