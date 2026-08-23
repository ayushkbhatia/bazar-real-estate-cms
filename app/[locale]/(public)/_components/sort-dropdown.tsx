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
           13px the filter row is drawn at.

           `pointer-coarse:min-h-11` is the WCAG 2.5.5 floor: this measured
           168x32 at 390px, so wide enough and 12px short. `pointer-coarse:`
           rather than a width breakpoint because the question is "is a thumb
           doing the tapping", not "is the window narrow" — a touchscreen laptop
           should get the taller control and a narrow desktop window should not.
           `min-h-` rather than `h-` because `h-8` and a coarse-pointer `h-11`
           are the same property at the same specificity (a media query adds
           none), so the winner would be decided by Tailwind's utility ordering;
           `min-height` clamps the used height regardless of who wins.

           This one does NOT change the count e2e/mobile-geometry.spec.ts
           reports. Its `interactive` predicate is BUTTON / A[href] /
           role="button" / role="tab" / checkbox-radio INPUT, and a <select> is
           none of those — so the "sort-dropdown.tsx select, 32px" line in that
           spec's own comment describes a real defect that the spec never
           actually counted. Raised anyway, because a 32px-tall native select is
           a 2.5.5 failure whether or not a check is watching. */
        className="h-8 pointer-coarse:min-h-11 px-2.5 rounded border border-bz-border bg-bz-bg text-[16px] md:text-[13px] text-bz-ink outline-none focus:border-bz-accent"
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
