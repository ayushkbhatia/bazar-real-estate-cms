"use client";

import { useQueryState } from "nuqs";
import { parseAsStringEnum } from "nuqs";
import { SORT_OPTIONS } from "@/lib/filters/property";

const LABELS: Record<(typeof SORT_OPTIONS)[number], string> = {
  recent: "Most recent",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  area_desc: "Largest first",
};

export function SortDropdown() {
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsStringEnum([...SORT_OPTIONS]).withOptions({ shallow: false }),
  );

  return (
    <label className="inline-flex items-center gap-2 text-[12.5px] text-bz-muted">
      Sort
      <select
        value={sort ?? "recent"}
        onChange={(e) =>
          setSort(
            (e.target.value as (typeof SORT_OPTIONS)[number]) === "recent"
              ? null
              : (e.target.value as (typeof SORT_OPTIONS)[number]),
          )
        }
        className="h-8 px-2.5 rounded border border-bz-border bg-bz-bg text-[13px] text-bz-ink outline-none focus:border-bz-accent"
      >
        {SORT_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}
