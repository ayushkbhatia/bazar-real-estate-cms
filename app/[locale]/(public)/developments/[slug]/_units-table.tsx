"use client";

import { useTranslations } from "next-intl";

import { useMemo, useState, type ReactNode } from "react";
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

/** One label/value pair inside a narrow-viewport unit card. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wider text-bz-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-bz-ink">{children}</dd>
    </div>
  );
}

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

  // The card stack and the table show the same two derived values, so they're
  // written once here rather than kept in step by hand in two places.
  const price = (u: DevelopmentUnit) =>
    u.price_aed == null
      ? "—"
      : Math.round(convertFromAed(u.price_aed, prefs.currency)).toLocaleString(
          "en-US",
        );

  const statusControl = (u: DevelopmentUnit) =>
    u.status === "available" ? (
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
    );

  return (
    <div>
      {/* `flex-wrap` for the phone only in effect: "Lagoon access · 12" is the
          widest chip and the four of them run to roughly 420px, past the 358px
          a 390px viewport leaves after the section's `px-4`. Above `md` the
          row has over 1,100px and never reaches a second line. */}
      <div className="flex flex-wrap gap-1.5 mb-4">
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
        {/* ── Narrow: a card per unit ────────────────────────────────────
            Nine columns do not survive a phone. `table-layout: auto` first
            crushes each one to its minimum content width — every header down
            to a word a line, "Orientation" and an eight-digit `mono` price
            unbreakable at ~76px each — and the row still needs north of
            600px against the 358px a 390px viewport leaves after the
            section's `px-4`. The remainder does not scroll: the wrapper is
            `overflow-hidden`, so the Action column and its Reserve button are
            simply clipped off. Two trees below/above `md`, the same split
            `_payment-plan.tsx` uses for its milestone timeline. */}
        <ul className="md:hidden list-none">
          {shown.length === 0 ? (
            <li className="px-4 py-16 text-center text-bz-muted text-[12.5px]">
              {t("units.empty")}
            </li>
          ) : (
            shown.map((u) => (
              <li
                key={u.id}
                className="px-4 py-4 border-t border-bz-border first:border-t-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">{u.unit_type}</div>
                    {u.plot_number ? (
                      <div className="mono text-[11.5px] text-bz-muted mt-0.5">
                        {t("units.plotNumber")} {u.plot_number}
                      </div>
                    ) : null}
                  </div>
                  {/* The glyph rides the price here — there's no column
                      header on this tree to carry it. */}
                  <div className="mono text-[14px] font-medium whitespace-nowrap">
                    {u.price_aed == null
                      ? "—"
                      : `${currencySymbol(prefs.currency)} ${price(u)}`}
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px]">
                  <Field label={t("units.beds")}>{u.beds ?? "—"}</Field>
                  <Field label={t("units.builtUp")}>
                    <span className="mono">
                      <AreaText ft2={u.built_up_ft2} />
                    </span>
                  </Field>
                  <Field label={t("units.plot")}>
                    <span className="mono">
                      <AreaText ft2={u.plot_ft2} />
                    </span>
                  </Field>
                  <Field label={t("units.lagoonAccess")}>
                    {u.lagoon_access ?? "—"}
                  </Field>
                  <Field label={t("units.orientation")}>
                    {u.orientation ?? "—"}
                  </Field>
                </dl>
                <div className="mt-3.5">{statusControl(u)}</div>
              </li>
            ))
          )}
        </ul>

        {/* ── `md` and up: the nine-column table, unchanged ────────────── */}
        <table className="hidden md:table w-full text-[13px]">
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
                  <td className="px-2 py-3 mono font-medium">{price(u)}</td>
                  <td className="px-2 py-3 mono text-[12px] text-bz-muted">
                    {u.plot_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-end">{statusControl(u)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
