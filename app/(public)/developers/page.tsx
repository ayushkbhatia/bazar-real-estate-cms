import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { fluid } from "../_components/marketing/fluid";
import { SectionHead } from "../_components/marketing/section-head";
import { DEVELOPERS_SORTED } from "./_data";

export const metadata: Metadata = {
  title: "Developers · Bazar Real Estate",
  description:
    "Direct relationships with the UAE's leading developers give Bazar clients early access to landmark communities, new launches, and off-plan opportunities.",
  alternates: { canonical: "/developers" },
};

export const revalidate = 300;

export default function DevelopersPage() {
  return (
    <div className="bg-bz-bg">
      {/* Hero */}
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

      {/* Our partners — the master directory. Every UAE developer Bazar works
          with, sorted alphabetically, each linking to its own profile. */}
      <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border bg-bz-ink text-white">
        <SectionHead
          eyebrow="Our partners"
          title="Working with leading developers across the UAE."
          sub="Access to established communities, new launches, luxury residences, and investment opportunities across Abu Dhabi, Dubai and the wider UAE."
          size={44}
          dark
          className="mb-10 md:mb-12"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {DEVELOPERS_SORTED.map((d) => (
            <Link
              key={d.slug}
              href={`/developers/${d.slug}`}
              className="group flex flex-col rounded-xl border border-white/12 bg-bz-ink overflow-hidden hover:border-white/40 transition-colors"
            >
              <div className="flex items-center justify-center bg-white px-6 min-h-[128px] md:min-h-[136px]">
                <Image
                  src={d.logo}
                  alt={d.name}
                  width={d.w}
                  height={d.h}
                  className="h-14 md:h-16 w-auto object-contain"
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 240px"
                />
              </div>
              <div className="flex flex-col flex-1 p-5 border-t border-white/10">
                <div
                  className="serif text-white text-[19px] leading-tight"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {d.name}
                </div>
                <p className="text-[12px] text-white/55 leading-snug mt-1.5 flex-1">
                  {d.blurb}
                </p>
                <div className="flex items-center gap-1.5 mt-4 text-[12.5px] font-medium text-white/90">
                  View developments
                  <ArrowRight
                    size={13}
                    strokeWidth={1.8}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
