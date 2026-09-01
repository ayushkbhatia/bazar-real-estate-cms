"use client";

import { useTransition } from "react";
import { useQueryStates } from "nuqs";
import { filterParsers, type PropertyFilters } from "@/lib/filters/property";
import { cn } from "@/lib/utils";

/**
 * The shared toggle strip above the search results.
 *
 * Two of these render side by side, over the two axes the route does NOT
 * already fix: what kind of building it is (residential / commercial) and,
 * where it means anything, how the sale is coming to market (off-plan / ready
 * / resale). They narrow independently and compose — commercial resale is a
 * real thing to look for, and before this the visitor could express only one
 * half of it.
 *
 * One component rather than two near-identical ones, because the two strips
 * have to behave the same way to read as one control surface: same pressed
 * treatment, same clear-by-pressing-again, same page reset. Two copies would
 * have drifted at the first change to either.
 *
 * TOGGLE BUTTONS, NOT RADIOS. A radio group cannot be un-chosen, and "neither"
 * is a real state here — it is what an unfiltered search shows, and it has to
 * be reachable by clicking, not only by arriving with a clean URL.
 * `aria-pressed` is the ARIA for exactly that.
 */
export function FilterToggleGroup<
  K extends "segment" | "form",
>({
  param,
  label,
  options,
  optionLabel,
}: {
  /** The querystring key this strip owns. */
  param: K;
  /** Group label for assistive technology. */
  label: string;
  options: readonly NonNullable<PropertyFilters[K]>[];
  optionLabel: (value: NonNullable<PropertyFilters[K]>) => string;
}) {
  const [state, setState] = useQueryStates(filterParsers, {
    shallow: false, // re-fetch the RSC page on change
  });
  const [pending, startTransition] = useTransition();
  const current = state[param];

  function toggle(value: NonNullable<PropertyFilters[K]>) {
    startTransition(() => {
      // `page: null` because narrowing the results invalidates the offset —
      // filtering while on page 3 of the wider set would land on an empty page
      // that reads as an empty catalogue.
      void setState({
        [param]: current === value ? null : value,
        page: null,
      });
    });
  }

  return (
    <div
      role="group"
      aria-label={label}
      aria-busy={pending || undefined}
      className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5"
    >
      {options.map((value) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(value)}
            className={cn(
              // 44px tall on a phone, 32px from `md` up. Hand-rolled
              // <button>s, so the `(pointer: coarse)` floor in globals.css
              // cannot reach them and the height is set here.
              "h-11 px-3.5 md:h-8 md:px-3 rounded text-[12.5px] transition-colors",
              active
                ? "bg-bz-navy text-bz-bg font-medium"
                : "text-bz-ink-2 hover:text-bz-ink",
            )}
          >
            {optionLabel(value)}
          </button>
        );
      })}
    </div>
  );
}
