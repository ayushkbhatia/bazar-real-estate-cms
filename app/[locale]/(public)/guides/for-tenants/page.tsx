import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { fluid } from "../../_components/marketing/fluid";

export const metadata: Metadata = {
  title: "Guides for Tenants · Renting in Abu Dhabi",
  description:
    "Renting in Abu Dhabi is straightforward when you know the steps — the move-in process, the documents to prepare, and the full rental journey from budget to renewal.",
  alternates: { canonical: "/guides/for-tenants" },
};

/**
 * Card order. The slug is both the href and the message key, so a card
 * cannot link to one guide and describe another.
 */
const GUIDES = [
  "tenant-move-in",
  "required-documents",
  "rental-process",
] as const;

export default async function TenantsHub({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "guides" });
  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-10">
        <Eyebrow>{t("forTenants.eyebrow")}</Eyebrow>
        <h1
          className="serif mt-3.5 max-w-[900px]"
          style={{
            fontSize: fluid(72),
            letterSpacing: "-0.03em",
            lineHeight: 0.98,
          }}
        >
          {t("forTenants.title")}
        </h1>
        <p className="text-[16px] md:text-[18px] text-bz-ink-2 max-w-[700px] leading-relaxed mt-5">
          {t("forTenants.intro")}
        </p>
      </section>

      <section className="px-4 md:px-12 pb-20 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1200px]">
          {GUIDES.map((slug) => (
            <Link
              key={slug}
              href={`/guides/${slug}`}
              className="group flex flex-col rounded-lg border border-bz-border bg-bz-surface overflow-hidden hover:border-bz-ink transition-colors"
            >
              <div className="relative w-full" style={{ aspectRatio: "16/10" }}>
                <PlaceholderImage
                  label={slug}
                  className="absolute inset-0 h-full w-full"
                />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="eyebrow">
                  {t(`forTenants.card.${slug}.label`)}
                </div>
                <div
                  className="serif text-[24px] mt-2 leading-tight"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {t(`forTenants.card.${slug}.title`)}
                </div>
                <p className="text-[14px] text-bz-ink-2 leading-relaxed mt-3 flex-1">
                  {t(`forTenants.card.${slug}.desc`)}
                </p>
                <div className="flex items-center gap-2 mt-5 text-[13.5px] font-medium text-bz-accent">
                  {t("readTheGuide")}
                  <ArrowRight size={14} strokeWidth={1.8} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
