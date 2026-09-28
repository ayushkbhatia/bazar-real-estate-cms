import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/link";
import { Wordmark, type BrandLogo } from "@/components/brand/wordmark";
import type { Locale } from "@/lib/i18n/locales";
import { ExitLink } from "./exit-link";

/**
 * The flow's own page shell (00-foundations §4, MrqFlow): a quiet top bar and
 * footer in place of the marketplace chrome, so an applicant mid-upload has
 * nothing to wander off through. The permit line is a regulatory statement,
 * so on a phone it drops under the bar rather than disappearing (D27).
 */

/** "+971 2 632 2223" → "tel:+97126322223". */
export function telHref(display: string): string {
  return `tel:${display.replace(/[^\d+]/g, "")}`;
}

export async function FlowTopBar({ locale, logo }: { locale: Locale; logo: BrandLogo | null }) {
  const t = await getTranslations({ locale, namespace: "mortgage" });
  return (
    <header className="shrink-0 border-b border-bz-border bg-bz-surface">
      <div className="flex h-[68px] items-center gap-[18px] px-4 md:px-6 lg:px-12">
        {/* Not a link: Exit is the designed way out, and it says where it goes. */}
        <Wordmark logo={logo} sublabel="" size="md" />
        <span aria-hidden className="h-5 w-px bg-bz-border-strong" />
        <span className="text-[11px] font-medium tracking-[0.14em] text-bz-ink-2 uppercase">{t("shell.section")}</span>
        <div className="flex-1" />
        <span className="hidden text-[10.5px] tracking-[0.1em] text-bz-muted uppercase md:inline">{t("shell.permit")}</span>
        <span aria-hidden className="hidden h-5 w-px bg-bz-border md:block" />
        <ExitLink label={t("shell.exit")} />
      </div>
      <div className="border-t border-bz-border px-4 py-2 text-[10.5px] tracking-[0.1em] text-bz-muted uppercase md:hidden">
        {t("shell.permit")}
      </div>
    </header>
  );
}

export async function FlowFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "mortgage" });
  const phone = t("shell.footer.phone");
  return (
    <footer className="flex flex-col gap-3 border-t border-bz-border px-4 py-[18px] text-[11.5px] text-bz-muted md:flex-row md:justify-between md:px-6 lg:px-12">
      <span>{t("shell.footer.legal")}</span>
      <span className="flex flex-wrap gap-5">
        <Link href="/legal/privacy" className="hover:text-bz-ink">
          {t("shell.footer.privacy")}
        </Link>
        <Link href="/legal/terms" className="hover:text-bz-ink">
          {t("shell.footer.terms")}
        </Link>
        <a href={telHref(phone)} className="hover:text-bz-ink">
          {phone}
        </a>
      </span>
    </footer>
  );
}
