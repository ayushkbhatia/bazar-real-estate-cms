import { getTranslations } from "next-intl/server";
import { ChevronDown } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { isolateForLocale } from "@/lib/i18n/bidi";
import type { Locale } from "@/lib/i18n/locales";
import type { PropertyFaqItem } from "@/lib/queries/property-page";

type Props = {
  locale: Locale;
  reference: string;
  title: string;
  areaName: string | null;
  /**
   * The property type as a reader sees it, in the page's language — "villa",
   * "فيلا". The component used to receive the raw enum and drop it into both
   * languages, so an Arabic answer read "تضم villa المكوّنة من 4 غرف نوم".
   */
  propertyType: string;
  beds: number;
  baths: number;
  tenure: string | null;
  listingPermitNo: string | null;
  /** Band wording, from the listing-page copy document. */
  eyebrow: string;
  heading: string;
  /**
   * The questions that read the same on every listing, tokens already filled —
   * editable at Pages → Sub-pages → Property pages → FAQ.
   */
  shared: PropertyFaqItem[];
};

/**
 * T1.5 quick win: per-property FAQ block with JSON-LD `FAQPage` schema.
 * Generated from the property's facts so every detail page surfaces a
 * useful answer set for long-tail SEO (handover process, tenure rules,
 * service charges, etc.).
 *
 * Two sources, and the split is on purpose. The four entries written from the
 * listing's facts — what it includes, where it is, whether a non-resident can
 * buy it, how to verify its permit — are catalogue templates: they branch on
 * the tenure and the permit and carry bedroom and bathroom counts, which only
 * ICU can agree in Arabic. The rest used to be English template literals here,
 * which is why three whole answers stayed English on `/ar`; they are the
 * listing-page copy document's `faq.items` now, so the client can change them
 * — and their Arabic — without a deploy.
 *
 * Every value dropped into a sentence is isolated: a reference or permit is a
 * Latin code inside Arabic prose, and without it `BAZ-AD-09790` renders as
 * `09790-BAZ-AD`. Under English `isolateForLocale` is the identity, so the
 * English FAQ — and its JSON-LD — are unchanged.
 */
export async function PropertyFaq({
  locale,
  reference,
  title,
  areaName,
  propertyType,
  beds,
  baths,
  tenure,
  listingPermitNo,
  eyebrow,
  heading,
  shared,
}: Props) {
  // Explicit locale, never ambient — an ambient read resolves through
  // `headers()` and would take this route off prerendering.
  const t = await getTranslations({ locale, namespace: "property" });
  const iso = (value: string) => isolateForLocale(value, locale);

  const place = iso(areaName ?? t("fallbackCity"));
  const ref = iso(reference);
  const type = iso(propertyType);
  const bedrooms = t("faq.bedroomCount", { count: beds });

  const tenureNote =
    tenure === "freehold"
      ? t("faq.tenureFreehold")
      : tenure === "leasehold"
        ? t("faq.tenureLeasehold")
        : t("faq.tenureUnknown");

  const entries: PropertyFaqItem[] = [
    {
      q: t("faq.includesQ", { bedrooms, type, place }),
      a: t("faq.includesA", {
        bedrooms,
        type,
        place,
        baths: t("faq.bathroomCount", { count: baths }),
        reference: ref,
      }),
    },
    {
      q: t("faq.locationQ", { reference: ref }),
      a: t("faq.locationA", { title: iso(title), place }),
    },
    {
      q: t("faq.nonResidentQ", { reference: ref }),
      a: tenureNote,
    },
    ...shared,
  ];

  if (listingPermitNo) {
    entries.push({
      q: t("faq.verifyQ"),
      a: t("faq.verifyA", { permit: iso(listingPermitNo) }),
    });
  }

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
    <section className="px-4 md:px-12 py-12 md:py-16 border-t border-bz-border">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        className="serif text-[32px] mt-2 leading-tight max-w-[36ch]"
        style={{ letterSpacing: "-0.018em" }}
      >
        {heading}
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-2 max-w-[820px]">
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
                className="text-bz-ink-2 transition-transform group-open:rotate-180"
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
