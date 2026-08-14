import type { ReactNode } from "react";

/**
 * A run of English shown inside an Arabic page, marked as such.
 *
 * ADR-0007 §5 commits to this in as many words: *"Missing Arabic falls back to
 * English, per field, in place. Wrapped in `<span lang="en" dir="ltr">` so it
 * stays bidi-correct. Never hidden, never blocking publish, never `noindex`."*
 * `lib/i18n/localise.ts` implements the falling-back half; this is the wrapper
 * half, which had no implementation.
 *
 * `app/globals.css:920-989` was already written for it. The Arabic typography
 * block deliberately keys on `:lang(ar)` rather than `[dir="rtl"]` — the
 * comment at `:921` says so — precisely so that a `lang="en"` subtree inside an
 * Arabic page keeps the Latin brand face instead of being rendered in IBM Plex
 * Arabic. Without this component that design does nothing, because nothing
 * emits `lang="en"`.
 *
 * Three things it buys, only one of them visual:
 *
 * - **Typography.** The Latin face, not the Arabic one, for Latin text.
 * - **Direction.** `dir="ltr"` isolates the run, so a trailing `?` or `ft²`
 *   cannot migrate to the far end of the Arabic sentence around it.
 * - **Assistive tech.** A screen reader switches voice on `lang`. Without it,
 *   an English sentence is read aloud with Arabic phonetics — which is not a
 *   degraded experience so much as an unusable one.
 *
 * Deliberately not conditional on locale. Under `en` it renders a `lang="en"`
 * span inside a `lang="en"` document: redundant, inert, and zero visual change.
 * A locale check here would mean every caller needs the locale to render a
 * fallback, and the callers that most need this are the ones deepest in a tree.
 */
export function EnglishFallback({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span lang="en" dir="ltr" className={className}>
      {children}
    </span>
  );
}
