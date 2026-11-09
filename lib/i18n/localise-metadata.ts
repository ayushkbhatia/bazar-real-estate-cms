import type { Metadata } from "next";
import { arabicFor } from "@/lib/i18n/arabic-store";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";

/**
 * A page's static `<title>` and description, in the page's language.
 *
 * Twenty-odd routes declared `export const metadata` with English literals, so
 * every one of them published an English title and search snippet on /ar even
 * where the page itself was Arabic (Nov 2026). This keeps each route's English
 * where it was and looks the Arabic up in the site's one Arabic store
 * (`lib/master-pages/arabic/master.json`), keyed by that English — the same
 * lookup every other surface joins by. A string nobody has translated stays
 * English rather than going blank.
 *
 * Only plain-string `title` / `description` are touched; everything else
 * (robots, alternates) passes through.
 */
export function localiseMetadata(meta: Metadata, locale: Locale): Metadata {
  if (locale === DEFAULT_LOCALE) return meta;
  const tr = <T,>(v: T): T =>
    typeof v === "string" ? ((arabicFor(v) ?? v) as T) : v;
  return { ...meta, title: tr(meta.title), description: tr(meta.description) };
}
