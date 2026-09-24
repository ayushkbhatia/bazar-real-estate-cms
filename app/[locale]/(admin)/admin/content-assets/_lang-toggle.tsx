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
 * The parameter the language rides in: `?language=ar`. The third name this
 * toggle has had, and both earlier ones were deleted in flight by something
 * outside this file.
 *
 * **Not `lang`.** `?lang=` belongs to the WordPress site this one replaced —
 * Polylang put it on every URL — so `proxy.ts` deleted it with a 308, which a
 * browser caches permanently. `proxy.ts` now leaves `/admin` out of that strip.
 *
 * **Not `locale`, nor any other route segment's name.** The root segment is
 * `app/[locale]`, so every page has a route parameter called `locale`. On
 * Vercel, Next runs in minimal mode — the platform matches the route and hands
 * over `x-matched-path` — and in that mode `normalizeCdnUrl` →
 * `filterInternalQuery` (next/dist/server/server-utils.js) deletes every query
 * key that shares a name with a route parameter, to scrub the params its own
 * router injected. It cannot tell ours from its own. `?locale=ar` never reached
 * the page, `langFrom` saw nothing, and the screen rendered English with the
 * English button lit.
 *
 * That branch runs ONLY in minimal mode: `next dev` and `next start` never take
 * it, which is why the bug passed every local test, including a production
 * build. `_lang-toggle.test.tsx` now checks this name against every dynamic
 * segment in `app/`, so a future `[language]` folder fails a test instead of
 * silently killing the toggle in production.
 */
export const LANG_PARAM = "language";

type SearchParams = Record<string, string | string[] | undefined>;

/** `?language=ar` → the language being edited. Anything else is English. */
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
