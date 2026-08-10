"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  countUnitsByFilter,
  filterUnits,
  type DevelopmentUnit,
  type UnitFilter,
} from "@/lib/queries/development-utils";
import { AreaText } from "../../_components/area-text";

function formatAed(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export function UnitsTable({ units }: { units: DevelopmentUnit[] }) {
  const [filter, setFilter] = useState<UnitFilter>("all");
  const counts = useMemo(() => countUnitsByFilter(units), [units]);
  const shown = useMemo(() => filterUnits(units, filter), [units, filter]);

  const tabs: { key: UnitFilter; label: string }[] = [
    { key: "all", label: `All · ${counts.all}` },
    { key: "villas", label: `Villas · ${counts.villas}` },
    { key: "townhouses", label: `Townhouses · ${counts.townhouses}` },
    { key: "lagoon", label: `Lagoon access · ${counts.lagoon}` },
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
            <tr className="text-left text-[11px] text-bz-muted uppercase tracking-wider">
              <th className="px-4 py-3">Type</th>
              <th className="px-2 py-3">Beds</th>
              <th className="px-2 py-3">Built-up</th>
              <th className="px-2 py-3">Plot</th>
              <th className="px-2 py-3">Lagoon access</th>
              <th className="px-2 py-3">Orientation</th>
              <th className="px-2 py-3">Price · AED</th>
              <th className="px-2 py-3">Plot #</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-16 text-center text-bz-muted text-[12.5px]"
                >
                  No units match this filter.
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
                    {formatAed(u.price_aed)}
                  </td>
                  <td className="px-2 py-3 mono text-[12px] text-bz-muted">
                    {u.plot_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.status === "available" ? (
                      <Button size="sm" variant="default">
                        Reserve
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
                          ? "Held"
                          : u.status === "reserved"
                            ? "Reserved"
                            : "Sold"}
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
