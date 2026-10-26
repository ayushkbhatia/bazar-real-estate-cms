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
        <FilterToggleGroup
          // `filters.completion` rather than a new key: the drawer's own
          // label for this facet, already written and already translated.
          // The explainer line that sat under it ("Off-plan is still under
          // construction…") was removed at the client's request (Oct 2026).
          label={t("filters.completion")}
          param="form"
          options={PROPERTY_FORMS}
          optionLabel={(value) => t(`formOption.${value}`)}
        />
      ) : null}
    </>
  );
}
