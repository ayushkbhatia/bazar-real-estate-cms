"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Copy, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArabicTwin } from "../../../../_fields/arabic-twin";
import {
  MAX_UNITS,
  UNIT_STATUSES,
  UNIT_STATUS_LABELS,
  blankUnit,
  type UnitRowInput,
} from "@/lib/schemas/development-inventory";
import { saveDevelopmentUnits } from "../_inventory-actions";

export type FloorPlanOption = { id: string; label: string };

const cellCls =
  "bz-field w-full rounded border border-bz-border px-1.5 py-1 bg-bz-bg outline-none focus:border-bz-accent text-[12.5px]";

const numberOrNull = (v: string) => (v === "" ? null : Number(v));
const textOrNull = (v: string) => (v.trim() === "" ? null : v);

const STATUS_CHIP: Record<string, string> = {
  available: "text-bz-ink",
  held: "text-bz-ink-2",
  reserved: "text-bz-ink-2",
  sold: "text-bz-muted",
};

/**
 * Sales inventory — the rows behind the public "What's left" table.
 *
 * Its own card, and deliberately not merged into "Units & floor plans" above:
 * that card is the *catalogue* (a handful of unit types, each with layouts),
 * this is the *stock list* (one row per plot, with its own price and its own
 * availability). Editing a hundred plot rows inside a folding tree of unit
 * types would be unusable, and the two are already separate tables.
 *
 * The grid scrolls sideways rather than wrapping. Eleven columns will not fit
 * an 860px editor column at a readable size, and a wrapped row loses the thing
 * a grid is for — reading down a column to spot the plot that is priced wrong.
 *
 * Nothing has ever written to this table from the CMS — the rows in production
 * arrived with the seed data — which is why the Arabic twins added in migration
 * 0104 had nowhere to be typed.
 */
