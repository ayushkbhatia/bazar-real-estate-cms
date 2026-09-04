import { ChevronDown } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { DevelopmentDetail } from "@/lib/queries/developments";
import type { FaqEntry } from "@/lib/queries/development-extras";
import { quarterLabel as devQuarterLabel } from "@/lib/schemas/development";

type Props = {
  development: DevelopmentDetail;
  /** Custom-curated FAQ from `development.meta.faq` overrides the synth set. */
  curated?: FaqEntry[];
  /** Sub-page overrides. Blank keeps the built-in copy. */
  eyebrow?: string | null;
  heading?: string | null;
  intro?: string | null;
};

/**
 * FAQ block + JSON-LD `FAQPage` schema. Lifts long-tail SEO on
 * developer-by-area + handover-date queries. When `development.meta.faq` is
 * present (CMS-curated), it wins; otherwise we synthesise a default set from
 * the development's own facts so every page surfaces something useful.
 */
export function DevelopmentFaq({
  development,
  curated,
  eyebrow,
  heading,
  intro,
}: Props) {
  const entries: FaqEntry[] = curated?.length ? curated : synthFaq(development);
  if (!entries.length) return null;

  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((e) => ({
      "@type": "Question",
      name: e.q,
      acceptedAnswer: { "@type": "Answer", text: e.a },
    })),
  };

  return (
    <section id="faq" className="px-4 md:px-12 py-16 scroll-mt-16 border-t border-bz-border bg-bz-surface-2">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <Eyebrow>{eyebrow ?? "FAQ"}</Eyebrow>
      <h2
        className="serif text-[36px] mt-2 leading-tight max-w-[28ch]"
        style={{ letterSpacing: "-0.02em" }}
      >
        {heading ?? "Frequently asked, plainly answered."}
      </h2>
      {intro ? (
        <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          {intro}
        </p>
      ) : null}

      <div className="mt-9 grid grid-cols-1 gap-2 max-w-[860px]">
        {entries.map((e, i) => (
          <details
            key={i}
            className="group rounded-lg border border-bz-border bg-bz-surface p-5 open:bg-bz-bg transition-colors"
          >
            <summary className="flex justify-between items-center cursor-pointer list-none gap-6">
              <span className="text-[15.5px] text-bz-ink">
                {e.q}
              </span>
              <ChevronDown
                size={16}
                strokeWidth={1.7}
                className="text-bz-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-[1.7] max-w-[60ch]">
              {e.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function synthFaq(d: DevelopmentDetail): FaqEntry[] {
  const entries: FaqEntry[] = [];

  if (d.developer?.name) {
    entries.push({
      q: `Who is the developer of ${d.name}?`,
      a: `${d.name} is developed by ${d.developer.name}. You can review their portfolio, delivery track record, and past Abu Dhabi projects on the Bazar developer profile linked above.`,
    });
  }

  if (d.area?.name) {
    entries.push({
      q: `Where is ${d.name} located?`,
      a: `${d.name} sits within ${d.area.name}, Abu Dhabi. The interactive map on this page anchors the master plan to the wider community and shows commute times to key destinations.`,
    });
  }

  if (d.handover_date) {
    entries.push({
      q: `When does ${d.name} hand over?`,
      a: `Currently scheduled for ${devQuarterLabel(d.handover_date)}. Developers occasionally adjust handover quarters — your Bazar advisor will flag any movement and let you know what it means for resale, mortgage timing, and rental projections.`,
    });
  }

  if (d.payment_plan?.name) {
    entries.push({
      q: `What payment plan is offered at ${d.name}?`,
      a: `${d.payment_plan.name}. Use the Payment plan calculator above to see milestone amounts for the unit type you're considering, or ask Bazar for a custom cash-flow projection across the construction window.`,
    });
  }

  if (d.bedrooms_text) {
    entries.push({
      q: `What unit types are available at ${d.name}?`,
      a: `${d.bedrooms_text}. The Units table above shows live availability across the current release.`,
    });
  }

  entries.push({
    q: `Can foreigners buy at ${d.name}?`,
    a: `Yes — ${d.name} is in a designated freehold area of Abu Dhabi, which means non-resident buyers can take title in their own name and apply for the property-linked residency visa. Bazar handles the entire process end-to-end.`,
  });

  if (d.escrow_account) {
    entries.push({
      q: "Is the payment plan escrow-backed?",
      a: `Yes. ${d.name} payments are held in a RERA-registered escrow account (${d.escrow_account}). Funds release to the developer only against verified construction milestones — your capital is protected until handover.`,
    });
  }

  return entries;
}
