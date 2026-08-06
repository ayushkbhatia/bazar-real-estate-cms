import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";

export type LegalDocSlug = "privacy" | "terms" | "cookies";

const NAV: { slug: LegalDocSlug; label: string }[] = [
  { slug: "privacy", label: "Privacy" },
  { slug: "terms", label: "Terms" },
  { slug: "cookies", label: "Cookies" },
];

export function LegalDocFrame({
  active,
  title,
  effective,
  dateLabel = "Effective",
  contactEmail = "dpo@bazarrealestate.ae",
  draft = true,
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
  children: React.ReactNode;
}) {
  return (
    <div className="px-12 py-16 max-w-[1100px] mx-auto">
      <Eyebrow>Legal</Eyebrow>
      <h1
        className="serif text-[56px] font-normal mt-2 leading-[1.05] max-w-[18ch]"
        style={{ letterSpacing: "-0.025em" }}
      >
        {title}
      </h1>
      <p className="mt-3 text-[13px] text-bz-muted-2 mono uppercase tracking-wider">
        {dateLabel} {effective}
      </p>

      <nav className="mt-8 flex gap-2" aria-label="Legal documents">
        {NAV.map((item) => {
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

      {/*
        `.bz-prose p { margin: 0 }` outranks `.bz-prose > * + *`, so runs of
        paragraphs collapse into one block. Legal copy is mostly such runs —
        restore the gap here (utilities layer beats components) rather than
        reflowing every other bz-prose surface. Paragraphs directly under a
        heading keep their tight setting.
      */}
      <article className="bz-prose text-[15.5px] leading-[1.7] text-bz-ink mt-10 [&>:is(p,ul,ol,table)+p]:mt-[1.25em]">
        {children}
      </article>

      <hr className="mt-16 border-t border-bz-border" />
      <p className="mt-6 text-[12px] text-bz-muted leading-snug max-w-[60ch]">
        Questions on this document? Email{" "}
        <a
          className="underline text-bz-ink hover:text-bz-accent"
          href={`mailto:${contactEmail}`}
        >
          {contactEmail}
        </a>
        . For PDPL data-subject requests — access, rectification or erasure —
        email the same address and we will verify your identity and respond
        within the statutory period.
      </p>
    </div>
  );
}
