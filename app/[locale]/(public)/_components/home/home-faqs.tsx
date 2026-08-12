"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { SectionCopy } from "./section-copy";

/**
 * Home "FAQs" (handoff §7). Single-open accordion, first item open, plus
 * icon rotates to a close indicator. Copy is verbatim from the client
 * audit. Sticky left heading on desktop.
 */
const FAQS: [string, string][] = [
  [
    "What is the benefit of buying off-plan?",
    "Off-plan properties often offer flexible payment plans, lower entry prices, and potential capital growth before handover.",
  ],
  [
    "What should I check before buying a property?",
    "Check the location, developer, price, payment plan, ownership type, service charges, and expected rental demand.",
  ],
  [
    "What is mortgage pre-approval?",
    "Mortgage pre-approval shows how much a bank may be willing to lend before you choose a property.",
  ],
  [
    "What is a payment plan?",
    "A payment plan is the schedule of instalments paid to the developer or seller over a set period.",
  ],
  [
    "What are service charges?",
    "Service charges are fees paid for building or community maintenance, facilities, and shared areas.",
  ],
];

export function HomeFaqs({
  eyebrow = "FAQs",
  heading = "Frequently asked questions",
  body = "Clear guidance for every step of your real estate journey.",
  items,
}: SectionCopy & { items?: [string, string][] } = {}) {
  const [open, setOpen] = useState(0);

  return (
    <section className="px-4 md:px-12 py-14 md:py-20">
      <div className="grid items-start gap-10 md:grid-cols-[0.9fr_1.4fr] md:gap-16">
        <div className="md:sticky md:top-10">
          <div
            className="text-[11px] font-medium uppercase text-bz-accent"
            style={{ letterSpacing: "0.12em" }}
          >
            {eyebrow}
          </div>
          <h2 className="serif mt-2.5 text-[30px] md:text-[44px] font-normal leading-[1.05] tracking-tight">
            {heading}
          </h2>
          <p className="mt-4 max-w-[36ch] text-[14.5px] md:text-[15.5px] text-bz-ink-2 leading-relaxed">
            {body}
          </p>
        </div>

        <div>
          {(items && items.length > 0 ? items : FAQS).map(([q, a], i) => {
            const on = open === i;
            return (
              <div key={q} className="border-t border-bz-border">
                <button
                  type="button"
                  aria-expanded={on}
                  onClick={() => setOpen(on ? -1 : i)}
                  className="flex w-full items-center justify-between gap-6 py-5 md:py-6 text-left"
                >
                  <span
                    className="serif text-[18px] md:text-[22px] leading-tight tracking-tight"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {q}
                  </span>
                  <Plus
                    size={20}
                    strokeWidth={1.6}
                    className="shrink-0 text-bz-accent transition-transform duration-200"
                    style={{ transform: on ? "rotate(45deg)" : "none" }}
                  />
                </button>
                {on ? (
                  <div className="max-w-[60ch] pb-6 text-[14.5px] md:text-[15px] text-bz-ink-2 leading-relaxed">
                    {a}
                  </div>
                ) : null}
              </div>
            );
          })}
          <div className="border-t border-bz-border" />
        </div>
      </div>
    </section>
  );
}
