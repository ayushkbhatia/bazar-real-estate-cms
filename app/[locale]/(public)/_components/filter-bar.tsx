"use client";

import { useTranslations } from "next-intl";

import { useRef, useState, useTransition } from "react";
import { useQueryStates } from "nuqs";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { BottomSheet } from "@/components/brand/mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PROPERTY_TYPES } from "@/lib/schemas/property";
import { filterParsers } from "@/lib/filters/property";
import {
  currencySymbol,
  inputToPriceParam,
  priceParamToInput,
  usePreferences,
  type Currency,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

// T2-A — beds/baths chips. Studio (0) anchors the left side; "+" caps stay
// at 5 (beds) and 4 (baths) to match the `lib/queries/properties.ts` `>=`
// semantics (that file is locked, so we don't push the cap upward here).
// Lifting the cap to 6/5 is a follow-up that needs the query to teach
// `beds=6 → gte 6` distinct from `beds=5 → gte 5`.
const BED_OPTIONS = [0, 1, 2, 3, 4, 5] as const;
const BATH_OPTIONS = [1, 2, 3, 4] as const;

function bedLabel(n: number): string {
  if (n === 0) return "Studio";
  if (n === 5) return "5+";
  return String(n);
}

function bathLabel(n: number): string {
  if (n === 4) return "4+";
  return String(n);
}
const UNSET = "__unset__";

export type AreaOption = { slug: string; name: string };

type Props = {
  /**
   * Retained so every call site keeps its existing shape; the bar no longer
   * varies by mode now that "Save search" is gone.
   */
  mode?: "buy" | "rent" | "off_plan" | "commercial";
  areas: AreaOption[];
};

export function FilterBar({ areas }: Props) {
  const tr = useTranslations("search");
  const [{ q, beds, baths, type, price_min, price_max, area }, setState] =
    useQueryStates(filterParsers, {
      shallow: false, // re-fetch the RSC page on change
    });
  const { prefs } = usePreferences();
  const [pending, startTransition] = useTransition();
  // Bumped by Clear all, to force the price boxes to re-seed. See the `key`
  // on PriceRangeInputs below.
  const [clearToken, setClearToken] = useState(0);

  // Local search-input state — debounced so we don't fire a page reload per
  // keystroke. Browser Back/Forward will leave the input value stale until
  // the user retypes or clicks Clear — the trade-off is to avoid the
  // setState-in-effect anti-pattern flagged by the React Compiler lint.
  const [qInput, setQInput] = useState(q ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onQChange(value: string) {
    setQInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        void setState({ q: value.trim() === "" ? null : value.trim() });
      });
    }, 250);
  }

  const activeCount = [q, beds, baths, type, price_min, price_max, area].filter(
    (v) => v !== null && v !== undefined && v !== "",
  ).length;

  function commit(patch: Parameters<typeof setState>[0]) {
    startTransition(() => {
      void setState(patch);
    });
  }

  function clearAll() {
    setQInput("");
    setClearToken((n) => n + 1);
    startTransition(() => {
      void setState({
        q: null,
        beds: null,
        baths: null,
        type: null,
        price_min: null,
        price_max: null,
        area: null,
      });
    });
  }

  // Shared filter controls — rendered inline in the desktop bar and
  // stacked inside the mobile filter sheet. `stacked` widens inputs to
  // full width so they read as a vertical form on mobile.
  const controls = (stacked: boolean) => (
    <>
      {/* Beds */}
      <div className={cn("flex items-center gap-1", stacked && "flex-wrap")}>
        <span className="text-[11.5px] uppercase tracking-wider text-bz-muted me-1">
          Beds
        </span>
        {BED_OPTIONS.map((n) => {
          const active = beds === n;
          const label = bedLabel(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => commit({ beds: active ? null : n })}
              className={cn(
                "h-9 px-2.5 rounded text-[12.5px] font-medium border transition-colors",
                n === 0 ? "min-w-[58px]" : "min-w-[40px]",
                active
                  ? "bg-bz-navy text-bz-bg border-bz-navy"
                  : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
              )}
              aria-pressed={active}
              aria-label={tr("filters.bedsFilter", { count: n })}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Baths */}
      <div className={cn("flex items-center gap-1", stacked && "flex-wrap")}>
        <span className="text-[11.5px] uppercase tracking-wider text-bz-muted me-1">
          Baths
        </span>
        {BATH_OPTIONS.map((n) => {
          const active = baths === n;
          const label = bathLabel(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => commit({ baths: active ? null : n })}
              className={cn(
                "h-9 min-w-[40px] px-2 rounded text-[12.5px] font-medium border transition-colors",
                active
                  ? "bg-bz-navy text-bz-bg border-bz-navy"
                  : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
              )}
              aria-pressed={active}
              aria-label={tr("filters.bathsFilter", { count: n })}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Type */}
      <Select
        value={type ?? UNSET}
        onValueChange={(v) =>
          commit({ type: v === UNSET ? null : (v as typeof type) })
        }
      >
        <SelectTrigger
          className={cn("h-9 text-[13px]", stacked ? "w-full" : "w-[160px]")}
          aria-label={tr("filters.propertyType")}
        >
          <SelectValue placeholder={tr("filters.anyType")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>{tr("filters.anyType")}</SelectItem>
          {PROPERTY_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {tr(`type.${t}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Area */}
      {areas.length > 0 ? (
        <Select
          value={area ?? UNSET}
          onValueChange={(v) => commit({ area: v === UNSET ? null : v })}
        >
          <SelectTrigger
            className={cn("h-9 text-[13px]", stacked ? "w-full" : "w-[200px]")}
            aria-label={tr("filters.area")}
          >
            <SelectValue placeholder={tr("filters.anyArea")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>{tr("filters.anyArea")}</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.slug} value={a.slug}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {/* Price */}
      <PriceRangeInputs
        // Remounting is how the boxes re-seed: on a currency switch, and on
        // Clear all. Both change what the input should read, and neither is a
        // keystroke, so a fresh mount beats reconciling state mid-edit.
        key={`${prefs.currency}:${clearToken}`}
        currency={prefs.currency}
        priceMin={price_min}
        priceMax={price_max}
        stacked={stacked}
        onCommit={commit}
      />
    </>
  );

  const saveClear =
    activeCount > 0 ? (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          <X size={12} strokeWidth={1.8} />
          Clear {activeCount}
        </Button>
      </>
    ) : null;

  return (
    <div
      className={cn(
        "sticky top-0 z-20 bg-bz-bg border-b border-bz-border",
        "px-4 md:px-12 py-3 md:py-4",
        pending && "opacity-90",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Free-text search — full width on mobile, fixed on desktop */}
        <label className="relative flex-1 md:flex-none min-w-0">
          <span className="sr-only">{tr("filters.search")}</span>
          <Search
            size={14}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
          />
          <Input
            type="search"
            placeholder={tr("filters.searchPlaceholder")}
            value={qInput}
            onChange={(e) => onQChange(e.target.value)}
            className="w-full md:w-[260px] h-9 ps-8 text-[13px]"
            aria-label={tr("filters.searchProperties")}
          />
        </label>

        {/* Mobile: open the filter sheet */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSheetOpen(true)}
          className="md:hidden shrink-0 text-[12.5px]"
        >
          <SlidersHorizontal size={13} strokeWidth={1.8} />
          Filters{activeCount > 0 ? ` · ${activeCount}` : ""}
        </Button>

        {/* Desktop inline controls */}
        <div className="hidden md:flex md:flex-1 md:flex-wrap md:items-center md:gap-3">
          {controls(false)}
          <div className="ms-auto flex items-center gap-2">{saveClear}</div>
        </div>
      </div>

      {/* Mobile filter sheet */}
      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Filters"
        footer={
          <>
            {activeCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={clearAll}
                className="flex-1"
              >
                Clear {activeCount}
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="flex-1"
            >
              Show results
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">{controls(true)}</div>
      </BottomSheet>
    </div>
  );
}

/**
 * The price bounds, typed in whatever currency the visitor picked.
 *
 * `price_min` / `price_max` stay AED in the URL — a shared search link has to
 * mean the same thing to both parties, and `lib/queries/properties.ts` reads
 * them as AED. So the conversion happens only here, at the boundary, exactly
 * as `more-filters-drawer.tsx` does for ft².
 *
 * The typed value lives in local state and commits on a debounce, rather than
 * being derived from the URL each keystroke: round-tripping a half-typed
 * number through two conversions and a router push makes the box fight the
 * typist. Same reasoning as `qInput` above.
 *
 * Nothing here writes a param the visitor did not touch. That matters —
 * USD → AED → USD is exact, but AED → USD → AED can shift by up to 2 AED, so
 * pushing an untouched bound back through the converters would quietly edit
 * someone else's shared search.
 */
function PriceRangeInputs({
  currency,
  priceMin,
  priceMax,
  stacked,
  onCommit,
}: {
  currency: Currency;
  priceMin: number | null;
  priceMax: number | null;
  stacked: boolean;
  onCommit: (patch: {
    price_min?: number | null;
    price_max?: number | null;
  }) => void;
}) {
  const seed = (n: number | null) =>
    n == null ? "" : priceParamToInput(String(n), currency);
  const [minInput, setMinInput] = useState(() => seed(priceMin));
  const [maxInput, setMaxInput] = useState(() => seed(priceMax));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(which: "price_min" | "price_max", raw: string) {
    if (which === "price_min") setMinInput(raw);
    else setMaxInput(raw);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const param = inputToPriceParam(raw.trim(), currency);
      onCommit({ [which]: param === "" ? null : Number(param) });
    }, 300);
  }

  const symbol = currencySymbol(currency);

  return (
    <div className={cn("flex items-center gap-1", stacked && "w-full")}>
      <span className="text-[11.5px] uppercase tracking-wider text-bz-muted me-1">
        Price
      </span>
      <Input
        type="number"
        placeholder={`Min ${symbol}`}
        aria-label={`Minimum price in ${currency}`}
        value={minInput}
        min={0}
        step={10000}
        onChange={(e) => onChange("price_min", e.target.value)}
        className={cn("h-9 text-[13px]", stacked ? "flex-1" : "w-[140px]")}
      />
      <span className="text-bz-muted">–</span>
      <Input
        type="number"
        placeholder={`Max ${symbol}`}
        aria-label={`Maximum price in ${currency}`}
        value={maxInput}
        min={0}
        step={10000}
        onChange={(e) => onChange("price_max", e.target.value)}
        className={cn("h-9 text-[13px]", stacked ? "flex-1" : "w-[140px]")}
      />
    </div>
  );
}
