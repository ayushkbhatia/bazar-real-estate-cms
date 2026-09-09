import { getTranslations } from "next-intl/server";
import { ChevronDown } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { DevelopmentDetail } from "@/lib/queries/developments";
import type { FaqEntry } from "@/lib/queries/development-extras";
import { quarterLabel as devQuarterLabel } from "@/lib/schemas/development";
import { arabicFor } from "@/lib/i18n/arabic-store";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";

type Props = {
  locale: Locale;
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
export async function DevelopmentFaq({
  locale,
  development,
  curated,
  eyebrow,
  heading,
  intro,
}: Props) {
  // Explicit locale, never ambient — an ambient read resolves through
  // `headers()` and would take this route off prerendering.
  const t = await getTranslations({ locale, namespace: "development.faq" });
  const entries: FaqEntry[] = curated?.length
    ? localiseFaq(curated, locale)
    : synthFaq(development, t);
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
      <Eyebrow>{eyebrow ?? t("eyebrow")}</Eyebrow>
      <h2
        className="serif text-[36px] mt-2 leading-tight max-w-[28ch]"
        style={{ letterSpacing: "-0.02em" }}
      >
        {heading ?? t("heading")}
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

/**
 * The default FAQ, from the project's own facts.
 *
 * Every entry used to be a template literal, so on `/ar` the tokens folded and
 * the sentence around them did not: "ذا كانوبيز آت ياس بوينت sits within جزيرة
 * ياس, Abu Dhabi." — half-translated, and mixed-direction in a way that reads
 * worse than plain English would. Seven questions and seven answers, on every
 * project page, and the FAQPage JSON-LD carried the same mixture into search
 * results.
 *
 * The templates live in the catalogue now, so the sentence is written once per
 * language and the tokens are arguments rather than concatenation — which is
 * also what lets Arabic put them where Arabic wants them.
 */
function synthFaq(
  d: DevelopmentDetail,
  t: (key: string, values?: Record<string, string>) => string,
): FaqEntry[] {
  const entries: FaqEntry[] = [];
  const name = d.name;

  if (d.developer?.name) {
    entries.push({
      q: t("developerQ", { name }),
      a: t("developerA", { name, developer: d.developer.name }),
    });
  }

  if (d.area?.name) {
    entries.push({
      q: t("locationQ", { name }),
      a: t("locationA", { name, area: d.area.name }),
    });
  }

  if (d.handover_date) {
    entries.push({
      q: t("handoverQ", { name }),
      a: t("handoverA", { quarter: devQuarterLabel(d.handover_date) }),
    });
  }

  if (d.payment_plan?.name) {
    entries.push({
      q: t("planQ", { name }),
      a: t("planA", { plan: d.payment_plan.name }),
    });
  }

  if (d.bedrooms_text) {
    entries.push({
      q: t("unitsQ", { name }),
      a: t("unitsA", { beds: d.bedrooms_text }),
    });
  }

  entries.push({
    q: t("foreignQ", { name }),
    a: t("foreignA", { name }),
  });

  if (d.escrow_account) {
    entries.push({
      q: t("escrowQ"),
      a: t("escrowA", { name, escrow: d.escrow_account }),
    });
  }

  return entries;
}

/**
 * Fold a CMS-curated FAQ. Same ladder as `localiseFeatureBlocks`, same reason:
 * `meta.faq` is a jsonb bag whose rows predate its `_ar` twins, so the
 * presence guard in `localiseRow` would never let the store be consulted.
 */
function localiseFaq(entries: FaqEntry[], locale: Locale): FaqEntry[] {
  if (locale === DEFAULT_LOCALE) return entries;
  const pick = (typed: string | null | undefined, english: string) =>
    typed?.trim() ? typed : (arabicFor(english) ?? english);
  return entries.map((e) => ({
    ...e,
    q: pick(e.q_ar, e.q),
    a: pick(e.a_ar, e.a),
  }));
}
