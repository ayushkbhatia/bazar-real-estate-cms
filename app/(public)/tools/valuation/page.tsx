import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { listAreaOptions } from "@/lib/queries/areas";
import { ValuationWizard } from "./valuation-wizard";

export const metadata: Metadata = {
  title: "Get a valuation",
  description:
    "An instant data-backed range from our model, then a senior advisor reviews and sends you a refined valuation within 24 hours. Free, no obligation.",
};

export const dynamic = "force-dynamic";

export default async function ValuationPage() {
  const areas = await listAreaOptions();

  return (
    <div className="bg-bz-bg">
      <section className="px-12 pt-20 pb-8">
        <Eyebrow>For owners considering selling</Eyebrow>
        <h1
          className="serif text-[64px] font-normal mt-3 leading-[1.0] max-w-[18ch]"
          style={{ letterSpacing: "-0.025em" }}
        >
          What&apos;s your property worth,{" "}
          <em className="italic">honestly?</em>
        </h1>
        <p className="mt-5 max-w-[64ch] text-[16px] text-bz-ink-2 leading-relaxed">
          Tell us about your property. You&apos;ll get an instant
          data-backed range from our model, then a senior advisor reviews
          and sends you a refined valuation within 24 hours — free, no
          obligation.
        </p>

        <ul className="mt-7 flex flex-wrap gap-6 text-[13px] text-bz-muted">
          {[
            { h: "DMT-backed", s: "Abu Dhabi transaction data" },
            { h: "Advisor-reviewed", s: "Senior partner signs off" },
            { h: "Free", s: "Even if you don't list with us" },
          ].map((item) => (
            <li key={item.h} className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-bz-accent-soft text-bz-accent inline-flex items-center justify-center">
                <Check size={14} strokeWidth={2} />
              </span>
              <div>
                <div className="text-bz-ink font-medium text-[13.5px]">
                  {item.h}
                </div>
                <div className="text-[11.5px]">{item.s}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ValuationWizard areas={areas} />
    </div>
  );
}
