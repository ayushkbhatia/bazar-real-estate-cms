"use client";

import { useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, ChevronsUpDown, ExternalLink, Search, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SeedItem } from "./types";

/**
 * A record select that shows what each record IS.
 *
 * The plain `<select>` it replaces could print one line of text per option,
 * and for listings that line was the title — which three live listings share
 * word for word ("Yas Riva Reserve", all on Yas Island). The reference that
 * tells them apart was the value being stored and was never on screen, so an
 * editor picked between identical rows and found out which listing they had
 * in the preview.
 *
 * So each option draws the photo, the reference, the facts an advisor would
 * use to tell two listings apart (beds, baths, size), the price and whether it
 * is for sale or rent, and a search box matches on all of it — a reference,
 * "5 bed", "yas villa" or "13.3m" all narrow the list.
 *
 * A listbox in a popover rather than a native select, because a native option
 * can hold only text. Keyboard: arrows move, Enter picks, Escape closes; the
 * search box keeps focus throughout, which is the ARIA combobox pattern.
 */

/** Rendered at once. Past this the editor narrows by typing. */
const MAX_SHOWN = 60;

function haystack(item: SeedItem): string {
  const d = item.detail;
  return [
    item.name,
    item.slug,
    d?.code,
    d?.sub,
    ...(d?.facts ?? []),
    d?.price,
    d?.badge,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/,/g, "");
}

/**
 * Options matching every word of `query`, in their original order.
 *
 * Every word, not the whole phrase: "yas 5 bed" should find the five-bedroom
 * villa on Yas whichever order the facts happen to be written in. Commas are
 * dropped on both sides so "5942" finds "5,942 ft²".
 *
 * Numbers are matched against whole figures, not anywhere in the text. As a
 * plain substring "5" is in "6,555 ft²" and in "AED 14.5M", so "5 bed" found
 * every villa on the list — exactly the ambiguity this picker exists to end.
 * So a one- or two-digit number must BE a figure ("5" in "5 bed"), and a
 * longer one must start one ("594" → "5,942", "01445" → "BAZ-AD-01445").
 */
