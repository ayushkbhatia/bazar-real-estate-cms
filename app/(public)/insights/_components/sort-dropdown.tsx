"use client";

import { useQueryState } from "nuqs";
import { parseAsStringEnum } from "nuqs";

const SORTS = ["newest", "oldest", "longest_read"] as const;
type SortKey = (typeof SORTS)[number];

const LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  longest_read: "Longest reads",
};

/**
 * Sprint 5d (backfilled): sort dropdown on /insights index.
 *
 * Sort is server-applied — the list query reads `?sort=…` and orders
 * accordingly. Sprint 9 wires it into `listPublishedArticles` (currently
 * always orders by published_at desc).
 */
export function InsightsSortDropdown() {
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsStringEnum<SortKey>([...SORTS]).withOptions({ shallow: false }),
  );

  return (
    <label className="inline-flex items-center gap-2 text-[12.5px] text-bz-muted">
      Sort
      <select
        value={sort ?? "newest"}
        onChange={(e) =>
          setSort(
            (e.target.value as SortKey) === "newest"
              ? null
              : (e.target.value as SortKey),
          )
        }
        className="h-8 px-2.5 rounded border border-bz-border bg-bz-bg text-[13px] text-bz-ink outline-none focus:border-bz-border-strong"
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}
