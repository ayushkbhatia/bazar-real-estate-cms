"use client";

import * as React from "react";
import { ChevronDown, Clock } from "lucide-react";
import {
  dubaiNow,
  rotateToToday,
  statusFor,
  toRowView,
  type HoursRow,
  type HoursStatus,
} from "./hours";

/**
 * Opening hours in the contact rail, in the shape of a Google Business Profile
 * card: one summary line ("Open · Closes 7 PM") that expands into the full
 * week, today first.
 *
 * Built on <details>/<summary> so the disclosure works before hydration and
 * without JavaScript. Only the live status and the today-first ordering need a
 * clock, and the office clock is Asia/Dubai wherever the reader is — so both
 * are filled in after mount. The first paint is deliberately status-free: this
 * page is statically revalidated and CDN-cached, so anything computed on the
 * server would be stale, and computing it during render would mismatch the
 * hydrated markup.
 */
export function OpeningHours({
  label,
  rows,
}: {
  label: string;
  rows: HoursRow[];
}) {
  const views = React.useMemo(() => rows.map(toRowView), [rows]);
  const [now, setNow] = React.useState<{ day: number; minutes: number } | null>(
    null,
  );

  React.useEffect(() => {
    const tick = () => setNow(dubaiNow());
    tick();
    // Re-check every minute so an open/close boundary doesn't need a reload.
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const status: HoursStatus | null = now ? statusFor(views, now) : null;
  const ordered = rotateToToday(views, now?.day ?? null);
  const todayIndex = now?.day ?? null;

  if (views.length === 0) return null;

  return (
    <div className="flex gap-5 py-6 border-t border-bz-border">
      <div className="text-bz-accent mt-0.5">
        <Clock size={20} strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="eyebrow">{label}</div>
        <details className="group mt-2" data-testid="opening-hours">
          <summary
            className="flex cursor-pointer list-none items-center gap-3 rounded-sm text-[15px] text-bz-ink outline-none focus-visible:ring-2 focus-visible:ring-bz-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bz-bg [&::-webkit-details-marker]:hidden"
            data-testid="opening-hours-summary"
          >
            <span className="flex-1">
              {status ? (
                <>
                  <span
                    className={
                      status.open ? "text-bz-accent" : "text-bz-muted"
                    }
                  >
                    {status.state}
                  </span>
                  {status.detail ? (
                    <span className="text-bz-ink-2"> · {status.detail}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-bz-ink-2">See daily hours</span>
              )}
            </span>
            <ChevronDown
              size={16}
              strokeWidth={1.7}
              aria-hidden
              className="flex-shrink-0 text-bz-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <ul className="mt-3 flex flex-col gap-1.5">
            {ordered.map((row, i) => {
              const isToday = todayIndex !== null && row.index === todayIndex;
              return (
                <li
                  key={`${row.day}-${i}`}
                  className={`flex items-baseline justify-between gap-6 text-[14px] ${
                    isToday ? "text-bz-ink font-medium" : "text-bz-ink-2"
                  }`}
                >
                  <span>{row.day}</span>
                  <span
                    className={row.openDay ? undefined : "text-bz-muted"}
                  >
                    {row.display}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      </div>
    </div>
  );
}
