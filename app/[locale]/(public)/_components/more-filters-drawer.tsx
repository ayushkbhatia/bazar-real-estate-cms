"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { toOptions } from "@/lib/amenities";
import { SlidersHorizontal, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TENURES, FURNISHINGS } from "@/lib/filters/property";
import { PROPERTY_FORMS, PROPERTY_FORM_LABELS } from "@/lib/schemas/property";
import {
  areaUnitLabel,
  convertArea,
  toFt2,
  usePreferences,
  type AreaUnit,
} from "@/lib/preferences";

/**
 * Facet options come from the shared amenity taxonomy rather than a list
 * maintained here — the picker in the property editor and the public page read
 * the same source, so a filter can't drift out of step with what's selectable.
 *
 * `DEFAULT_AMENITIES` is the static seed: this is a client component, so it
 * can't read the table directly. Entries an admin adds under Settings → Fields
 * reach the editor and the property page immediately, and this facet on the
 * next deploy.
 */
const AMENITIES = toOptions().map((o) => o.label);

/**
 * The `ft2_min` / `ft2_max` query params are always ft² — a shared search URL
 * has to mean the same thing whatever unit the recipient prefers. These two
 * convert only at the input boundary, and round to whole units so a value
 * typed in m² doesn't come back as 114.99999.
 */
function ft2ParamToInput(raw: string, unit: AreaUnit): string {
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(convertArea(n, unit)));
}

function inputToFt2Param(raw: string, unit: AreaUnit): string {
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(toFt2(n, unit)));
}

/**
 * `showForm` is the completion-form facet — off-plan / ready (new) / resale.
 * It renders on /buy/search only: buy is the umbrella that spans all three
 * forms, so it is the one surface where narrowing on that axis means anything.
 * /buy/ready and /buy/resale have already narrowed it from the route, and a
 * tenancy has no completion form at all (the DB keeps the column NULL there).
 */
