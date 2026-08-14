"use client";

import { useTranslations } from "next-intl";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  countUnitsByFilter,
  filterUnits,
  type DevelopmentUnit,
  type UnitFilter,
} from "@/lib/queries/development-utils";
import { AreaText } from "../../_components/area-text";
// The price column header carries the currency glyph, so the cells render
// bare grouped digits rather than repeating "AED"/"$" on every row.
import {
  convertFromAed,
  currencySymbol,
  usePreferences,
} from "@/lib/preferences";

export function UnitsTable({ units }: { units: DevelopmentUnit[] }) {
  const t = useTranslations("development");
  const { prefs } = usePreferences();
  const [filter, setFilter] = useState<UnitFilter>("all");
  const counts = useMemo(() => countUnitsByFilter(units), [units]);
  const shown = useMemo(() => filterUnits(units, filter), [units, filter]);

  const tabs: { key: UnitFilter; label: string }[] = [
    { key: "all", label: t("units.filterAll", { count: counts.all }) },
    { key: "villas", label: t("units.filterVillas", { count: counts.villas }) },
    {
      key: "townhouses",
      label: t("units.filterTownhouses", { count: counts.townhouses }),
    },
    { key: "lagoon", label: t("units.filterLagoon", { count: counts.lagoon }) },
  ];

  return (
    <div>
      <div className="flex gap-1.5 mb-4">
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={`h-[30px] px-3 rounded text-[12.5px] border transition-colors ${
                active
                  ? "bg-bz-navy text-bz-bg border-bz-navy"
                  : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-ink-2"
              }`}
              aria-pressed={active}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="rounded-lg border border-bz-border bg-bz-surface overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-start text-[11px] text-bz-muted uppercase tracking-wider">
              <th className="px-4 py-3">{t("units.type")}</th>
              <th className="px-2 py-3">{t("units.beds")}</th>
              <th className="px-2 py-3">{t("units.builtUp")}</th>
              <th className="px-2 py-3">{t("units.plot")}</th>
              <th className="px-2 py-3">{t("units.lagoonAccess")}</th>
              <th className="px-2 py-3">{t("units.orientation")}</th>
              <th className="px-2 py-3">
                {t("units.price")} · {currencySymbol(prefs.currency)}
              </th>
              <th className="px-2 py-3">{t("units.plotNumber")}</th>
              <th className="px-4 py-3 text-end">{t("units.action")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-16 text-center text-bz-muted text-[12.5px]"
                >
                  {t("units.empty")}
                </td>
              </tr>
            ) : (
              shown.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-bz-border align-middle"
                >
                  <td className="px-4 py-3 font-medium">{u.unit_type}</td>
                  <td className="px-2 py-3">{u.beds ?? "—"}</td>
                  <td className="px-2 py-3 mono">
                    <AreaText ft2={u.built_up_ft2} />
                  </td>
                  <td className="px-2 py-3 mono">
                    <AreaText ft2={u.plot_ft2} />
                  </td>
                  <td className="px-2 py-3">{u.lagoon_access ?? "—"}</td>
                  <td className="px-2 py-3">{u.orientation ?? "—"}</td>
                  <td className="px-2 py-3 mono font-medium">
                    {u.price_aed == null
                      ? "—"
                      : Math.round(
                          convertFromAed(u.price_aed, prefs.currency),
                        ).toLocaleString("en-US")}
                  </td>
                  <td className="px-2 py-3 mono text-[12px] text-bz-muted">
                    {u.plot_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {u.status === "available" ? (
                      <Button size="sm" variant="default">
                        {t("units.reserve")}
                      </Button>
                    ) : (
                      <span
                        className={`inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium ${
                          u.status === "sold"
                            ? "bg-bz-surface-3 text-bz-muted"
                            : "bg-bz-surface-2 text-bz-ink-2"
                        }`}
                      >
                        {u.status === "held"
                          ? t("units.held")
                          : u.status === "reserved"
                            ? t("units.reserved")
                            : t("units.sold")}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
