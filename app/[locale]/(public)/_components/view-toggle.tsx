"use client";

import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { parseAsStringEnum } from "nuqs";
import { Grid3X3, List, Map } from "lucide-react";

export type SearchView = "grid" | "list" | "map";

/*
 * Value and icon only. The labels moved to `search.view.*` — they lived in a
 * module-level const, which is a place G-13 cannot see, so three visible
 * English words rode along under /ar unreported.
 */
const OPTIONS: { value: SearchView; Icon: React.ElementType }[] = [
  { value: "grid", Icon: Grid3X3 },
  { value: "list", Icon: List },
  { value: "map", Icon: Map },
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
  const t = useTranslations("search");
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
      aria-label={t("view.label")}
      className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5"
    >
      {OPTIONS.map(({ value, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={view === value}
          onClick={() => setView(value === defaultView ? null : value)}
          // h-11 on a phone, h-7 (28px) from `md` up. These are hand-rolled
          // <button>s, so the `(pointer: coarse)` 44px floor in globals.css
          // — an attribute-selector rule keyed off data-slot — never matches
          // them; 28px was the measured hit height at 390px. The pills are
          // already wider than 44px (icon + gap + label + px-2.5), so height
          // is the only failing axis of the gate's width/height pair.
          className={
            view === value
              ? "inline-flex items-center gap-1.5 h-11 md:h-7 px-2.5 rounded text-[12px] font-medium bg-bz-navy text-bz-bg"
              : "inline-flex items-center gap-1.5 h-11 md:h-7 px-2.5 rounded text-[12px] text-bz-ink-2 hover:text-bz-ink transition-colors"
          }
        >
          <Icon size={12} strokeWidth={1.8} />
          {t(`view.${value}`)}
        </button>
      ))}
    </div>
  );
}
