import { Trash2, RotateCcw } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

type Item = {
  id: string;
  filename: string;
  deleted_at: string;
  /** Days remaining until permanent delete. */
  daysRemaining: number;
};

/**
 * Sprint 7d (backfilled): Trash UI for /admin/media — 30-day soft-delete
 * window. Sprint 9 wires the real restore + permanent-delete actions.
 */
export function MediaTrashList({
  items,
}: {
  items: Item[];
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-bz-border bg-bz-surface py-12 text-center">
        <Eyebrow className="text-bz-muted">Trash</Eyebrow>
        <p className="mt-3 text-[13.5px] text-bz-ink-2">
          Nothing in the trash. Files stay here for 30 days before
          permanent delete.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-bz-border bg-bz-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-bz-border flex items-baseline justify-between">
        <Eyebrow>Trash · {items.length}</Eyebrow>
        <span className="mono text-[11px] text-bz-muted">
          30-day soft-delete window
        </span>
      </div>
      <ul className="divide-y divide-bz-border">
        {items.map((it) => (
          <li
            key={it.id}
            className="px-5 py-3 flex items-center gap-4 text-[13px]"
          >
            <Trash2
              size={14}
              strokeWidth={1.6}
              className="text-bz-muted flex-shrink-0"
            />
            <span className="flex-1 truncate text-bz-ink">{it.filename}</span>
            <span className="mono text-[11px] text-bz-muted">
              {it.daysRemaining}d left
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 h-7 px-2 rounded text-[12px] text-bz-ink-2 hover:text-bz-ink hover:bg-bz-bg transition-colors"
            >
              <RotateCcw size={11} strokeWidth={1.7} />
              Restore
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
