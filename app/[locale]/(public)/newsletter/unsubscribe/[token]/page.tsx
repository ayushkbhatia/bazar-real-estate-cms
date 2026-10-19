import Link from "@/components/i18n/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { getSubscriberByUnsubscribeToken } from "@/lib/queries/newsletter";
import { UnsubscribeConfirm } from "./unsubscribe-confirm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe — Bazar",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ token: string; locale: string }> };

const HEADING = "serif text-[44px] mt-4 font-normal";
const HEADING_STYLE = { letterSpacing: "-0.025em", lineHeight: 1.1 } as const;

/** Reads only. The unsubscribe itself waits for the button in
 *  `UnsubscribeConfirm`; mail clients' one-click button POSTs to
 *  /api/newsletter/unsubscribe instead. */
export default async function UnsubscribePage({ params }: PageProps) {
  const { token, locale } = await params;
  // Locale passed explicitly: the ambient lookup reaches for `headers()`.
  const t = await getTranslations({ locale, namespace: "pages.newsletter" });
  const subscriber = await getSubscriberByUnsubscribeToken(token);

  return (
    <section className="px-12 py-24 max-w-[640px] mx-auto text-center">
      <Eyebrow>{t("eyebrow")}</Eyebrow>
      {!subscriber ? (
        <>
          <h1 className={HEADING} style={HEADING_STYLE}>
            {t("alreadyRemovedTitle")}
          </h1>
          <p className="mt-6 text-[16px] text-bz-ink-2 leading-relaxed">
            {t("alreadyRemovedBody", { email: "hello@bazar.ae" })}
          </p>
        </>
      ) : subscriber.status === "unsubscribed" ? (
        <>
          <h1 className={HEADING} style={HEADING_STYLE}>
            {t("removedTitle")}
          </h1>
          <p className="mt-6 text-[16.5px] text-bz-ink-2 leading-relaxed">
            {t("removedBody", { email: subscriber.email })}
          </p>
        </>
      ) : (
        <UnsubscribeConfirm
          token={token}
          copy={{
            confirmTitle: t("confirmTitle"),
            confirmBody: t("confirmBody", { email: subscriber.email }),
            confirmButton: t("confirmButton"),
            removedTitle: t("removedTitle"),
            removedBody: t("removedBody", { email: subscriber.email }),
            errorTitle: t("errorTitle"),
          }}
        />
      )}
      <div className="mt-10">
        <Button asChild variant="outline">
          <Link href="/insights">{t("backToInsights")}</Link>
        </Button>
      </div>
    </section>
  );
}
