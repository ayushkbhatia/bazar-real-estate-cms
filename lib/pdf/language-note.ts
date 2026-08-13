import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";

/**
 * PDFs are English-only by decision, and the download control says so.
 *
 * Confirmed with the client 2026-08-13: one PDF serves both the English and
 * Arabic pages. So this is not a placeholder waiting on an Arabic renderer —
 * the suffix is permanent, and it earns its place by telling an Arabic reader
 * what they are about to download before they download it.
 *
 * The renderer limitations below are kept because they explain why a bilingual
 * PDF was never cheap, and would have to be re-solved if that decision ever
 * changes.
 *
 * `@react-pdf/renderer` 4.5.1 genuinely has bidi (via bidi-js in
 * `@react-pdf/textkit`) and genuine Arabic shaping (fontkit's
 * UniversalShaper), and it accepts `direction: "rtl"` as a style. What it does
 * NOT have is RTL *layout*: `calculateLayout(page)` is called with no
 * direction argument, so Yoga lays every `flexDirection: "row"` out
 * left-to-right regardless, and there are no logical style props anywhere in
 * the library. Mirroring means hand-editing every row, textAlign and
 * paddingHorizontal across ~1,270 lines of lib/pdf.
 *
 * On top of that the standard-14 fonts carry no Arabic at all, so embedding a
 * subsettable TTF is a separate licence grant with its own procurement lead
 * time — the same question that is open for the web font.
 *
 * So it is one word in the button rather than a half-measure.
 * Arabic strings in an LTR layout with Helvetica renders blank boxes in a
 * mirrored-looking frame, which reads to a client as a broken feature rather
 * than an unfinished one — worse than an English PDF clearly labelled English.
 *
 * Returns a suffix, empty for English so the control is untouched there.
 */
export function pdfLanguageSuffix(locale: Locale = DEFAULT_LOCALE): string {
  return locale === DEFAULT_LOCALE ? "" : " (English)";
}

/** Convenience for a control label: `pdfLabel("Download PDF", locale)`. */
export function pdfLabel(label: string, locale: Locale = DEFAULT_LOCALE): string {
  return `${label}${pdfLanguageSuffix(locale)}`;
}
