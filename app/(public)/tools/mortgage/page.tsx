import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { MortgageCalculator } from "./mortgage-calculator";

export const metadata: Metadata = {
  title: "Mortgage calculator",
  description:
    "All-in mortgage maths for Abu Dhabi: monthly payment, true cash to close (DLD, trustee, valuation, advisory), affordability check against Central Bank UAE DBR rules, and side-by-side scenario compare.",
};

export default function MortgagePage() {
  return (
    <div className="bg-bz-bg">
      <section className="px-12 pt-20 pb-6">
        <Eyebrow>For buyers and investors</Eyebrow>
        <h1
          className="serif text-[64px] font-normal mt-3 leading-[1.0] max-w-[16ch]"
          style={{ letterSpacing: "-0.025em" }}
        >
          What will this property actually{" "}
          <em className="italic">cost you?</em>
        </h1>
        <p className="mt-5 max-w-[64ch] text-[16px] text-bz-ink-2 leading-relaxed">
          The number you see on a listing is rarely the number you pay. This
          calculator includes everything: transfer fees, advisory, mortgage
          fees, and the full cash needed to close.
        </p>
      </section>

      <MortgageCalculator />

      <section className="px-12 pb-24">
        <div className="bg-bz-accent-soft rounded-xl p-8 flex flex-wrap items-center justify-between gap-6">
          <div>
            <Eyebrow className="text-bz-accent">
              Ready to make it real?
            </Eyebrow>
            <h2
              className="serif text-[26px] mt-1.5"
              style={{ letterSpacing: "-0.015em" }}
            >
              Get pre-approved with our preferred lenders.
            </h2>
            <p className="text-[13.5px] text-bz-ink-2 mt-1.5">
              Soft credit pull · 24-hour response · 5 partner banks
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/contact">
                <Calendar size={14} strokeWidth={1.6} />
                Talk to advisor
              </Link>
            </Button>
            <Button asChild>
              <Link href="/contact?source=mortgage">
                Start pre-approval
                <ArrowRight size={14} strokeWidth={1.6} />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
