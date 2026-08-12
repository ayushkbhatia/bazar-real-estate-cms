/**
 * Sprint 7g (backfilled): block-row thumbnail key for the pages editor.
 * Renders the type-icon glyph used inside each row of the block list.
 */
export function BlockKindThumb({ kind }: { kind: string }) {
  const glyph = THUMB[kind] ?? "▢";
  return (
    <span className="inline-flex w-6 h-6 rounded bg-bz-surface-2 text-bz-muted items-center justify-center text-[11px] mono">
      {glyph}
    </span>
  );
}

const THUMB: Record<string, string> = {
  hero: "▣",
  strip: "≡",
  split: "▥",
  grid: "▦",
  banner: "—",
  mosaic: "▦",
  embed: "▶",
};
