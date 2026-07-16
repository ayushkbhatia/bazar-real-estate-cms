import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { fluid } from "../_components/marketing/fluid";
import { SectionHead } from "../_components/marketing/section-head";
import {
  ECOSYSTEM_PARTNERS,
  PARTNER_GROUPS,
} from "../_components/partners-data";

export const metadata: Metadata = {
  title: "Our Partners",
  description:
    "The banking and regulatory institutions Bazar Real Estate works alongside — mortgage and home-finance partners and the authorities that regulate UAE real estate.",
  alternates: { canonical: "/partners" },
};

export default function PartnersPage() {
  return (
    <div className="bg-bz-bg">
      {/* Hero */}
      <section className="px-4 md:px-12 pt-12 md:pt-16 pb-10 md:pb-12">
        <Eyebrow>Our Partner Ecosystem</Eyebrow>
        <h1
          className="serif mt-3.5 max-w-[16ch]"
          style={{
            fontSize: fluid(72),
            letterSpacing: "-0.03em",
            lineHeight: 1.0,
          }}
        >
          The institutions <em className="italic">behind</em> every deal.
        </h1>
        <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[720px] leading-relaxed mt-5">
          Beyond our developer relationships, Bazar works alongside the region&apos;s
          leading banks and regulatory authorities — so financing, compliance,
          and registration are handled end to end.
        </p>
      </section>

      {/* Partner groups */}
      {PARTNER_GROUPS.map((group, gi) => {
        const partners = ECOSYSTEM_PARTNERS.filter(
          (p) => p.category === group.category,
        );
        return (
          <section
            key={group.category}
            className={`px-4 md:px-12 py-14 md:py-18 border-t border-bz-border${
              gi % 2 === 1 ? " bg-bz-surface-2" : ""
            }`}
          >
            <SectionHead
              eyebrow={group.category === "banking" ? "Finance" : "Regulation"}
              title={group.title}
              sub={group.blurb}
              size={40}
              className="mb-9"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {partners.map((p) => (
                <article
                  key={p.slug}
                  className="rounded-xl border border-bz-border bg-bz-surface overflow-hidden flex flex-col"
                >
                  <div className="h-[150px] flex items-center justify-center bg-white px-8 border-b border-bz-border">
                    <Image
                      src={p.logo}
                      alt={p.name}
                      width={p.w}
                      height={p.h}
                      className="max-h-[64px] w-auto object-contain"
                      style={{ width: "auto" }}
                      sizes="360px"
                    />
                  </div>
                  <div className="p-6">
                    <div className="serif text-[19px] leading-tight">
                      {p.name}
                    </div>
                    <p className="text-[13.5px] text-bz-muted mt-2">{p.tag}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      {/* CTA */}
      <section className="px-4 md:px-12 py-16 md:py-20 border-t border-bz-border">
        <div className="rounded-2xl bg-bz-ink text-white px-8 md:px-14 py-14 md:py-16 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <Eyebrow className="text-white/60">Work with us</Eyebrow>
            <h2
              className="serif text-white mt-4 max-w-[18ch]"
              style={{
                fontSize: fluid(44),
                letterSpacing: "-0.025em",
                lineHeight: 1.08,
              }}
            >
              Backed by the right people at every step.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              className="bg-white text-bz-ink hover:bg-white/90"
            >
              <Link href="/contact">
                Talk to an advisor
                <ArrowRight size={15} strokeWidth={1.7} />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/developers">Our developers</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