export function DevelopmentUnitsCard({
  slug,
  initial,
  floorPlans,
  totalUnits,
}: {
  slug: string;
  initial: UnitRowInput[];
  floorPlans: FloorPlanOption[];
  /** From the record — what the public eyebrow counts "remaining" against. */
  totalUnits: number | null;
}) {
  const router = useRouter();
  const [units, setUnits] = useState<UnitRowInput[]>(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const available = useMemo(
    () => units.filter((u) => u.status === "available").length,
    [units],
  );

  function update(next: UnitRowInput[]) {
    setUnits(next);
    setDirty(true);
  }

  function setUnit(i: number, patch: Partial<UnitRowInput>) {
    update(units.map((u, x) => (x === i ? { ...u, ...patch } : u)));
  }

  function move(i: number, delta: number) {
    const to = i + delta;
    if (to < 0 || to >= units.length) return;
    const next = units.slice();
    [next[i], next[to]] = [next[to]!, next[i]!];
    update(next);
    setOpen(open === i ? to : open === to ? i : open);
  }

  function add() {
    // Seeded from the last row's type, because inventory repeats: twelve
    // "Villa A" rows differing only by plot number is the normal shape.
    const last = units[units.length - 1];
    update([...units, blankUnit(last?.unit_type ?? "")]);
    setOpen(null);
  }

  /** Copy a row, minus its id and plot number — the two things that must
   *  differ. Everything else on a neighbouring plot is usually identical. */
  function duplicate(i: number) {
    const source = units[i]!;
    const copy: UnitRowInput = { ...source, id: null, plot_number: null };
    update([...units.slice(0, i + 1), copy, ...units.slice(i + 1)]);
    setOpen(null);
  }

  function remove(i: number) {
    update(units.filter((_, x) => x !== i));
    setOpen(null);
  }

  function onSave() {
    startTransition(async () => {
      const result = await saveDevelopmentUnits(slug, { units });
      if (result.status === "ok") {
        toast.success(result.message);
        setDirty(false);
        router.refresh();
      } else if (result.status === "invalid") {
        toast.error(result.message, {
          description: result.issues.slice(0, 4).join("\n"),
        });
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13.5px] font-medium">Inventory</h2>
          <p className="text-[12.5px] text-bz-muted mt-1 leading-relaxed">
            One row per unit, in the order the public table lists them. The page
            heading counts {available} available
            {totalUnits != null ? ` of ${totalUnits}` : ""} — that total comes
            from the project record, not from this grid, so the two are worth
            keeping in step.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={pending || !dirty}
        >
          <Save size={13} strokeWidth={1.8} />
          {pending ? "Saving…" : "Save inventory"}
        </Button>
      </div>

      {units.length === 0 ? (
        <div className="rounded border border-dashed border-bz-border bg-bz-surface-2 p-4 flex flex-col gap-2.5 items-start">
          <p className="text-[12.5px] text-bz-ink-2 leading-relaxed">
            No units listed. The &ldquo;What&rsquo;s left&rdquo; section is
            hidden on the public page until there is at least one.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus size={12} strokeWidth={1.8} /> Add the first unit
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-bz-border bg-bz-surface overflow-x-auto">
          <table className="w-full text-[12.5px] min-w-[1080px]">
            <thead>
              <tr className="text-start text-[10.5px] text-bz-muted uppercase tracking-wider border-b border-bz-border">
                <th className="ps-2 py-2 w-14" />
                <th className="px-1.5 py-2 text-start min-w-[150px]">Type</th>
                <th className="px-1.5 py-2 text-start w-[62px]">Beds</th>
                <th className="px-1.5 py-2 text-start w-[86px]">Built-up</th>
                <th className="px-1.5 py-2 text-start w-[86px]">Plot ft²</th>
                <th className="px-1.5 py-2 text-start min-w-[120px]">
                  Lagoon access
                </th>
                <th className="px-1.5 py-2 text-start min-w-[96px]">
                  Orientation
                </th>
                <th className="px-1.5 py-2 text-start w-[112px]">Price AED</th>
                <th className="px-1.5 py-2 text-start w-[90px]">Plot #</th>
                <th className="px-1.5 py-2 text-start w-[104px]">Status</th>
                <th className="pe-2 py-2 w-[76px]" />
              </tr>
            </thead>
            <tbody>
              {units.map((u, i) => {
                const expanded = open === i;
                const name = u.unit_type.trim() || `unit ${i + 1}`;
                return [
                  <tr
                    key={u.id ?? `new-${i}`}
                    className={cn(
                      "border-t border-bz-border align-middle",
                      u.status === "sold" && "opacity-70",
                    )}
                  >
                    <td className="ps-2 py-1">
                      <div className="flex items-center gap-0.5">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            aria-label={`Move ${name} up`}
                            disabled={i === 0}
                            onClick={() => move(i, -1)}
                            className="h-3 text-bz-muted hover:text-bz-ink disabled:opacity-30 leading-none text-[9px]"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${name} down`}
                            disabled={i === units.length - 1}
                            onClick={() => move(i, 1)}
                            className="h-3 text-bz-muted hover:text-bz-ink disabled:opacity-30 leading-none text-[9px]"
                          >
                            ▼
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpen(expanded ? null : i)}
                          aria-expanded={expanded}
                          aria-label={`Arabic and layout for ${name}`}
                          className="inline-flex items-center text-bz-muted hover:text-bz-ink"
                        >
                          <ChevronRight
                            size={12}
                            strokeWidth={2}
                            className={cn(
                              "transition-transform",
                              expanded && "rotate-90",
                            )}
                          />
                        </button>
                        <span className="mono text-[10px] text-bz-muted-2 w-4 text-end">
                          {i + 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-1.5 py-1">
                      <input
                        className={cellCls}
                        value={u.unit_type}
                        placeholder="Villa A"
                        aria-label={`Unit ${i + 1} type`}
                        onChange={(e) =>
                          setUnit(i, { unit_type: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <input
                        type="number"
                        min={0}
                        className={cn(cellCls, "mono")}
                        value={u.beds ?? ""}
                        aria-label={`Unit ${i + 1} beds`}
                        onChange={(e) =>
                          setUnit(i, { beds: numberOrNull(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <input
                        type="number"
                        min={0}
                        className={cn(cellCls, "mono")}
                        value={u.built_up_ft2 ?? ""}
                        aria-label={`Unit ${i + 1} built-up area`}
                        onChange={(e) =>
                          setUnit(i, {
                            built_up_ft2: numberOrNull(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <input
                        type="number"
                        min={0}
                        className={cn(cellCls, "mono")}
                        value={u.plot_ft2 ?? ""}
                        aria-label={`Unit ${i + 1} plot area`}
                        onChange={(e) =>
                          setUnit(i, { plot_ft2: numberOrNull(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <input
                        className={cellCls}
                        value={u.lagoon_access ?? ""}
                        placeholder="Direct"
                        aria-label={`Unit ${i + 1} lagoon access`}
                        onChange={(e) =>
                          setUnit(i, {
                            lagoon_access: textOrNull(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <input
                        className={cellCls}
                        value={u.orientation ?? ""}
                        placeholder="NW"
                        aria-label={`Unit ${i + 1} orientation`}
                        onChange={(e) =>
                          setUnit(i, { orientation: textOrNull(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <input
                        type="number"
                        min={0}
                        className={cn(cellCls, "mono")}
                        value={u.price_aed ?? ""}
                        aria-label={`Unit ${i + 1} price`}
                        onChange={(e) =>
                          setUnit(i, { price_aed: numberOrNull(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <input
                        className={cn(cellCls, "mono")}
                        value={u.plot_number ?? ""}
                        placeholder="A-12"
                        aria-label={`Unit ${i + 1} plot number`}
                        onChange={(e) =>
                          setUnit(i, { plot_number: textOrNull(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <select
                        className={cn(cellCls, STATUS_CHIP[u.status])}
                        value={u.status}
                        aria-label={`Unit ${i + 1} status`}
                        onChange={(e) =>
                          setUnit(i, {
                            status: e.target
                              .value as UnitRowInput["status"],
                          })
                        }
                      >
                        {UNIT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {UNIT_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="pe-2 py-1">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => duplicate(i)}
                          disabled={units.length >= MAX_UNITS}
                          aria-label={`Duplicate ${name}`}
                          title="Duplicate this row without its plot number"
                          className="h-6 w-6 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-ink disabled:opacity-30"
                        >
                          <Copy size={12} strokeWidth={1.7} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(i)}
                          aria-label={`Remove ${name}`}
                          className="h-6 w-6 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-danger"
                        >
                          <Trash2 size={12} strokeWidth={1.7} />
                        </button>
                      </div>
                    </td>
                  </tr>,
                  expanded ? (
                    <tr
                      key={`${u.id ?? `new-${i}`}-detail`}
                      className="border-t border-bz-border bg-bz-surface-2"
                    >
                      <td colSpan={11} className="px-3 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
                          <div className="flex flex-col gap-1">
                            <Label className="text-[11px]">Type</Label>
                            <ArabicTwin
                              field={{
                                key: "unit_type_ar",
                                label: "Type",
                                kind: "text",
                                max: 80,
                              }}
                              value={u.unit_type_ar ?? ""}
                              onChange={(v) =>
                                setUnit(i, { unit_type_ar: textOrNull(v) })
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-[11px]">Lagoon access</Label>
                            <ArabicTwin
                              field={{
                                key: "lagoon_access_ar",
                                label: "Lagoon access",
                                kind: "text",
                                max: 80,
                              }}
                              value={u.lagoon_access_ar ?? ""}
                              onChange={(v) =>
                                setUnit(i, { lagoon_access_ar: textOrNull(v) })
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-[11px]">Orientation</Label>
                            <ArabicTwin
                              field={{
                                key: "orientation_ar",
                                label: "Orientation",
                                kind: "text",
                                max: 40,
                              }}
                              value={u.orientation_ar ?? ""}
                              onChange={(v) =>
                                setUnit(i, { orientation_ar: textOrNull(v) })
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1 md:col-span-3">
                            <Label className="text-[11px]">Layout</Label>
                            <select
                              className={cn(cellCls, "md:max-w-[320px]")}
                              value={u.floor_plan_id ?? ""}
                              onChange={(e) =>
                                setUnit(i, {
                                  floor_plan_id: e.target.value || null,
                                })
                              }
                            >
                              <option value="">No layout linked</option>
                              {floorPlans.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                            <p className="text-[11px] text-bz-muted">
                              {floorPlans.length === 0
                                ? "Add layouts under Units & floor plans first, then link them here."
                                : "From this project's floor plans, above."}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      {units.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={add}
            disabled={units.length >= MAX_UNITS}
          >
            <Plus size={12} strokeWidth={1.8} /> Add unit
          </Button>
          <span className="text-[11.5px] text-bz-muted">
            {units.length} of {MAX_UNITS} · {available} available
          </span>
        </div>
      ) : null}
    </section>
  );
}
