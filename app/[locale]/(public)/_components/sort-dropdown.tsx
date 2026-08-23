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
        /* 16px until `md`: a native select under 16px makes iOS Safari zoom the
           viewport as the picker opens, so choosing a sort order leaves the
           results list magnified behind the sheet. The `md:` half keeps the
           13px the filter row is drawn at. */
        className="h-8 px-2.5 rounded border border-bz-border bg-bz-bg text-[16px] md:text-[13px] text-bz-ink outline-none focus:border-bz-accent"
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
