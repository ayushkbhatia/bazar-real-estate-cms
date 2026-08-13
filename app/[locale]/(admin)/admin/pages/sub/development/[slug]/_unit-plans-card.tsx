"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArabicTwin } from "../../../../_fields/arabic-twin";
import {
  MAX_PLANS_PER_TYPE,
  MAX_PLANS_SHOWN,
  MAX_UNIT_TYPES,
  UNIT_TYPE_CHOICES,
  blankPlan,
  blankUnitType,
  type FloorPlanInput,
  type UnitTypeInput,
} from "@/lib/schemas/development-unit-plans";
import type { MediaOption } from "../../../../_fields/types";
import { ImagePicker } from "../../../../_fields/image-picker";
import {
  saveDevelopmentUnitPlans,
  seedDevelopmentUnitPlans,
} from "../_unit-actions";

const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[12.5px]";

const numberOrNull = (v: string) => (v === "" ? null : Number(v));

/**
 * Unit types and the layouts under each — `developments > units > floor plans`.
 *
 * The public page draws a button per unit type and, when one is pressed, up to
 * four layout cards. This card is where both come from: the types in order, and
 * each type's layouts nested under it, with its plan drawing picked from (or
 * uploaded to) the media library.
 *
 * A separate card from "Page content" because these are their own tables rather
 * than fields on the development row, and because the tree gets tall — folding
 * a unit type away is the only way the screen stays readable at seven of them.
 */
