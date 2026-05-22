/**
 * Sprint 5b (backfilled): commute-time row(s) for the compare attribute
 * table. Sprint 12 swaps the placeholder values for live Mapbox
 * Directions API lookups using each listing's geo.
 */
const DESTINATIONS = [
  { key: "cranleigh", label: "Cranleigh AD" },
  { key: "yas_mall", label: "Yas Mall" },
  { key: "auh_airport", label: "AUH airport" },
  { key: "corniche", label: "Corniche" },
];

export function CommuteRows({ columnCount }: { columnCount: number }) {
  if (columnCount === 0) return null;

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-bz-border bg-bz-surface-2">
        <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
          Commute time
        </div>
      </div>
      <table className="w-full text-[13.5px]">
        <tbody>
          {DESTINATIONS.map((d, di) => (
            <tr
              key={d.key}
              className={
                di === DESTINATIONS.length - 1
                  ? ""
                  : "border-b border-bz-border"
              }
            >
              <td className="px-5 py-3 text-bz-ink-2">{d.label}</td>
              {Array.from({ length: columnCount }).map((_, ci) => {
                // Deterministic placeholder minutes by column + destination.
                const baseMin = [10, 12, 22, 18][di] ?? 15;
                const offset = (ci * 3) % 7;
                const minutes = baseMin + offset;
                return (
                  <td
                    key={ci}
                    className="px-3 py-3 text-bz-ink mono"
                  >
                    {minutes}m
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-5 py-2 text-[10.5px] text-bz-muted border-t border-bz-border">
        Mapbox Directions API replaces these placeholders in Sprint 12.
      </div>
    </div>
  );
}
