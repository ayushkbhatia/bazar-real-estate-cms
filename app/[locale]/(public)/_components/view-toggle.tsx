"use client";

import { useQueryState } from "nuqs";
import { parseAsStringEnum } from "nuqs";
import { Grid3X3, List, Map } from "lucide-react";

export type SearchView = "grid" | "list" | "map";

const OPTIONS: { value: SearchView; label: string; Icon: React.ElementType }[] = [
  { value: "grid", label: "Grid", Icon: Grid3X3 },
  { value: "list", label: "List", Icon: List },
  { value: "map", label: "Map", Icon: Map },
];

/**
 * `defaultView` is what the server rendered when the URL carried no `view`
 * param — `grid` on desktop, `list` on a phone (see `resolveSearchView`).
 * Both uses below depend on it: the highlighted radio, and the fact that
 * choosing the default *clears* the param instead of writing it. Hard-coding
 * `grid` here would leave the phone toggle showing Grid over a list, and
 * tapping Grid would strip `?view=` straight back to the list.
 */
export function ViewToggle({
  defaultView = "grid",
}: {
  defaultView?: SearchView;
}) {
  const [view, setView] = useQueryState(
    "view",
    parseAsStringEnum<SearchView>(["grid", "list", "map"])
      .withDefault(defaultView)
      // shallow:false re-fetches the RSC (SearchList branches on `view`
      // server-side) so the switched view renders without a manual refresh —
      // matching SortDropdown / FilterBar.
      .withOptions({ shallow: false }),
  );

  return (
    <div
      role="radiogroup"
      aria-label="View"
      className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={view === value}
          onClick={() => setView(value === defaultView ? null : value)}
          className={
            view === value
              ? "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] font-medium bg-bz-navy text-bz-bg"
              : "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] text-bz-ink-2 hover:text-bz-ink transition-colors"
          }
        >
          <Icon size={12} strokeWidth={1.8} />
          {label}
        </button>
      ))}
    </div>
  );
}
