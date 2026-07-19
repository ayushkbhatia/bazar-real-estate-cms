"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { propertyUrl } from "@/lib/queries/property-utils";
import type { Database } from "@/db/types";

type Status = Database["public"]["Enums"]["viewing_status"];

type Viewing = {
  id: string;
  starts_at: string;
  status: Status;
  properties: { reference: string; slug: string; title: string } | null;
};

/**
 * Sprint 6 (backfilled): month-grid calendar view for /account/viewings.
 * Pure-React + Tailwind, no extra deps. Days with viewings get a moss
 * dot; clicking opens the property detail (or a stack popover when
 * multiple viewings share a day).
 */
export function ViewingsCalendarView({
  viewings,
}: {
  viewings: Viewing[];
}) {
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const monthLabel = cursor.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  // Pad to start on Monday (UK/UAE convention).
  const firstDay = cursor.getDay(); // 0 = Sunday
  const padDays = (firstDay + 6) % 7;
  const daysInMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0,
  ).getDate();

  // Group viewings by yyyy-mm-dd.
  const byDate = new Map<string, Viewing[]>();
  for (const v of viewings) {
    const d = new Date(v.starts_at);
    if (
      d.getMonth() !== cursor.getMonth() ||
      d.getFullYear() !== cursor.getFullYear()
    ) {
      continue;
    }
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const arr = byDate.get(key) ?? [];
    arr.push(v);
    byDate.set(key, arr);
  }

  const cells: ({ day: number; date: Date; viewings: Viewing[] } | null)[] = [];
  for (let i = 0; i < padDays; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    cells.push({ day: d, date, viewings: byDate.get(key) ?? [] });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  function prev() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }
  function next() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface">
      <div className="flex items-center justify-between px-5 py-3 border-b border-bz-border">
        <h3
          className="serif text-[18px] leading-none"
          style={{ letterSpacing: "-0.012em" }}
        >
          {monthLabel}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous month"
            className="w-8 h-8 rounded-md text-bz-muted hover:bg-bz-bg flex items-center justify-center"
          >
            <ChevronLeft size={14} strokeWidth={1.7} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next month"
            className="w-8 h-8 rounded-md text-bz-muted hover:bg-bz-bg flex items-center justify-center"
          >
            <ChevronRight size={14} strokeWidth={1.7} />
          </button>
        </div>
      </div>
      {/* On mobile the 7-col month grid would crush cells to ~50px;
          scroll it horizontally (cells stay legible) and reset at md. */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <div className="min-w-[620px] md:min-w-0">
      <div className="grid grid-cols-7 text-[10.5px] uppercase tracking-widest text-bz-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center border-b border-bz-border"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, i) => (
          <div
            key={i}
            className={cn(
              "min-h-[88px] p-2 border-b border-r border-bz-border last:border-r-0",
              i >= cells.length - 7 ? "border-b-0" : "",
              c?.date.toDateString() === new Date().toDateString()
                ? "bg-bz-accent-soft/40"
                : "",
            )}
          >
            {c ? (
              <>
                <div className="text-[11.5px] text-bz-muted mono">
                  {c.day}
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {c.viewings.map((v) => (
                    <Link
                      key={v.id}
                      href={
                        v.properties
                          ? propertyUrl({
                              slug: v.properties.slug,
                              reference: v.properties.reference,
                            })
                          : "/account/viewings"
                      }
                      className={cn(
                        "block px-1.5 py-1 rounded text-[10.5px] leading-tight truncate",
                        v.status === "confirmed"
                          ? "bg-bz-accent text-bz-accent-fg"
                          : v.status === "cancelled" ||
                              v.status === "no_show"
                            ? "bg-bz-surface-2 text-bz-muted line-through"
                            : "bg-bz-navy text-bz-bg",
                      )}
                      title={
                        v.properties?.title ?? "Viewing"
                      }
                    >
                      {new Date(v.starts_at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      ·{" "}
                      {v.properties?.reference?.slice(-8) ?? "—"}
                    </Link>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ))}
      </div>
      </div>
      </div>
    </div>
  );
}