export function DevelopmentUnitPlansCard({
  slug,
  initial,
  media: initialMedia,
  bedroomsText,
}: {
  slug: string;
  initial: UnitTypeInput[];
  media: MediaOption[];
  /** Drives the suggested starter set when there's nothing here yet. */
  bedroomsText: string | null;
}) {
  const router = useRouter();
  const [media, setMedia] = useState(initialMedia);
  const [types, setTypes] = useState<UnitTypeInput[]>(initial);
  const [open, setOpen] = useState<number | null>(initial.length ? 0 : null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function update(next: UnitTypeInput[]) {
    setTypes(next);
    setDirty(true);
  }

  function setType(i: number, patch: Partial<UnitTypeInput>) {
    update(types.map((t, x) => (x === i ? { ...t, ...patch } : t)));
  }

  function setPlan(i: number, j: number, patch: Partial<FloorPlanInput>) {
    setType(i, {
      plans: types[i]!.plans.map((p, y) => (y === j ? { ...p, ...patch } : p)),
    });
  }

  function move(i: number, delta: number) {
    const to = i + delta;
    if (to < 0 || to >= types.length) return;
    const next = types.slice();
    [next[i], next[to]] = [next[to]!, next[i]!];
    update(next);
    setOpen(open === i ? to : open === to ? i : open);
  }

  function addType(beds: number | null, label: string) {
    update([...types, blankUnitType(label, beds)]);
    setOpen(types.length);
  }

  function onSave() {
    startTransition(async () => {
      const result = await saveDevelopmentUnitPlans(slug, { unit_types: types });
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

  function onSeed() {
    startTransition(async () => {
      const result = await seedDevelopmentUnitPlans(slug);
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  // Offer the bedroom counts that aren't taken yet; a project rarely wants two
  // "3 Bedroom" buttons, and the database rejects it anyway.
  const usedLabels = new Set(types.map((t) => t.label.trim().toLowerCase()));
  const available = UNIT_TYPE_CHOICES.filter(
    (c) => !usedLabels.has(c.label.toLowerCase()),
  );

  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="me-auto">
          <h2 className="text-[13.5px] font-medium">Units &amp; floor plans</h2>
          <p className="text-[11.5px] text-bz-muted">
            One button per unit type on the project page; pressing it shows that
            type&apos;s layouts. The first {MAX_PLANS_SHOWN} layouts show —
            anything past that is kept but not displayed.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={pending || !dirty}
        >
          <Save size={13} strokeWidth={1.8} />
          {pending ? "Saving…" : "Save units"}
        </Button>
      </div>

      {types.length === 0 ? (
        <div className="rounded border border-dashed border-bz-border bg-bz-surface-2 p-4 flex flex-col gap-2.5 items-start">
          <p className="text-[12.5px] text-bz-ink-2 leading-relaxed">
            No unit types yet. The page is showing placeholders worked out from
            this project&apos;s bedrooms
            {bedroomsText ? (
              <>
                {" "}
                (<span className="mono text-bz-ink">{bedroomsText}</span>)
              </>
            ) : null}
            . Turn those into records you can edit, or start from an empty one.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onSeed} disabled={pending}>
              <Sparkles size={12} strokeWidth={1.8} />
              Add the suggested unit types
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addType(null, "")}
              disabled={pending}
            >
              <Plus size={12} strokeWidth={1.8} /> Add one by hand
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2.5">
        {types.map((type, i) => {
          const expanded = open === i;
          const shown = type.plans.filter((p) => p.enabled).length;
          return (
            <li
              key={type.id ?? `new-${i}`}
              className={cn(
                "rounded border border-bz-border bg-bz-surface-2",
                !type.enabled && "opacity-60",
              )}
            >
              <div className="flex items-center gap-1.5 px-2.5 py-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label={`Move ${type.label || "unit type"} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="h-3.5 text-bz-muted hover:text-bz-ink disabled:opacity-30 leading-none text-[10px]"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${type.label || "unit type"} down`}
                    disabled={i === types.length - 1}
                    onClick={() => move(i, 1)}
                    className="h-3.5 text-bz-muted hover:text-bz-ink disabled:opacity-30 leading-none text-[10px]"
                  >
                    ▼
                  </button>
                </div>
                <span className="mono text-[10.5px] text-bz-muted-2 w-4 text-center">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : i)}
                  className="flex-1 min-w-0 text-start"
                >
                  <span className="text-[13px] font-medium">
                    {type.label.trim() || "Untitled unit type"}
                  </span>
                  <span className="block text-[11px] text-bz-muted">
                    {type.plans.length} layout
                    {type.plans.length === 1 ? "" : "s"}
                    {shown !== type.plans.length ? ` · ${shown} shown` : ""}
                    {type.plans.length > MAX_PLANS_SHOWN
                      ? ` · only the first ${MAX_PLANS_SHOWN} appear`
                      : ""}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setType(i, { enabled: !type.enabled })}
                  aria-label={
                    type.enabled ? "Hide unit type" : "Show unit type"
                  }
                  title={
                    type.enabled
                      ? "Hide this unit type on the live page"
                      : "Show this unit type on the live page"
                  }
                  className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-ink"
                >
                  {type.enabled ? (
                    <Eye size={13} strokeWidth={1.7} />
                  ) : (
                    <EyeOff size={13} strokeWidth={1.7} />
                  )}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${type.label || "unit type"}`}
                  title={
                    type.plans.length > 0
                      ? `Removing this deletes its ${type.plans.length} layout${
                          type.plans.length === 1 ? "" : "s"
                        } too`
                      : "Remove this unit type"
                  }
                  onClick={() => {
                    update(types.filter((_, x) => x !== i));
                    setOpen(null);
                  }}
                  className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-[oklch(0.45_0.13_28)]"
                >
                  <Trash2 size={13} strokeWidth={1.7} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : i)}
                  aria-label={expanded ? "Collapse" : "Expand"}
                  className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-ink"
                >
                  <ChevronDown
                    size={14}
                    strokeWidth={1.7}
                    className={cn(
                      "transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
              </div>

              {expanded ? (
                <div className="border-t border-bz-border px-2.5 py-3 flex flex-col gap-3">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                    <div className="col-span-2 flex flex-col gap-1">
                      <Label htmlFor={`ut_label_${i}`} className="text-[11px]">
                        Button label
                      </Label>
                      <input
                        id={`ut_label_${i}`}
                        className={fieldCls}
                        value={type.label}
                        placeholder="2 Bedroom"
                        onChange={(e) => setType(i, { label: e.target.value })}
                      />
                      <ArabicTwin
                        field={{ key: "label_ar", label: "Unit type", kind: "text", max: 60 }}
                        value={type.label_ar ?? ""}
                        onChange={(v) => setType(i, { label_ar: v || null })}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`ut_beds_${i}`} className="text-[11px]">
                        Bedrooms
                      </Label>
                      {/* A number, not a dropdown of the counts we guessed at:
                          a project can sell an 8-bedroom villa, and 0 is a
                          studio. Blank means "doesn't map to a bedroom count"
                          — a penthouse or a duplex sold by name. */}
                      <input
                        id={`ut_beds_${i}`}
                        type="number"
                        min={0}
                        step={1}
                        className={fieldCls}
                        value={type.beds ?? ""}
                        placeholder="Not a bedroom count"
                        onChange={(e) =>
                          setType(i, { beds: numberOrNull(e.target.value) })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`ut_from_${i}`} className="text-[11px]">
                        Size from · ft²
                      </Label>
                      <input
                        id={`ut_from_${i}`}
                        type="number"
                        className={fieldCls}
                        value={type.size_from_ft2 ?? ""}
                        onChange={(e) =>
                          setType(i, {
                            size_from_ft2: numberOrNull(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`ut_to_${i}`} className="text-[11px]">
                        Size to · ft²
                      </Label>
                      <input
                        id={`ut_to_${i}`}
                        type="number"
                        className={fieldCls}
                        value={type.size_to_ft2 ?? ""}
                        onChange={(e) =>
                          setType(i, {
                            size_to_ft2: numberOrNull(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-2.5">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`ut_blurb_${i}`} className="text-[11px]">
                        Copy under the buttons
                      </Label>
                      <textarea
                        id={`ut_blurb_${i}`}
                        className={cn(fieldCls, "resize-y min-h-[60px]")}
                        value={type.blurb ?? ""}
                        placeholder="What sets this unit type apart."
                        onChange={(e) =>
                          setType(i, { blurb: e.target.value || null })
                        }
                      />
                      <ArabicTwin
                        field={{ key: "blurb_ar", label: "Blurb", kind: "textarea", max: 600 }}
                        value={type.blurb_ar ?? ""}
                        onChange={(v) => setType(i, { blurb_ar: v || null })}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`ut_price_${i}`} className="text-[11px]">
                        Price from · AED
                      </Label>
                      <input
                        id={`ut_price_${i}`}
                        type="number"
                        className={fieldCls}
                        value={type.price_from_aed ?? ""}
                        onChange={(e) =>
                          setType(i, {
                            price_from_aed: numberOrNull(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* ── Layouts ─────────────────────────────────────── */}
                  <div className="flex items-center gap-2 pt-1">
                    <h4 className="text-[12px] font-medium me-auto">Layouts</h4>
                    <span className="text-[11px] text-bz-muted">
                      {type.plans.length}/{MAX_PLANS_PER_TYPE}
                    </span>
                  </div>

                  <ul className="flex flex-col gap-2.5">
                    {type.plans.map((plan, j) => (
                      <li
                        key={plan.id ?? `new-${j}`}
                        className={cn(
                          "rounded border border-bz-border bg-bz-surface p-2.5 flex flex-col gap-2",
                          !plan.enabled && "opacity-60",
                          j >= MAX_PLANS_SHOWN &&
                            "border-dashed border-bz-muted-2",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="mono text-[10.5px] text-bz-muted-2 w-4">
                            {j + 1}
                          </span>
                          <input
                            className={cn(fieldCls, "flex-1")}
                            value={plan.label}
                            placeholder="Layout A"
                            onChange={(e) =>
                              setPlan(i, j, { label: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPlan(i, j, { enabled: !plan.enabled })
                            }
                            aria-label={
                              plan.enabled ? "Hide layout" : "Show layout"
                            }
                            className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-ink"
                          >
                            {plan.enabled ? (
                              <Eye size={12} strokeWidth={1.7} />
                            ) : (
                              <EyeOff size={12} strokeWidth={1.7} />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove layout ${j + 1}`}
                            onClick={() =>
                              setType(i, {
                                plans: type.plans.filter((_, y) => y !== j),
                              })
                            }
                            className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-[oklch(0.45_0.13_28)]"
                          >
                            <Trash2 size={12} strokeWidth={1.7} />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {/* No max on either: a layout carries as many beds
                              and baths as it carries. */}
                          <input
                            type="number"
                            min={0}
                            step={1}
                            className={fieldCls}
                            value={plan.beds ?? ""}
                            placeholder="Beds"
                            aria-label={`Layout ${j + 1} bedrooms`}
                            onChange={(e) =>
                              setPlan(i, j, { beds: numberOrNull(e.target.value) })
                            }
                          />
                          <input
                            type="number"
                            min={0}
                            step={1}
                            className={fieldCls}
                            value={plan.baths ?? ""}
                            placeholder="Baths"
                            aria-label={`Layout ${j + 1} bathrooms`}
                            onChange={(e) =>
                              setPlan(i, j, {
                                baths: numberOrNull(e.target.value),
                              })
                            }
                          />
                          <input
                            type="number"
                            className={fieldCls}
                            value={plan.area_ft2 ?? ""}
                            placeholder="ft²"
                            aria-label={`Layout ${j + 1} area in square feet`}
                            onChange={(e) =>
                              setPlan(i, j, {
                                area_ft2: numberOrNull(e.target.value),
                              })
                            }
                          />
                        </div>

                        <textarea
                          className={cn(fieldCls, "resize-y min-h-[48px]")}
                          value={plan.description ?? ""}
                          placeholder="How this layout differs from the others."
                          aria-label={`Layout ${j + 1} description`}
                          onChange={(e) =>
                            setPlan(i, j, {
                              description: e.target.value || null,
                            })
                          }
                        />
                        {/* Both layout twins live here, under the description.
                            The label's own input shares a flex row with the
                            delete button, and a second box in that strip would
                            squeeze the row it belongs to. */}
                        <ArabicTwin
                          field={{ key: "label_ar", label: "Layout name", kind: "text", max: 80 }}
                          value={plan.label_ar ?? ""}
                          onChange={(v) => setPlan(i, j, { label_ar: v || null })}
                        />
                        <ArabicTwin
                          field={{
                            key: "description_ar",
                            label: "Layout description",
                            kind: "textarea",
                            max: 600,
                          }}
                          value={plan.description_ar ?? ""}
                          onChange={(v) =>
                            setPlan(i, j, { description_ar: v || null })
                          }
                        />

                        <ImagePicker
                          label="Plan drawing"
                          value={plan.media_id}
                          media={media}
                          onChange={(id) => setPlan(i, j, { media_id: id })}
                          onUploaded={(m) => setMedia((cur) => [m, ...cur])}
                        />

                        {j >= MAX_PLANS_SHOWN ? (
                          <p className="text-[11px] text-bz-muted">
                            Saved, but not shown — the page displays the first{" "}
                            {MAX_PLANS_SHOWN}. Move it up to put it on the page.
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {type.plans.length < MAX_PLANS_PER_TYPE ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() =>
                        setType(i, {
                          plans: [
                            ...type.plans,
                            {
                              ...blankPlan(type.plans.length),
                              beds: type.beds,
                            },
                          ],
                        })
                      }
                    >
                      <Plus size={12} strokeWidth={1.8} /> Add layout
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {types.length > 0 && types.length < MAX_UNIT_TYPES ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] text-bz-muted">Add a unit type:</span>
          {available.map((c) => (
            <button
              key={c.beds}
              type="button"
              onClick={() => addType(c.beds, c.label)}
              className="h-[26px] px-2.5 rounded-full border border-bz-border bg-bz-surface-2 text-[11.5px] text-bz-ink-2 hover:border-bz-ink-2"
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => addType(null, "")}
            className="h-[26px] px-2.5 rounded-full border border-dashed border-bz-border text-[11.5px] text-bz-muted hover:text-bz-ink"
          >
            Something else
          </button>
        </div>
      ) : null}
    </section>
  );
}