export function filterRecordOptions(
  options: SeedItem[],
  query: string,
): SeedItem[] {
  const words = query.toLowerCase().replace(/,/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((o) => {
    const hay = haystack(o);
    const tokens = hay.split(/[\s·\-/]+/).filter(Boolean);
    return words.every((w) => {
      if (!/^\d+$/.test(w)) return hay.includes(w);
      return w.length <= 2
        ? tokens.includes(w)
        : tokens.some((t) => t.startsWith(w));
    });
  });
}

export function RecordPicker({
  options,
  value,
  onChange,
  label,
  placeholder,
  taken,
  noun = "record",
}: {
  options: SeedItem[];
  /** The stored value — a reference or a slug. Empty when nothing is picked. */
  value: string;
  onChange: (value: string | null) => void;
  /** The field's label, for the accessible names. */
  label: string;
  placeholder?: string;
  /**
   * Values already picked elsewhere in the same list. Offered but disabled,
   * so a listing can't be added to a rail twice by accident.
   */
  taken?: readonly string[];
  /** What one option is, for the empty and search states: "listing". */
  noun?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;

  const picked = options.find((o) => o.slug === value) ?? null;
  const missing = value !== "" && picked === null;
  const takenSet = useMemo(() => new Set(taken ?? []), [taken]);

  const matches = useMemo(
    () => filterRecordOptions(options, query),
    [options, query],
  );
  const shown = matches.slice(0, MAX_SHOWN);

  const selectable = (i: number) => {
    const o = shown[i];
    return o !== undefined && (!takenSet.has(o.slug) || o.slug === value);
  };

  function moveTo(i: number) {
    setActive(i);
    // The active row follows the keyboard even when it has scrolled out of
    // the list's own viewport.
    listRef.current
      ?.querySelector(`[data-index="${i}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function step(from: number, delta: number) {
    if (shown.length === 0) return;
    let i = from;
    for (let n = 0; n < shown.length; n++) {
      i = (i + delta + shown.length) % shown.length;
      if (selectable(i)) return moveTo(i);
    }
  }

  function choose(item: SeedItem) {
    if (takenSet.has(item.slug) && item.slug !== value) return;
    onChange(item.slug);
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Open on the current pick, so the editor sees where they are.
      setQuery("");
      const at = options.findIndex((o) => o.slug === value);
      setActive(at >= 0 && at < MAX_SHOWN ? at : 0);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      step(active, 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      step(active, -1);
    } else if (e.key === "Home") {
      e.preventDefault();
      step(-1, 1);
    } else if (e.key === "End") {
      e.preventDefault();
      step(shown.length, -1);
    } else if (e.key === "Enter") {
      // Inside a form, an unguarded Enter would submit the whole page.
      e.preventDefault();
      const item = shown[active];
      if (item) choose(item);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-stretch gap-1.5">
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-label={
                picked
                  ? `${label}: ${picked.name}${picked.detail?.code ? `, ${picked.detail.code}` : ""}. Change`
                  : `${label}: ${placeholder ?? "choose one"}`
              }
              className={cn(
                "flex-1 min-w-0 flex items-center gap-2.5 rounded border border-bz-border bg-bz-bg px-2 py-1.5 text-start outline-none focus-visible:border-bz-accent hover:border-bz-muted-2",
                missing && "border-[oklch(0.8_0.1_28)]",
              )}
            >
              {picked ? (
                <OptionBody item={picked} />
              ) : missing ? (
                <span className="flex-1 min-w-0 text-[12.5px]">
                  <span className="mono">{value}</span>{" "}
                  <span className="text-[oklch(0.45_0.13_28)]">
                    (no longer available)
                  </span>
                </span>
              ) : (
                <span className="flex-1 text-[12.5px] text-bz-muted py-1">
                  {placeholder ?? "Choose one"}
                </span>
              )}
              <ChevronsUpDown
                size={13}
                strokeWidth={1.7}
                className="shrink-0 text-bz-muted"
                aria-hidden
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[max(var(--radix-popover-trigger-width),20rem)] max-w-[calc(100vw-2rem)] p-0 gap-0"
            onOpenAutoFocus={(e) => {
              // Focus the search box, not the first focusable row.
              e.preventDefault();
              (e.currentTarget as HTMLElement)
                .querySelector<HTMLInputElement>("input")
                ?.focus();
            }}
          >
            <div className="flex items-center gap-2 border-b border-bz-border px-2.5">
              <Search size={13} strokeWidth={1.7} className="text-bz-muted shrink-0" aria-hidden />
              <input
                type="search"
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={
                  shown[active] ? `${baseId}-opt-${active}` : undefined
                }
                aria-label={`Search ${noun}s`}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                  if (listRef.current) listRef.current.scrollTop = 0;
                }}
                onKeyDown={onKeyDown}
                placeholder={`Search by name, reference, area, beds, price…`}
                className="flex-1 min-w-0 h-10 bg-transparent text-[12.5px] outline-none"
              />
            </div>
            <ul
              id={listId}
              ref={listRef}
              role="listbox"
              aria-label={label}
              className="max-h-[min(360px,60dvh)] overflow-y-auto overscroll-contain py-1"
            >
              {shown.length === 0 ? (
                <li className="px-3 py-4 text-[12px] text-bz-muted">
                  No {noun} matches &ldquo;{query.trim()}&rdquo;.
                </li>
              ) : (
                shown.map((o, i) => {
                  const isPicked = o.slug === value;
                  const isTaken = takenSet.has(o.slug) && !isPicked;
                  return (
                    <li
                      key={o.slug}
                      id={`${baseId}-opt-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={isPicked}
                      aria-disabled={isTaken || undefined}
                      onMouseMove={() => {
                        if (!isTaken && active !== i) setActive(i);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(o)}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 cursor-pointer",
                        i === active && !isTaken && "bg-bz-surface-2",
                        isTaken && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <OptionBody item={o} />
                      {isPicked ? (
                        <Check size={14} strokeWidth={2} className="shrink-0 text-bz-teal" aria-hidden />
                      ) : isTaken ? (
                        <span className="shrink-0 text-[10.5px] text-bz-muted">
                          Already added
                        </span>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
            <div className="border-t border-bz-border px-2.5 py-1.5 text-[10.5px] text-bz-muted">
              {matches.length > shown.length
                ? `Showing ${shown.length} of ${matches.length} — keep typing to narrow.`
                : `${matches.length} of ${options.length} ${noun}${options.length === 1 ? "" : "s"}`}
            </div>
          </PopoverContent>
        </Popover>
        {value !== "" ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Clear ${label}`}
            title="Clear"
            className="shrink-0 w-11 md:w-8 inline-flex items-center justify-center rounded border border-bz-border text-bz-muted hover:text-bz-ink"
          >
            <X size={13} strokeWidth={1.7} />
          </button>
        ) : null}
      </div>
      {picked?.detail?.href ? (
        <a
          href={picked.detail.href}
          target="_blank"
          rel="noreferrer"
          className="self-start inline-flex items-center gap-1 text-[11px] text-bz-muted hover:text-bz-ink"
        >
          <ExternalLink size={11} strokeWidth={1.7} /> Open the live page
        </a>
      ) : null}
      {missing ? (
        <span className="text-[11px] text-[oklch(0.45_0.13_28)]">
          This record isn&apos;t published any more — it won&apos;t appear on
          the page.
        </span>
      ) : null}
    </div>
  );
}

/** The photo and the lines — shared by the trigger and every row. */
function OptionBody({ item }: { item: SeedItem }) {
  const d = item.detail;
  const facts = d?.facts ?? [];
  return (
    <span className="flex-1 min-w-0 flex items-center gap-2.5">
      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded bg-bz-surface-2 border border-bz-border">
        {d?.thumb ? (
          <Image
            src={d.thumb}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
          />
        ) : null}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="truncate text-[12.5px] font-medium text-bz-ink">
            {item.name}
          </span>
          {d?.badge ? (
            <span className="shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full bg-bz-surface-2 border border-bz-border text-[10px] text-bz-ink-2">
              {d.badge}
            </span>
          ) : null}
        </span>
        {d?.code || d?.sub ? (
          <span className="block truncate text-[11px] text-bz-muted">
            {d.code ? <span className="mono text-bz-ink-2">{d.code}</span> : null}
            {d.code && d.sub ? " · " : null}
            {d.sub}
          </span>
        ) : null}
        {facts.length > 0 || d?.price ? (
          <span className="flex items-baseline gap-2 min-w-0 text-[11px] text-bz-muted">
            {facts.length > 0 ? (
              <span className="truncate">{facts.join(" · ")}</span>
            ) : null}
            {d?.price ? (
              <span className="ms-auto shrink-0 mono text-[11px] text-bz-ink">
                {d.price}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </span>
  );
}
