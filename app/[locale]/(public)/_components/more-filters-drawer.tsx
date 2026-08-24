"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { PROPERTY_FORMS } from "@/lib/schemas/property";
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
 *
 * The whole option is kept rather than just the label, because the two halves
 * do different jobs: `label` is the VALUE — it is what `properties.amenities`
 * stores and what `?amenities=` carries, so it must stay English on every
 * locale or the facet matches nothing — while `label_ar` is only what the chip
 * says. Folding them together is the bug this shape exists to prevent.
 */
const AMENITIES = toOptions();

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
  const t = useTranslations("search");
  const locale = useLocale();
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
          {t("filters.moreFilters")}
          {activeCount > 0 ? (
            <span className="ms-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-bz-navy text-bz-bg text-[10px] font-medium">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      {/* `side` is a PROP, which is why a hardcoded physical value survived the
          repo-wide physical→logical conversion: G-5 in
          `lib/rtl/no-physical-utilities.test.ts` reads className strings and
          there is no physical utility here to find. The primitive compiled the
          old value to `right-0` + `border-l` + `slide-in-from-right`, so under
          /ar this drawer flew in from the physical right while the trigger that
          opened it sat on the left. `side="end"` is the logical variant
          `sheet.tsx` grew for exactly this; the allowlist entry that waived
          this file is gone with it.

          The width override is `data-[side=end]:`-qualified rather than a bare
          `w-full` for the reason the primitive documents: its own
          `data-[side=end]:w-3/4` is (0,2,0) and beats a plain class, so a bare
          `w-full` would lose and the panel would keep showing the page beside
          it. Which is also what the `w-[420px]` this replaces was doing —
          nothing. Above `sm` the primitive's `data-[side=end]:sm:max-w-sm`
          caps the panel at 384px either way, so only the phone changes. */}
      <SheetContent side="end" className="data-[side=end]:w-full">
        <SheetHeader>
          <SheetTitle>{t("filters.moreFilters")}</SheetTitle>
        </SheetHeader>

        {/* The scroll moved off the panel and onto this column so the footer
            below can stay pinned: with `overflow-y-auto` on the SheetContent
            itself, "Apply filters" scrolled away with the fields and the only
            way back to it was to scroll the whole drawer down again. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-6">
          {/* Area — labelled in the visitor's unit, stored as ft² */}
          <div>
            <Label>
              {t("filters.areaWithUnit", { unit: areaUnitLabel(unit) })}
            </Label>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <Input
                type="number"
                placeholder={t("filters.min")}
                value={state.ft2_min}
                onChange={(e) =>
                  setState((s) => ({ ...s, ft2_min: e.target.value }))
                }
              />
              <Input
                type="number"
                placeholder={t("filters.max")}
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
                placeholder={t("filters.from")}
                value={state.year_min}
                onChange={(e) =>
                  setState((s) => ({ ...s, year_min: e.target.value }))
                }
              />
              <Input
                type="number"
                placeholder={t("filters.to")}
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
              <option value="">{t("filters.any")}</option>
              {/* `t` is the translator in this scope, so the option variable
                  is named `tenure` rather than shadowing it. */}
              {TENURES.map((tenure) => (
                <option key={tenure} value={tenure}>
                  {t(`tenureOption.${tenure}`)}
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
                <option value="">{t("filters.any")}</option>
                {PROPERTY_FORMS.map((f) => (
                  <option key={f} value={f}>
                    {t(`formOption.${f}`)}
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
              <option value="">{t("filters.any")}</option>
              {FURNISHINGS.map((f) => (
                <option key={f} value={f}>
                  {t(`furnishingOption.${f}`)}
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
                const active = state.amenities.has(a.label);
                // Falls back to the English rather than dropping the chip: an
                // amenity with no Arabic yet is a filter you can still use.
                const shown =
                  locale === "ar" ? (a.label_ar ?? a.label) : a.label;
                return (
                  <button
                    key={a.code}
                    type="button"
                    onClick={() => toggleAmenity(a.label)}
                    className={
                      active
                        ? "inline-flex items-center h-7 px-2.5 rounded-full bg-bz-navy text-bz-bg text-[11.5px]"
                        : "inline-flex items-center h-7 px-2.5 rounded-full border border-bz-border bg-bz-bg text-bz-ink-2 text-[11.5px] hover:border-bz-border-strong"
                    }
                  >
                    {shown}
                    {active ? (
                      <X size={10} strokeWidth={2} className="ms-1" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pinned, and clear of the home indicator. The panel is `inset-y-0`
            and the page sets viewport-fit=cover, so a plain `py-4` put "Apply
            filters" inside the iOS gesture strip. `calc(env + 1rem)` rather
            than `pb-bar-safe`: this drawer is not mobile-only, and
            `--bz-safe-bottom` is 0px wherever there is no inset, so the
            desktop panel keeps the 16px it has today (`pb-bar-safe` carries an
            18px design floor and would move it). Same reasoning, same shape as
            `tools/compare/_components/picker-drawer.tsx`. */}
        <div className="shrink-0 px-6 pt-4 pb-[calc(var(--bz-safe-bottom)+1rem)] border-t border-bz-border flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={reset}
            className="text-[13px] text-bz-muted hover:text-bz-ink"
          >
            {t("filters.reset")}
          </button>
          <Button onClick={apply} disabled={pending}>
            {pending ? t("filters.applying") : t("filters.apply")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
