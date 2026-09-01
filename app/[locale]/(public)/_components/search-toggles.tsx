"use client";

import { useTranslations } from "next-intl";
import { PROPERTY_FORMS, PROPERTY_SEGMENTS } from "@/lib/schemas/property";
import { FilterToggleGroup } from "./filter-toggle-group";

/**
 * The two strips above the search results.
 *
 * Both narrow an axis the route does not already fix, and they compose: the
 * segment says what kind of building, the completion form says how a sale is
 * coming to market. "Commercial resale" is a real thing to look for, and until
 * both strips existed the visitor could express only one half of it.
 *
 * `showForm` is the caller's answer to "does the completion form mean anything
 * here?", and it is false more often than not:
 *
 *   · /rent/search — a tenancy has no completion form at all, and the DB check
 *     keeps the column NULL there, so the filter would return zero rows by
 *     construction.
 *   · /off-plan/search — the route has already fixed it.
 *   · /buy/ready, /buy/resale — likewise, from the route.
 *
 * That leaves /buy/search, where "buy" is the umbrella spanning all three
 * forms and narrowing on the second axis is the whole point. Same condition
 * `MoreFiltersDrawer` used to apply to the same facet, which is why the facet
 * moved out of the drawer rather than being duplicated into a second control
 * that could disagree with it.
 */
export function SearchToggles({ showForm }: { showForm: boolean }) {
  const t = useTranslations("search");

  return (
    <>
      <FilterToggleGroup
        param="segment"
        label={t("segment.label")}
        options={PROPERTY_SEGMENTS}
        optionLabel={(value) => t(`segment.${value}`)}
      />
      {showForm ? (
        <>
          <FilterToggleGroup
            // `filters.completion` rather than a new key: the drawer's own
            // label for this facet, already written and already translated.
            label={t("filters.completion")}
            param="form"
            options={PROPERTY_FORMS}
            optionLabel={(value) => t(`formOption.${value}`)}
          />
          {/* The distinction the strip's three words cannot carry: "Ready
              (new)" is about never having been owned, not about the building
              being recently finished. It came with the drawer's version of
              this facet and would otherwise have been lost with it. */}
          {/* `shrink-0` as well as `basis-full`: flex-basis is a starting
              size, so on its own the line still shrank to sit beside the
              strips and shoved the map tools onto a row of their own. */}
          {/* `bz-muted`, not `bz-muted-2`. At 11.5px the AA threshold is
              4.5:1 and muted-2 is 2.71:1 on this background — it passed
              unnoticed inside the drawer only because axe never scanned a
              panel that opens on a click. Out here it is always on screen.
              muted is 4.58:1. */}
          <p className="basis-full shrink-0 text-[11.5px] text-bz-muted leading-[1.5]">
            {t("filters.completionHelp")}
          </p>
        </>
      ) : null}
    </>
  );
}
