/**
 * The search bar's fold, as a pure function.
 *
 * Exported rather than kept private in `lib/queries/search-bar.ts` so the
 * proof (`lib/queries/search-bar.fold.test.ts`) can run the REAL fold instead
 * of a hand-built stand-in. `fold-harness.ts` exists because a fold applied
 * one step too late type-checks, reads correctly and does nothing — and a test
 * against a hand-built object cannot see the difference.
 *
 * Runs AFTER the merge, never before. A bar with nothing stored falls back to
 * the registry, whose twins are the present-and-null ones `localiseRow`
 * resolves through the shared store; folding only the stored rows would render
 * the untouched default in English on /ar with its Arabic sitting unread,
 * which is the bug this whole section was opened to fix.
 */

import { localiseDeep, localiseRow } from "@/lib/i18n/localise";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import type { ResolvedSearchBar, SearchBarCopy } from "./types";

export function localiseSearchBar(
  bar: ResolvedSearchBar,
  locale: Locale = DEFAULT_LOCALE,
): ResolvedSearchBar {
  return {
    ...bar,
    copy: localiseRow(bar.copy as Record<string, unknown>, locale) as SearchBarCopy,
    tabs: localiseDeep(bar.tabs, locale),
  };
}
