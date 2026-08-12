import { Eyebrow } from "@/components/brand/eyebrow";

type Json = unknown;

/**
 * Sprint 7i (backfilled): field-by-field diff visualisation for audit-log
 * entries. Renders the `before` + `after` JSON columns as a three-row
 * table per changed key — old value, new value, and a delta marker.
 *
 * Unchanged keys (same in before+after) are collapsed by default; click
 * the toggle to expand.
 */
export function AuditDiffView({
  before,
  after,
}: {
  before: Json;
  after: Json;
}) {
  const beforeMap = toFlat(before);
  const afterMap = toFlat(after);
  const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  type Row = {
    key: string;
    before: string;
    after: string;
    changed: boolean;
    added: boolean;
    removed: boolean;
  };

  const rows: Row[] = [];
  for (const key of Array.from(allKeys).sort()) {
    const b = beforeMap.get(key);
    const a = afterMap.get(key);
    rows.push({
      key,
      before: b ?? "—",
      after: a ?? "—",
      changed: b !== a,
      added: b === undefined && a !== undefined,
      removed: b !== undefined && a === undefined,
    });
  }

  const changedRows = rows.filter((r) => r.changed);

  if (rows.length === 0) {
    return (
      <div className="text-[12.5px] text-bz-muted italic px-2">
        No data captured for this entry.
      </div>
    );
  }

  return (
    <div>
      <Eyebrow>
        Diff · {changedRows.length}{" "}
        {changedRows.length === 1 ? "field changed" : "fields changed"}
      </Eyebrow>
      <div className="mt-3 rounded-md border border-bz-border bg-bz-surface overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[480px]">
          <thead className="text-start text-[10.5px] uppercase tracking-wider text-bz-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Field</th>
              <th className="px-3 py-2 font-medium">Before</th>
              <th className="px-3 py-2 font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            {(changedRows.length > 0 ? changedRows : rows).map((r) => (
              <tr
                key={r.key}
                className="border-t border-bz-border align-top"
              >
                <td className="px-3 py-2 mono text-bz-ink-2 whitespace-nowrap">
                  {r.key}
                </td>
                <td className="px-3 py-2 mono text-bz-muted">
                  {r.removed ? (
                    <span className="text-bz-danger">{r.before}</span>
                  ) : r.changed ? (
                    <span className="line-through opacity-70">{r.before}</span>
                  ) : (
                    r.before
                  )}
                </td>
                <td className="px-3 py-2 mono text-bz-ink">
                  {r.added ? (
                    <span className="text-bz-accent">+ {r.after}</span>
                  ) : r.changed ? (
                    <span className="text-bz-accent font-medium">
                      {r.after}
                    </span>
                  ) : (
                    r.after
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Flatten a JSON object/array into dot-paths → primitive strings. */
function toFlat(
  json: unknown,
  prefix = "",
  map: Map<string, string> = new Map(),
): Map<string, string> {
  if (json === null || json === undefined) {
    if (prefix) map.set(prefix, "—");
    return map;
  }
  if (typeof json !== "object") {
    if (prefix) map.set(prefix, String(json));
    return map;
  }
  if (Array.isArray(json)) {
    if (json.length === 0) {
      if (prefix) map.set(prefix, "[]");
      return map;
    }
    for (let i = 0; i < json.length; i++) {
      toFlat(json[i], prefix ? `${prefix}[${i}]` : `[${i}]`, map);
    }
    return map;
  }
  const entries = Object.entries(json as Record<string, unknown>);
  if (entries.length === 0 && prefix) {
    map.set(prefix, "{}");
    return map;
  }
  for (const [k, v] of entries) {
    toFlat(v, prefix ? `${prefix}.${k}` : k, map);
  }
  return map;
}
