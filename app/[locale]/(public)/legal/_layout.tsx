import Link from "@/components/i18n/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";

export type LegalDocSlug = "privacy" | "terms" | "cookies";
export type LegalLocale = "en" | "ar";

const NAV: { slug: LegalDocSlug; label: string }[] = [
  { slug: "privacy", label: "Privacy" },
  { slug: "terms", label: "Terms" },
  { slug: "cookies", label: "Cookies" },
];

/**
 * Arabic typography is no longer handled here.
 *
 * This frame used to set an inline `fontFamily` naming a system Arabic stack,
 * which was right when it was the only Arabic surface on the site. It is now
 * actively harmful: an inline style beats a stylesheet rule, so this page
 * would keep rendering in a per-device system face while every other Arabic
 * page uses the loaded webfont — the one inconsistency a reader would notice,
 * on the page a client checks first.
 *
 * The `:lang(ar)` block in globals.css owns it now, including the `.serif`
 * suppression this file used to do by hand.
 */
export function LegalDocFrame({
  active,
  title,
  effective,
  dateLabel = "Effective",
  contactEmail = "dpo@bazarrealestate.ae",
  locale = "en",
  translation,
  children,
}: {
  active: LegalDocSlug;
  title: string;
  effective: string;
  /** Privacy says "Last updated" — its own §11 refers back to that wording. */
  dateLabel?: string;
  /** Privacy routes rights requests to info@ per the client's final text. */
  contactEmail?: string;
  /** "ar" sets direction, typeface and chrome copy for the Arabic edition. */
  locale?: LegalLocale;
  /** The same document in the other language, when one exists. */
  translation?: { label: string; href: string; locale: LegalLocale };
  children: React.ReactNode;
}) {
  const isArabic = locale === "ar";

  return (
    <div
      className="px-4 md:px-12 py-16 max-w-[1100px] mx-auto"
      lang={isArabic ? "ar" : undefined}
      dir={isArabic ? "rtl" : undefined}
    >
      <Eyebrow>{isArabic ? "قانوني" : "Legal"}</Eyebrow>
      <h1
        className={cn(
          "text-[32px] md:text-[56px] font-normal mt-2 leading-[1.05] max-w-[18ch]",
          // Instrument Serif has no Arabic coverage, so .serif would only
          // trigger a fallback we did not choose.
          "serif",
        )}
        style={isArabic ? undefined : { letterSpacing: "-0.025em" }}
      >
        {title}
      </h1>
      <p
        className={cn(
          "mt-3 text-[13px] text-bz-muted-2",
          isArabic ? "" : "mono uppercase tracking-wider",
        )}
      >
        {dateLabel} {effective}
      </p>

      {/*
        Only privacy exists in Arabic. Offering the English doc tabs from the
        Arabic page would promise translations that are not there, so the
        Arabic edition gets the language switch alone.
      */}
      <nav
        className="mt-8 flex gap-2"
        aria-label={isArabic ? "لغة المستند" : "Legal documents"}
      >
        {!isArabic &&
          NAV.map((item) => {
            const isActive = item.slug === active;
            return (
              <Link
                key={item.slug}
                href={`/legal/${item.slug}`}
                className={cn(
                  "h-8 px-3 inline-flex items-center rounded text-[12.5px] border transition-colors",
                  isActive
                    ? "bg-bz-navy text-bz-bg border-bz-navy"
                    : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        {translation ? (
          /*
            A plain anchor, and deliberately so.

            `components/i18n/link` prefixes every href with the CURRENT locale,
            which is exactly wrong for the one link whose whole job is to leave
            it: on /ar/legal/privacy the "English" switch asked for
            /legal/privacy and was handed back /ar/legal/privacy — a link to
            the page the reader is already on. The href here is built by
            `localeSwitchHref`, so it already carries its target prefix and the
            `setlang` param that makes the choice stick.
          */
          <a
            href={translation.href}
            lang={translation.locale}
            dir={translation.locale === "ar" ? "rtl" : "ltr"}
            className="h-8 px-3 inline-flex items-center rounded text-[12.5px] border border-bz-border bg-bz-surface text-bz-ink-2 transition-colors hover:border-bz-border-strong"
          >
            {translation.label}
          </a>
        ) : null}
      </nav>

      <article className="bz-prose text-[15.5px] leading-[1.7] text-bz-ink mt-10">
        {children}
      </article>

      <hr className="mt-16 border-t border-bz-border" />
      <p className="mt-6 text-[12px] text-bz-muted leading-relaxed max-w-[60ch]">
        {isArabic ? (
          <>
            أسئلة حول هذا المستند؟ راسلونا على{" "}
            <a
              className="underline text-bz-ink hover:text-bz-accent"
              href={`mailto:${contactEmail}`}
              dir="ltr"
            >
              {contactEmail}
            </a>
            . ولممارسة حقوقكم بموجب قانون حماية البيانات الشخصية — الاطلاع أو
            التصحيح أو الحذف — راسلونا على العنوان نفسه، وسنتحقق من هويتكم ونرد
            خلال المدة المقررة قانونًا.
          </>
        ) : (
          <>
            Questions on this document? Email{" "}
            <a
              className="underline text-bz-ink hover:text-bz-accent"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>
            . For PDPL data-subject requests — access, rectification or erasure
            — email the same address and we will verify your identity and
            respond within the statutory period.
          </>
        )}
      </p>
    </div>
  );
}
