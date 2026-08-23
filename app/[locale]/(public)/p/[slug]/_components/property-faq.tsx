import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

type Props = {
  reference: string;
  title: string;
  areaName: string | null;
  propertyType: string;
  beds: number;
  baths: number;
  tenure: string | null;
  listingPermitNo: string | null;
};

/**
 * T1.5 quick win: per-property FAQ block with JSON-LD `FAQPage` schema.
 * Generated from the property's facts so every detail page surfaces a
 * useful answer set for long-tail SEO (handover process, tenure rules,
 * service charges, etc.).
 *
 * The questions intentionally avoid anything that depends on per-area
 * editorial copy — they're synthesised from the schema fields available
 * on every property.
 */
export function PropertyFaq({
  reference,
  title,
  areaName,
  propertyType,
  beds,
  baths,
  tenure,
  listingPermitNo,
}: Props) {
  const t = useTranslations("property");
  const placeForArea = areaName ?? t("fallbackCity");
  const tenureNote =
    tenure === "freehold"
      ? t("faq.tenureFreehold")
      : tenure === "leasehold"
        ? t("faq.tenureLeasehold")
        : t("faq.tenureUnknown");

  const entries: { q: string; a: string }[] = [
    {
      q: t("faq.locationQ", { reference }),
      a: t("faq.locationA", { title, place: placeForArea }),
    },
    {
      q: t("faq.nonResidentQ", { reference }),
      a: tenureNote,
    },
    {
      q: `What does the transfer process look like?`,
      a: `DLD-registered ${propertyType} transfers follow the standard MoU → 10% deposit → trustee booking → title-deed issuance sequence. Bazar's in-house conveyancing desk handles every step; transfer typically completes 30 – 45 days from accepted offer.`,
    },
    {
      q: `What are the service charges?`,
      a: `Service charge is set per community and billed by the master developer or the building OA. Exact AED/ft² varies by tower — your Bazar advisor will share the current schedule, the 5-year history, and what's included before you make an offer.`,
    },
    {
      q: `Is ${reference} mortgageable?`,
      a: `Most Abu Dhabi banks lend on freehold residential property at up to 80% LTV for residents (60% for non-residents). Bazar's mortgage desk can run a pre-approval before viewings so you know your envelope.`,
    },
  ];

  if (listingPermitNo) {
    entries.push({
      q: t("faq.verifyQ"),
      a: t("faq.verifyA", { permit: listingPermitNo }),
    });
  }

  // Also include a beds-specific question to broaden the long-tail surface
  entries.unshift({
    q: t("faq.includesQ", { beds, type: propertyType, place: placeForArea }),
    a: t("faq.includesA", {
      beds,
      type: propertyType,
      place: placeForArea,
      baths: t("faq.bathroomCount", { count: baths }),
      reference,
    }),
  });

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
      <Eyebrow>FAQ</Eyebrow>
      <h2
        className="serif text-[32px] mt-2 leading-tight max-w-[36ch]"
        style={{ letterSpacing: "-0.018em" }}
      >
        Common questions, plainly answered.
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-2 max-w-[820px]">
        {entries.map((e, i) => (
          <details
            key={i}
            className="group rounded-lg border border-bz-border bg-bz-surface p-5 open:bg-bz-bg transition-colors"
          >
            <summary className="flex justify-between items-center cursor-pointer list-none gap-6">
              <span className="text-[15.5px] font-medium text-bz-ink">
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
