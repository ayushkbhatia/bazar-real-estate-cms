import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { SEED_SERVICES } from "@/lib/seeds/services";
import { ServiceCard } from "./_components/service-card";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Buy, sell, rent, manage, invest. Five advisory services. One advisor per engagement.",
};

export default function ServicesPage() {
  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-16 max-w-[1200px]">
        <Eyebrow>Services</Eyebrow>
        <h1
          className="serif text-[40px] md:text-[80px] mt-3 font-normal leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Five practices.<br />
          One advisor each.
        </h1>
        <p className="mt-8 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          A Bazar engagement gives you one senior advisor for the duration of
          the work — from the brief through DLD transfer. No handovers, no
          junior brokers, no fee-share with the listing side.
        </p>
      </section>

      <section className="px-4 md:px-12 pb-20 max-w-[1200px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SEED_SERVICES.map((s) => (
            <ServiceCard
              key={s.slug}
              slug={s.slug}
              name={s.name}
              one_liner={s.one_liner}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-bz-border bg-bz-surface">
        <div className="px-4 md:px-12 py-16 max-w-[1200px] grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <Eyebrow>Not sure which</Eyebrow>
            <h2
              className="serif text-[32px] mt-2 leading-tight max-w-[28ch]"
              style={{ letterSpacing: "-0.015em" }}
            >
              Tell us what you&apos;re solving for. We&apos;ll point you at the right desk.
            </h2>
          </div>
          <Button asChild size="lg">
            <Link href="/contact">Book a 30-min call</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
