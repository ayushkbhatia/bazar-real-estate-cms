import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

export const metadata: Metadata = {
  title: "Guides · UAE residency, tax, and KYC for buyers",
  description:
    "Plain-English walk-throughs of the Golden Visa, 2-year property-linked residency, UAE Tax Residency Certificate, and KYC paperwork for non-resident property buyers.",
  alternates: { canonical: "/guides" },
};

/**
 * Card order. The slug is both the href and the message key, so a card cannot
 * link to one guide and describe another.
 */
const GUIDES = [
  "golden-visa",
  "property-linked-residency",
  "tax-residency",
  "kyc-non-residents",
  "for-tenants",
  "for-landlords",
] as const;

export default async function GuidesIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "guides" });
  return (
    <article className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-24 pb-12 border-b border-bz-border">
        <Eyebrow>{t("index.eyebrow")}</Eyebrow>
        <h1
          className="serif text-[38px] md:text-[72px] mt-3 leading-[0.98] max-w-[24ch]"
          style={{ letterSpacing: "-0.028em" }}
        >
          {t("index.title")}
        </h1>
        <p className="mt-6 max-w-[58ch] text-[17px] text-bz-ink-2 leading-relaxed">
          {t("index.intro")}
        </p>
      </section>

      <section className="px-4 md:px-12 py-16">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1100px]">
          {GUIDES.map((slug) => (
            <li key={slug}>
              <Link
                href={`/guides/${slug}`}
                className="group block rounded-lg border border-bz-border bg-bz-surface p-7 h-full hover:border-bz-ink transition-colors"
              >
                <div className="text-[11px] uppercase tracking-wider text-bz-ink-2">
                  {t(`index.card.${slug}.eyebrow`)}
                </div>
                <h2
                  className="serif text-[28px] mt-2 leading-tight"
                  style={{ letterSpacing: "-0.018em" }}
                >
                  {t(`index.card.${slug}.title`)}
                </h2>
                <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed">
                  {t(`index.card.${slug}.intro`)}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-bz-ink group-hover:text-bz-accent transition-colors">
                  {t("readTheGuide")}
                  <ArrowRight size={13} strokeWidth={1.7} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
