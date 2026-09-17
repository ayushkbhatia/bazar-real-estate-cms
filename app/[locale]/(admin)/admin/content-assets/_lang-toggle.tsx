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

/**
 * The parameter the language rides in — deliberately NOT `lang`.
 *
 * `?lang=` belongs to the WordPress site this one replaced: Polylang put it on
 * every URL, so `proxy.ts` deletes it and redirects. That redirect is a **308**,
 * which a browser caches permanently — the first build of this toggle shipped
 * `?lang=ar` and every Arabic button bounced straight back to English, in a way
 * that survives fixing the server. Hence a different name, and a different name
 * is what makes the poisoned URLs irrelevant rather than merely unvisited.
 *
 * `proxy.ts` now also leaves `/admin` out of that strip, so the trap cannot be
 * re-set by the next person who reaches for the obvious parameter name.
 */
export const LANG_PARAM = "locale";

type SearchParams = Record<string, string | string[] | undefined>;

/** `?locale=ar` → the language being edited. Anything else is English. */
export function langFrom(sp: SearchParams): EmailLocale {
  const value = sp[LANG_PARAM];
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "ar" ? "ar" : "en";
}

/** The same URL with the language swapped — used by every toggle. */
export function withLang(path: string, lang: EmailLocale): string {
  if (lang !== "ar") return path;
  return `${path}${path.includes("?") ? "&" : "?"}${LANG_PARAM}=ar`;
}
