import Link from "next/link";
import { AlertTriangle } from "lucide-react";
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
 * Instrument Serif and Geist carry no Arabic glyphs, so an Arabic doc set in
 * them falls back per-glyph and looks accidental. Name the Arabic faces the
 * platform actually ships instead — no new webfont, and nothing to configure
 * at handover.
 */
const ARABIC_STACK =
  '"Noto Naskh Arabic", "Geeza Pro", "Al Bayan", "Segoe UI", Tahoma, serif';

export function LegalDocFrame({
  active,
  title,
  effective,
  dateLabel = "Effective",
  contactEmail = "dpo@bazarrealestate.ae",
  draft = true,
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
  /** Terms and cookies are still in-house drafts; privacy no longer is. */
  draft?: boolean;
  /** "ar" sets direction, typeface and chrome copy for the Arabic edition. */
  locale?: LegalLocale;
  /** The same document in the other language, when one exists. */
  translation?: { label: string; href: string; locale: LegalLocale };
  children: React.ReactNode;
}) {
  const isArabic = locale === "ar";

  return (
    <div
      className="px-12 py-16 max-w-[1100px] mx-auto"
      lang={isArabic ? "ar" : undefined}
      dir={isArabic ? "rtl" : undefined}
      style={isArabic ? { fontFamily: ARABIC_STACK } : undefined}
    >
      <Eyebrow>{isArabic ? "قانوني" : "Legal"}</Eyebrow>
      <h1
        className={cn(
          "text-[56px] font-normal mt-2 leading-[1.05] max-w-[18ch]",
          // Instrument Serif has no Arabic coverage, so .serif would only
          // trigger a fallback we did not choose.
          isArabic ? "leading-[1.3]" : "serif",
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
          <Link
            href={translation.href}
            lang={translation.locale}
            dir={translation.locale === "ar" ? "rtl" : "ltr"}
            className="h-8 px-3 inline-flex items-center rounded text-[12.5px] border border-bz-border bg-bz-surface text-bz-ink-2 transition-colors hover:border-bz-border-strong"
          >
            {translation.label}
          </Link>
        ) : null}
      </nav>

      {draft ? (
        <div className="mt-10 flex gap-3 items-start p-4 rounded-lg border border-[oklch(0.9_0.05_75)] bg-[oklch(0.97_0.04_85)]">
          <AlertTriangle
            size={18}
            strokeWidth={1.6}
            className="text-[oklch(0.45_0.13_60)] flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="text-[13.5px] text-bz-ink leading-snug font-medium">
              Lawyer-drafted copy in progress.
            </p>
            <p className="text-[12.5px] text-bz-muted leading-snug mt-1">
              This page is a working draft. A UAE-licensed counsel is finalising
              the formal text against UAE PDPL (Federal Decree-Law 45/2021) and
              UAE Consumer Protection Law (Federal Decree-Law 15/2020). Until
              the next revision, statements here describe Bazar&apos;s intended
              practice rather than a binding contract.
            </p>
          </div>
        </div>
      ) : null}

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
