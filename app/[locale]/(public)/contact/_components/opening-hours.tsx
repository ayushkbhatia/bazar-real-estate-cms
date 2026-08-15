"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Clock } from "lucide-react";
import {
  DAY_KEYS,
  dubaiNow,
  formatMinutes,
  rotateToToday,
  statusFor,
  toRowView,
  type HoursRow,
  type HoursRowView,
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
  const t = useTranslations("common");
  const views = React.useMemo(() => rows.map(toRowView), [rows]);

  /** Minute-of-day as the visitor's locale writes it. */
  const time = React.useCallback(
    (minutes: number) =>
      formatMinutes(minutes, { am: t("hours.am"), pm: t("hours.pm") }),
    [t],
  );

  /**
   * The summary line, from a decision rather than from `statusFor`'s prose.
   *
   * `opensDay` is the case that could not survive as a sentence: the model
   * used to build "Opens Mon 9 AM" from a hardcoded English abbreviation, and
   * Arabic does not abbreviate its weekdays that way.
   */
  const detail = React.useCallback(
    (s: HoursStatus): string | null => {
      if (s.kind === "none" || s.minutes === null) return null;
      if (s.kind === "opensDay" && s.day !== null) {
        return t("hours.opensDay", {
          day: t(`hours.day.${DAY_KEYS[s.day]}`),
          time: time(s.minutes),
        });
      }
      return t(`hours.${s.kind}`, { time: time(s.minutes) });
    },
    [t, time],
  );

  /** One row's hours: closed, a range, or the editor's own words. */
  const rowLabel = React.useCallback(
    (row: HoursRowView): string => {
      if (row.closedDay) return t("hours.closed");
      if (row.openMinutes !== null && row.closeMinutes !== null) {
        return t("hours.range", {
          from: time(row.openMinutes),
          to: time(row.closeMinutes),
        });
      }
      // Free text the editor typed — "By appointment". Its Arabic comes from
      // the master page's twin, not from here.
      return row.rawDisplay ?? "—";
    },
    [t, time],
  );
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
                    {t(status.open ? "hours.open" : "hours.closed")}
                  </span>
                  {detail(status) ? (
                    <span className="text-bz-ink-2"> · {detail(status)}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-bz-ink-2">{t("hours.seeDaily")}</span>
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
                    {rowLabel(row)}
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
