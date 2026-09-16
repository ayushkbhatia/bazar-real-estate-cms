import Link from "next/link";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailLocale } from "@/lib/content-assets/tokens";

/**
 * Which language of the emails you are looking at.
 *
 * A toggle rather than a second set of fields under each English one: an
 * editor working through the Arabic is doing one job, and the collapsed-twin
 * pattern the blog uses costs a click per email. It carries in the URL
 * (`?lang=ar`) so a link to the Arabic side of an email is a link somebody can
 * send, and so the browser's back button steps between languages.
 */
export function LangToggle({
  lang,
  hrefFor,
  className,
}: {
  lang: EmailLocale;
  /** Same screen, other language. */
  hrefFor: (lang: EmailLocale) => string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Email language"
      className={cn(
        "inline-flex items-center rounded-md border border-bz-border bg-bz-bg p-0.5",
        className,
      )}
    >
      <Languages
        size={12}
        strokeWidth={1.8}
        aria-hidden
        className="mx-1.5 text-bz-muted"
      />
      {(
        [
          ["en", "English"],
          ["ar", "العربية"],
        ] as const
      ).map(([value, label]) => (
        <Link
          key={value}
          href={hrefFor(value)}
          aria-current={lang === value ? "true" : undefined}
          lang={value}
          className={cn(
            "h-6 px-2.5 inline-flex items-center rounded text-[12px] transition-colors",
            lang === value
              ? "bg-bz-navy text-bz-bg font-medium"
              : "text-bz-ink-2 hover:text-bz-ink",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

/** `?lang=` → the language being edited. Anything else is English. */
export function langFrom(
  value: string | string[] | undefined,
): EmailLocale {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "ar" ? "ar" : "en";
}

/** The same URL with the language swapped — used by every toggle. */
export function withLang(path: string, lang: EmailLocale): string {
  return lang === "ar" ? `${path}${path.includes("?") ? "&" : "?"}lang=ar` : path;
}
