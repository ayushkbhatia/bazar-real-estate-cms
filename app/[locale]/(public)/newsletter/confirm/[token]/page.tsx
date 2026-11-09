import Link from "@/components/i18n/link";
import type { Metadata } from "next";
import { localiseMetadata } from "@/lib/i18n/localise-metadata";
import { asLocale } from "@/lib/i18n/locales";
import { getTranslations } from "next-intl/server";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { confirmNewsletterToken } from "../../../_actions/newsletter";

export const dynamic = "force-dynamic";

const METADATA: Metadata = {
  title: "Confirm subscription — Bazar",
  robots: { index: false, follow: false },
};

/** English as written above; Arabic from the site's store on /ar. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localiseMetadata(METADATA, asLocale((await params).locale));
}

type PageProps = { params: Promise<{ token: string; locale: string }> };

export default async function ConfirmPage({ params }: PageProps) {
  const { token, locale } = await params;
  // Locale passed explicitly: the ambient lookup reaches for `headers()`.
  const t = await getTranslations({ locale, namespace: "pages.newsletter" });
  const result = await confirmNewsletterToken(token);

  return (
    <section className="px-12 py-24 max-w-[640px] mx-auto text-center">
      <Eyebrow>{t("eyebrow")}</Eyebrow>

      {result.status === "ok" ? (
        <>
          <h1
            className="serif text-[48px] mt-4 font-normal"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.05 }}
          >
            {t("confirmedTitle")}
          </h1>
          <p className="mt-6 text-[16.5px] text-bz-ink-2 leading-relaxed">
            {t("confirmedBody", { email: result.email })}
          </p>
          <div className="mt-10 flex gap-3 justify-center">
            <Button asChild>
              <Link href="/insights">{t("readInsights")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/buy">{t("browseMarketplace")}</Link>
            </Button>
          </div>
        </>
      ) : result.status === "expired" ? (
        <>
          <h1
            className="serif text-[44px] mt-4 font-normal"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.1 }}
          >
            {t("expiredTitle")}
          </h1>
          <p className="mt-6 text-[16px] text-bz-ink-2 leading-relaxed">
            {t("expiredBody")}
          </p>
          <div className="mt-10">
            <Button asChild>
              <Link href="/insights">{t("backToInsights")}</Link>
            </Button>
          </div>
        </>
      ) : result.status === "not_found" ? (
        <>
          <h1
            className="serif text-[44px] mt-4 font-normal"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.1 }}
          >
            {t("notFoundTitle")}
          </h1>
          <p className="mt-6 text-[16px] text-bz-ink-2 leading-relaxed">
            {t("notFoundBody")}
          </p>
          <div className="mt-10">
            <Button asChild>
              <Link href="/insights">{t("backToInsights")}</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <h1
            className="serif text-[44px] mt-4 font-normal"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.1 }}
          >
            {t("errorTitle")}
          </h1>
          <p className="mt-6 text-[16px] text-bz-ink-2 leading-relaxed">
            {result.message}
          </p>
          <div className="mt-10">
            <Button asChild>
              <Link href="/insights">{t("backToInsights")}</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
