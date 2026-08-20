/**
 * T1.5 quick win: single-line trust strip above the global footer.
 *
 * Surfaced on every public page via the (public)/layout.
 *
 * The line itself used to be hardcoded English here AND separately in
 * `messages/<locale>/footer.json` as `rights`, which meant the strip stayed English on
 * /ar while the identical sentence six rems below it turned Arabic. Both now
 * read `footer_settings.legal_line`, so the two cannot disagree and the client
 * edits the licence number and the year in one place (/admin/footer).
 */
export function FooterTrust({ legalLine }: { legalLine: string | null }) {
  if (!legalLine) return null;
  return (
    <section
      aria-label="Legal"
      className="px-12 py-5 border-t border-bz-border bg-bz-surface-2 flex items-center justify-center gap-6 flex-wrap"
    >
      <div className="text-[11.5px] text-bz-ink-2 text-center">{legalLine}</div>
    </section>
  );
}