export function MoreFiltersDrawer({ showForm = false }: { showForm?: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  // Only the completion facet reads next-intl: the rest of this drawer is
  // still un-extracted English, and G-13's ratchet is shrink-only, so a new
  // literal would have to be paid for by removing an old one.
  const t = useTranslations("search");
  // The badge already has one rendering in `listing`; adding a second here
  // would give the same English two Arabics, which `messages.test.ts` refuses.
  const tl = useTranslations("listing");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const { prefs } = usePreferences();
  const unit = prefs.area_unit;

  const initial = {
    form: sp.get("form") ?? "",
    ft2_min: ft2ParamToInput(sp.get("ft2_min") ?? "", unit),
    ft2_max: ft2ParamToInput(sp.get("ft2_max") ?? "", unit),
    year_min: sp.get("year_min") ?? "",
    year_max: sp.get("year_max") ?? "",
    tenure: sp.get("tenure") ?? "",
    furnishing: sp.get("furnishing") ?? "",
    amenities: new Set(
      (sp.get("amenities") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    verified: sp.get("verified") === "true",
  };

  const [state, setState] = useState(initial);

  function toggleAmenity(name: string) {
    setState((s) => {
      const next = new Set(s.amenities);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { ...s, amenities: next };
    });
  }

  function apply() {
    const params = new URLSearchParams(sp.toString());
    function setOrDelete(k: string, v: string) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    setOrDelete("form", showForm ? state.form : "");
    setOrDelete("ft2_min", inputToFt2Param(state.ft2_min, unit));
    setOrDelete("ft2_max", inputToFt2Param(state.ft2_max, unit));
    setOrDelete("year_min", state.year_min);
    setOrDelete("year_max", state.year_max);
    setOrDelete("tenure", state.tenure);
    setOrDelete("furnishing", state.furnishing);
    setOrDelete("amenities", Array.from(state.amenities).join(","));
    if (state.verified) params.set("verified", "true");
    else params.delete("verified");
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `?${qs}` : window.location.pathname);
      setOpen(false);
    });
  }

  function reset() {
    setState({
      form: "",
      ft2_min: "",
      ft2_max: "",
      year_min: "",
      year_max: "",
      tenure: "",
      furnishing: "",
      amenities: new Set<string>(),
      verified: false,
    });
  }

  const activeCount =
    (showForm && state.form ? 1 : 0) +
    (state.ft2_min ? 1 : 0) +
    (state.ft2_max ? 1 : 0) +
    (state.year_min ? 1 : 0) +
    (state.year_max ? 1 : 0) +
    (state.tenure ? 1 : 0) +
    (state.furnishing ? 1 : 0) +
    state.amenities.size +
    (state.verified ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal size={13} strokeWidth={1.7} />
          More filters
          {activeCount > 0 ? (
            <span className="ms-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-bz-navy text-bz-bg text-[10px] font-medium">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("filters.moreFilters")}</SheetTitle>
        </SheetHeader>

        <div className="px-6 py-4 flex flex-col gap-6">
          {/* Area — labelled in the visitor's unit, stored as ft² */}
          <div>
            <Label>Area ({areaUnitLabel(unit)})</Label>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <Input
                type="number"
                placeholder="Min"
                value={state.ft2_min}
                onChange={(e) =>
                  setState((s) => ({ ...s, ft2_min: e.target.value }))
                }
              />
              <Input
                type="number"
                placeholder="Max"
                value={state.ft2_max}
                onChange={(e) =>
                  setState((s) => ({ ...s, ft2_max: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Year built */}
          <div>
            <Label>{t("filters.yearBuilt")}</Label>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <Input
                type="number"
                placeholder="From"
                value={state.year_min}
                onChange={(e) =>
                  setState((s) => ({ ...s, year_min: e.target.value }))
                }
              />
              <Input
                type="number"
                placeholder="To"
                value={state.year_max}
                onChange={(e) =>
                  setState((s) => ({ ...s, year_max: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Tenure */}
          <div>
            <Label htmlFor="tenure-pick">{t("filters.tenure")}</Label>
            <select
              id="tenure-pick"
              value={state.tenure}
              onChange={(e) =>
                setState((s) => ({ ...s, tenure: e.target.value }))
              }
              /* 16px until `md` here and on the two selects below: a native
                 select under 16px makes iOS Safari zoom the viewport as the
                 picker opens. This drawer is fixed-position, so it keeps its
                 pre-zoom box while the viewport shrinks around it and the
                 "Apply filters" footer ends up off-screen — the visitor picks
                 a tenure and then has nowhere to commit it. The `md:` half
                 keeps the 14px the drawer is drawn at. */
              className="mt-1.5 w-full h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[16px] md:text-[14px] focus:outline-none focus:border-bz-accent"
            >
              <option value="">Any</option>
              {TENURES.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Completion form — buy only, see the note on showForm */}
          {showForm ? (
            <div>
              <Label htmlFor="form-pick">{t("filters.completion")}</Label>
              <select
                id="form-pick"
                value={state.form}
                onChange={(e) =>
                  setState((s) => ({ ...s, form: e.target.value }))
                }
                className="mt-1.5 w-full h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[16px] md:text-[14px] focus:outline-none focus:border-bz-accent"
              >
                <option value="">Any</option>
                {PROPERTY_FORMS.map((f) => (
                  <option key={f} value={f}>
                    {PROPERTY_FORM_LABELS[f]}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[12px] text-bz-muted leading-relaxed">
                {t("filters.completionHelp")}
              </p>
            </div>
          ) : null}

          {/* Furnishing */}
          <div>
            <Label htmlFor="furnishing-pick">{t("filters.furnishing")}</Label>
            <select
              id="furnishing-pick"
              value={state.furnishing}
              onChange={(e) =>
                setState((s) => ({ ...s, furnishing: e.target.value }))
              }
              className="mt-1.5 w-full h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[16px] md:text-[14px] focus:outline-none focus:border-bz-accent"
            >
              <option value="">Any</option>
              {FURNISHINGS.map((f) => (
                <option key={f} value={f} className="capitalize">
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Verified */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.verified}
              onChange={(e) =>
                setState((s) => ({ ...s, verified: e.target.checked }))
              }
              className="mt-1"
            />
            <span>
              <span className="text-[14px] text-bz-ink">{tl("verified")}</span>
              <span className="block text-[12px] text-bz-muted mt-0.5 leading-relaxed">
                {t("filters.verifiedHelp")}
              </span>
            </span>
          </label>

          {/* Amenities */}
          <div>
            <Label>{t("filters.amenities")}</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AMENITIES.map((a) => {
                const active = state.amenities.has(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className={
                      active
                        ? "inline-flex items-center h-7 px-2.5 rounded-full bg-bz-navy text-bz-bg text-[11.5px]"
                        : "inline-flex items-center h-7 px-2.5 rounded-full border border-bz-border bg-bz-bg text-bz-ink-2 text-[11.5px] hover:border-bz-border-strong"
                    }
                  >
                    {a}
                    {active ? (
                      <X size={10} strokeWidth={2} className="ms-1" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-bz-border flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={reset}
            className="text-[13px] text-bz-muted hover:text-bz-ink"
          >
            Reset
          </button>
          <Button onClick={apply} disabled={pending}>
            {pending ? "Applying…" : "Apply filters"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
