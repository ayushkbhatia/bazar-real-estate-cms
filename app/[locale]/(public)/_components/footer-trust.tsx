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
    /*
      `px-12` is 96px of a 390px viewport, and this strip renders on every
      public route. It left the licence line 294px to wrap into — the widest
      gutter on the site spent on the narrowest content. `px-4 md:px-12` gives
      it 358px and leaves the desktop strip exactly as drawn.

      The type steps with it. 11.5px is fine as a whisper under a 1440px
      footer; on a phone it is the smallest text on the page, and this is the
      line carrying the ADM licence number and the regulators (see the seed in
      0113) — the one piece of copy a buyer is meant to be able to read back.
    */
    <section
      aria-label="Legal"
      className="px-4 md:px-12 py-5 border-t border-bz-border bg-bz-surface-2 flex items-center justify-center gap-6 flex-wrap"
    >
      <div className="text-[13px] md:text-[11.5px] text-bz-ink-2 text-center">
        {legalLine}
      </div>
    </section>
  );
}
