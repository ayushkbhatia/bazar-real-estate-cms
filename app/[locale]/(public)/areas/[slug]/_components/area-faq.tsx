import { ChevronDown } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { fluid } from "../../../_components/marketing/fluid";

export type AreaFaqEntry = { q: string; a: string };

/**
 * The guide's FAQ, with `FAQPage` schema attached.
 *
 * Area questions ("how far is X from Downtown", "what properties are
 * available") are exactly the long-tail queries that earn a rich result, so
 * the schema matters more here than the accordion does. Native
 * `<details>`/`<summary>` keeps it keyboard- and reader-accessible with no
 * client JavaScript.
 */
export function AreaFaq({
  eyebrow,
  heading,
  intro,
  entries,
}: {
  /**
   * Supplied by the page rather than written here: this used to be the literal
   * "FAQ", which rendered in English above an Arabic accordion on all 24 area
   * guides. It is a prop rather than a `getTranslations` call so the component
   * stays free of the request-scoped locale.
   */
  eyebrow: string;
  heading: string;
  intro?: string | null;
  entries: AreaFaqEntry[];
}) {
  if (entries.length === 0) return null;

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
    <section
      id="faq"
      className="px-4 md:px-12 py-14 md:py-16 border-t border-bz-border scroll-mt-16"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        className="serif mt-2 font-normal leading-tight max-w-[28ch]"
        style={{ fontSize: fluid(34), letterSpacing: "-0.02em" }}
      >
        {heading}
      </h2>
      {intro ? (
        <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[62ch]">
          {intro}
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-2 max-w-[880px]">
        {entries.map((e) => (
          <details
            key={e.q}
            className="group rounded-lg border border-bz-border bg-bz-surface p-5 open:bg-bz-bg transition-colors"
          >
            <summary className="flex justify-between items-center cursor-pointer list-none gap-6">
              <span className="text-[15.5px] text-bz-ink">
                {e.q}
              </span>
              <ChevronDown
                size={16}
                strokeWidth={1.7}
                className="text-bz-muted transition-transform group-open:rotate-180 shrink-0"
              />
            </summary>
            <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-[1.7] max-w-[62ch]">
              {e.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
