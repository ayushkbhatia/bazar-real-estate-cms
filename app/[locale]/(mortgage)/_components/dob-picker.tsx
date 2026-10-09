"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  addDays,
  addMonths,
  defaultView,
  isoDate,
  monthGrid,
  monthOf,
  yearOptions,
} from "@/lib/mortgage-requests/calendar";
import { dubaiDateKey, dubaiDayStart } from "@/lib/mortgage-requests/dubai-time";
import { cn } from "@/lib/utils";

export type DobPickerLabels = {
  open: string;
  month: string;
  year: string;
  previous: string;
  next: string;
};

const MONTHS = Array.from({ length: 12 }, (_, m) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2001, m, 1))),
);
// 1 January 2001 was a Monday: seven days from it are the week, Monday first.
const WEEKDAYS = Array.from({ length: 7 }, (_, d) => {
  const at = new Date(Date.UTC(2001, 0, 1 + d));
  return {
    short: new Intl.DateTimeFormat("en-GB", { weekday: "narrow", timeZone: "UTC" }).format(at),
    long: new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(at),
  };
});
const DAY_LABEL = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return DAY_LABEL.format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * W2's date-of-birth calendar (Bazar, 9 Oct 2026): a button at the end of the
 * field opens a month view with month and year menus, so nobody has to type
 * the date. Typing still works; the field and the calendar are one value.
 *
 * The grid is a single tab stop (roving focus): arrows move a day or a week,
 * Page Up/Down a month, Home/End the week's ends, Enter or Space picks.
 * Today and later are disabled, as `dobRule` would refuse them.
 */
export function DobPicker({
  value,
  onPick,
  labels,
}: {
  /** The field's date as ISO ("1990-03-14"), or null while it isn't a date. */
  value: string | null;
  onPick: (iso: string) => void;
  labels: DobPickerLabels;
}) {
  const [open, setOpen] = useState(false);
  // Read when the calendar opens (an event, not a render), so a tab left open overnight still knows today.
  const [today, setToday] = useState(() => dubaiDateKey(dubaiDayStart(Date.now())));
  const [view, setView] = useState(() => monthOf(value) ?? defaultView(today));
  const [focus, setFocus] = useState<string | null>(value);
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  // Each opening starts from the field's date, or thirty years back.
  const onOpenChange = (next: boolean) => {
    if (next) {
      const now = dubaiDateKey(dubaiDayStart(Date.now()));
      setToday(now);
      const start = monthOf(value) ?? defaultView(now);
      setView(start);
      setFocus(value ?? isoDate(start.year, start.month, 1));
    }
    setOpen(next);
  };

  // Keyboard moves land focus on the new day, in whichever month it's in.
  useEffect(() => {
    if (!moved.current || !focus) return;
    moved.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${focus}"]`)?.focus();
  }, [focus, view]);

  const weeks = monthGrid(view.year, view.month, today);
  const inView = (iso: string | null) => !!iso && iso.startsWith(`${view.year}-${String(view.month + 1).padStart(2, "0")}-`);
  // The one tab stop: the focused day if it's on screen, else the chosen one, else the 1st.
  const tabStop = inView(focus) ? focus : inView(value) ? value : isoDate(view.year, view.month, 1);

  const shiftMonth = (by: number) => {
    const next = addMonths(isoDate(view.year, view.month, 1), by);
    setView({ year: Number(next.slice(0, 4)), month: Number(next.slice(5, 7)) - 1 });
  };

  const move = (to: string) => {
    // Disabled days can't take focus: stop at the ends of the range.
    if (to < "1900-01-01" || to >= today) return;
    moved.current = true;
    setFocus(to);
    setView({ year: Number(to.slice(0, 4)), month: Number(to.slice(5, 7)) - 1 });
  };

  const pick = (iso: string) => {
    onPick(iso);
    setOpen(false);
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = tabStop!;
    const weekday = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7;
    const keys: Record<string, () => string> = {
      ArrowLeft: () => addDays(from, -1),
      ArrowRight: () => addDays(from, 1),
      ArrowUp: () => addDays(from, -7),
      ArrowDown: () => addDays(from, 7),
      PageUp: () => addMonths(from, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(from, e.shiftKey ? 12 : 1),
      Home: () => addDays(from, -weekday),
      End: () => addDays(from, 6 - weekday),
    };
    const go = keys[e.key];
    if (!go) return;
    e.preventDefault();
    move(go());
  };

  const select = "h-9 rounded-md border border-bz-border bg-bz-surface px-2 text-[13px] text-bz-ink outline-none focus-visible:border-bz-ink-2";
  const nav =
    "inline-flex size-9 items-center justify-center rounded-md text-bz-ink-2 hover:bg-bz-surface-2 focus-visible:outline-2 focus-visible:outline-bz-ink-2";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={labels.open}
          title={labels.open}
          className="inline-flex size-10 items-center justify-center rounded-[8px] text-bz-ink-2 transition-colors hover:bg-bz-surface-2 hover:text-bz-ink focus-visible:outline-2 focus-visible:outline-bz-ink-2"
        >
          <CalendarDays size={18} strokeWidth={1.6} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[312px] gap-3 rounded-[12px] border border-bz-border bg-bz-surface p-3 text-bz-ink shadow-lg ring-0"
      >
        <div className="flex items-center gap-1.5">
          <button type="button" className={nav} aria-label={labels.previous} onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          <select
            aria-label={labels.month}
            className={cn(select, "min-w-0 flex-1")}
            value={view.month}
            onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value) }))}
          >
            {MONTHS.map((name, m) => (
              <option key={name} value={m}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label={labels.year}
            className={cn(select, "w-[84px]")}
            value={view.year}
            onChange={(e) => setView((v) => ({ ...v, year: Number(e.target.value) }))}
          >
            {yearOptions(today).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button type="button" className={nav} aria-label={labels.next} onClick={() => shiftMonth(1)}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>

        <div
          ref={grid}
          role="grid"
          aria-label={`${MONTHS[view.month]} ${view.year}`}
          onKeyDown={onGridKey}
          className="grid gap-0.5"
        >
          <div role="row" className="grid grid-cols-7">
            {WEEKDAYS.map((w) => (
              <span
                key={w.long}
                role="columnheader"
                aria-label={w.long}
                className="flex h-7 items-center justify-center text-[11px] font-medium text-bz-muted"
              >
                {w.short}
              </span>
            ))}
          </div>
          {weeks.map((week, i) => (
            <div key={i} role="row" className="grid grid-cols-7">
              {week.map((cell, j) =>
                cell ? (
                  <span key={cell.iso} role="gridcell" aria-selected={cell.iso === value}>
                    <button
                      type="button"
                      data-iso={cell.iso}
                      tabIndex={cell.iso === tabStop ? 0 : -1}
                      disabled={cell.disabled}
                      aria-label={dayLabel(cell.iso)}
                      aria-current={cell.iso === today ? "date" : undefined}
                      onClick={() => pick(cell.iso)}
                      onFocus={() => setFocus(cell.iso)}
                      className={cn(
                        "mx-auto flex size-9 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bz-ink-2",
                        cell.iso === value
                          ? "bg-bz-ink font-medium text-bz-bg"
                          : "text-bz-ink hover:bg-bz-surface-2",
                        cell.disabled && "cursor-not-allowed text-bz-muted-2 hover:bg-transparent",
                      )}
                    >
                      {cell.day}
                    </button>
                  </span>
                ) : (
                  <span key={`pad-${i}-${j}`} role="gridcell" aria-hidden />
                ),
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
