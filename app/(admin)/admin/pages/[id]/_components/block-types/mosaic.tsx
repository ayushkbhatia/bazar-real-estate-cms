import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Sprint 7g (backfilled): mosaic block type editor + preview.
 * Schema lives in `lib/schemas/page.ts` (Sprint 8 extends BLOCK_KINDS
 * with "mosaic"). Today this component is a renderer placeholder that
 * accepts the existing block shape so the pages editor can compose it.
 */
export function MosaicBlockEditor({
  data,
  onChange,
}: {
  data: {
    tiles?: { label: string; image_url: string | null; href: string }[];
  };
  onChange: (next: {
    tiles: { label: string; image_url: string | null; href: string }[];
  }) => void;
}) {
  const tiles = data.tiles ?? [];

  function update(idx: number, patch: Partial<(typeof tiles)[number]>) {
    const next = tiles.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    onChange({ tiles: next });
  }
  function add() {
    onChange({ tiles: [...tiles, { label: "", image_url: null, href: "" }] });
  }
  function remove(idx: number) {
    onChange({ tiles: tiles.filter((_, i) => i !== idx) });
  }

  return (
    <div className="rounded-md border border-bz-border bg-bz-bg p-4">
      <Eyebrow>Mosaic block</Eyebrow>
      <p className="mt-2 text-[12px] text-bz-muted">
        Renders as a 4-up tile grid on the public page. Useful for areas
        and developer logos. Sprint 8 adds the schema to
        `lib/schemas/page.ts` and the renderer.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {tiles.map((t, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
          >
            <input
              value={t.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Label"
              className="h-8 px-2.5 rounded border border-bz-border bg-bz-surface text-[12.5px]"
            />
            <input
              value={t.href}
              onChange={(e) => update(i, { href: e.target.value })}
              placeholder="/communities/saadiyat-island"
              className="h-8 px-2.5 rounded border border-bz-border bg-bz-surface text-[12.5px]"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-[11.5px] text-bz-muted hover:text-bz-danger"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="text-[12px] text-bz-accent hover:text-bz-ink-2 underline underline-offset-2 self-start"
        >
          + Add tile
        </button>
      </div>
    </div>
  );
}
