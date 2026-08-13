import { getLocale } from "next-intl/server";
import { ALL_LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";

/**
 * The locale of the request being served, for code that reads content.
 *
 * Public query functions call this themselves rather than taking a required
 * parameter, and that is a deliberate reversal of the usual "explicit beats
 * ambient" preference. The failure modes are not symmetric:
 *
 *   - A forgotten argument renders an Arabic page with English content. The
 *     page looks finished, nothing errors, and the only people who would
 *     notice are the ones who cannot read the English.
 *   - An ambient read is wrong only where there is no request, and there it
 *     falls back to English, which is what those callers want anyway.
 *
 * So the default is correct and the override exists for tests. `setRequestLocale`
 * is called in `app/[locale]/layout.tsx`, above every public route, which is
 * what makes `getLocale()` resolvable this far down.
 */
export async function currentLocale(): Promise<Locale> {
  try {
    const value = await getLocale();
    return (ALL_LOCALES as readonly string[]).includes(value)
      ? (value as Locale)
      : DEFAULT_LOCALE;
  } catch {
    // No request scope — a build-time script, a cron route, a unit test.
    // English is the right answer for all three.
    return DEFAULT_LOCALE;
  }
}
