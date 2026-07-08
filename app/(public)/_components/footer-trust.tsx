/**
 * T1.5 quick win: single-line trust strip above the global footer.
 *
 * Surfaced on every public page via the (public)/layout. Wraps the locked
 * `PublicFooter` from outside rather than editing it. Carries the legal
 * entity / regulator line only — the Google rating badge was removed at the
 * client's request.
 */
export function FooterTrust() {
  return (
    <section
      aria-label="Legal"
      className="px-12 py-5 border-t border-bz-border bg-bz-surface-2 flex items-center justify-center gap-6 flex-wrap"
    >
      <div className="text-[11.5px] text-bz-ink-2 text-center">
        © 2026 Bazar Real Estate L.L.C. All rights reserved. ADM:{" "}
        <span className="mono text-bz-ink">202400997397</span>
        {"  |  "}
        Regulated by ADREC &amp; DLD
      </div>
    </section>
  );
}
