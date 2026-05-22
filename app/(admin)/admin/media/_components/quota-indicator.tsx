/**
 * Sprint 7d (backfilled): Supabase Storage quota indicator on the media
 * page. Sprint 13 wires the live bytes-used reading; today the parent
 * passes the figures so the component renders.
 */
export function MediaQuotaIndicator({
  bytesUsed,
  bytesAllowed = 50 * 1024 * 1024 * 1024,
}: {
  bytesUsed: number;
  bytesAllowed?: number;
}) {
  const pct = Math.min(1, bytesUsed / bytesAllowed);
  const pctLabel = Math.round(pct * 100);

  const tone =
    pct < 0.6 ? "ok" : pct < 0.85 ? "warn" : "danger";
  const color = {
    ok: "var(--bz-accent, #4a6c4a)",
    warn: "var(--bz-warning, #b58a30)",
    danger: "var(--bz-danger, #8c2b2b)",
  }[tone];

  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-3 min-w-[200px]">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wider text-bz-muted">
          Storage
        </span>
        <span className="mono text-[11px] text-bz-ink">
          {pctLabel}%
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-bz-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct * 100}%`, background: color }}
        />
      </div>
      <div className="mt-2 text-[11px] text-bz-muted">
        <span className="mono text-bz-ink-2">
          {formatBytes(bytesUsed)}
        </span>{" "}
        of {formatBytes(bytesAllowed)}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
