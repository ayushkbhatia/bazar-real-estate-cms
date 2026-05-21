"use client";

import { cn } from "@/lib/utils";
import {
  usePostgresChanges,
  type PostgresChangeEvent,
} from "./use-postgres-changes";

type LiveDotProps = {
  /** Realtime channel name — must be unique per subscription scope. */
  channel: string;
  /** Postgres table to watch. */
  table: string;
  /** Optional Postgres filter, e.g. `conversation_id=eq.<uuid>`. */
  filter?: string;
  /** Defaults to "*" — INSERT + UPDATE + DELETE. */
  event?: PostgresChangeEvent;
  /** Override the tooltip label. Defaults to "Live". */
  label?: string;
};

/**
 * Tiny pulsing dot for the CMS topbar. Subscribes to a Supabase Realtime
 * channel; each event triggers a 600 ms pulse animation (and the underlying
 * `usePostgresChanges` hook also throttle-fires `router.refresh()`, which
 * re-renders the surrounding RSC tree with fresh data).
 *
 * Connection state:
 * - subscribed + traffic    → green pulse
 * - subscribed + idle       → solid green
 * - never connected         → muted grey (no env, or socket failing)
 */
export function LiveDot({
  channel,
  table,
  filter,
  event = "*",
  label = "Live",
}: LiveDotProps) {
  const { lastEventAt, connected } = usePostgresChanges({
    channel,
    table,
    filter,
    event,
  });

  // `lastEventAt` doubles as the React key for the ping span — each new
  // event remounts the span, restarting the animation. No state needed.
  const pulseKey = lastEventAt ?? 0;
  const tone = connected ? "live" : "idle";

  return (
    <span
      role="status"
      aria-live="polite"
      title={
        tone === "live"
          ? lastEventAt
            ? `${label} · last event ${new Date(lastEventAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
            : `${label} · waiting for events`
          : `${label} · disconnected`
      }
      className="inline-flex items-center gap-1.5 px-2 h-7 rounded-full bg-bz-surface-2 text-[10.5px] uppercase tracking-wider text-bz-muted select-none"
    >
      <span className="relative inline-flex w-1.5 h-1.5">
        {tone === "live" && lastEventAt != null ? (
          <span
            key={pulseKey}
            className="absolute inset-0 rounded-full bg-[oklch(0.65_0.18_145)] opacity-75 animate-ping"
            aria-hidden
          />
        ) : null}
        <span
          className={cn(
            "relative inline-flex w-1.5 h-1.5 rounded-full",
            tone === "live"
              ? "bg-[oklch(0.55_0.15_145)]"
              : "bg-bz-muted-2",
          )}
          aria-hidden
        />
      </span>
      <span className={tone === "live" ? "text-bz-ink-2" : "text-bz-muted"}>
        {label}
      </span>
    </span>
  );
}
