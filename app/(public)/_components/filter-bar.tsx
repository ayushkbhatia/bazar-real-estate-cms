"use client";

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
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<(typeof PROPERTY_TYPES)[number], string> = {
  apartment: "Apartment",
  villa: "Villa",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  commercial: "Commercial",
  land: "Land",
  hotel_apartment: "Hotel apartment",
  office: "Office",
  building: "Building",
  retail: "Retail",
  commercial_villa: "Commercial villa",
};

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
  const [{ q, beds, baths, type, price_min, price_max, area }, setState] =
    useQueryStates(filterParsers, {
      shallow: false, // re-fetch the RSC page on change
    });
  const [pending, startTransition] = useTransition();

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
        <span className="text-[11.5px] uppercase tracking-wider text-bz-muted mr-1">
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
              aria-label={n === 0 ? "Studio" : `${label} bed${n === 1 ? "" : "s"}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Baths */}
      <div className={cn("flex items-center gap-1", stacked && "flex-wrap")}>
        <span className="text-[11.5px] uppercase tracking-wider text-bz-muted mr-1">
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
              aria-label={`${label} bath${n === 1 ? "" : "s"}`}
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
          aria-label="Property type"
        >
          <SelectValue placeholder="Any type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>Any type</SelectItem>
          {PROPERTY_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {TYPE_LABELS[t]}
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
            aria-label="Area"
          >
            <SelectValue placeholder="Any area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET}>Any area</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.slug} value={a.slug}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {/* Price */}
      <div className={cn("flex items-center gap-1", stacked && "w-full")}>
        <span className="text-[11.5px] uppercase tracking-wider text-bz-muted mr-1">
          Price
        </span>
        <Input
          type="number"
          placeholder="Min AED"
          value={price_min ?? ""}
          min={0}
          step={10000}
          onChange={(e) =>
            commit({
              price_min: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className={cn("h-9 text-[13px]", stacked ? "flex-1" : "w-[140px]")}
        />
        <span className="text-bz-muted">–</span>
        <Input
          type="number"
          placeholder="Max AED"
          value={price_max ?? ""}
          min={0}
          step={10000}
          onChange={(e) =>
            commit({
              price_max: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className={cn("h-9 text-[13px]", stacked ? "flex-1" : "w-[140px]")}
        />
      </div>
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
          <span className="sr-only">Search</span>
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
          />
          <Input
            type="search"
            placeholder="Search Mamsha, Saadiyat, sea view…"
            value={qInput}
            onChange={(e) => onQChange(e.target.value)}
            className="w-full md:w-[260px] h-9 pl-8 text-[13px]"
            aria-label="Search properties"
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
          <div className="ml-auto flex items-center gap-2">{saveClear}</div>
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
        <div className="flex flex-col gap-5">
          {controls(true)}
        </div>
      </BottomSheet>
    </div>
  );
}
