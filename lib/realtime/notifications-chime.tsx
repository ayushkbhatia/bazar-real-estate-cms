"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import {
  isChimeEnabled,
  playChime,
  setChimeEnabled,
} from "./chime";
import { usePostgresChanges } from "./use-postgres-changes";
import { useAdminSession } from "@/app/(admin)/_components/admin-session";

function subscribeToChimePreference(callback: () => void): () => void {
  window.addEventListener("bz-chime-changed", callback);
  return () => window.removeEventListener("bz-chime-changed", callback);
}

function readChimePreference(): boolean {
  return isChimeEnabled();
}

function readChimePreferenceSSR(): boolean {
  return false;
}

type NotificationsChimeProps = {
  /** Current user's id. When omitted the component self-fetches from
   *  /api/notifications/recent, matching the bell's behaviour. */
  userId?: string | null;
};

/**
 * Headless-ish chime: subscribes to the current user's notification stream
 * and plays a soft tone on each INSERT *when the user has opted in*.
 *
 * Rendered: a tiny mute/unmute toggle button. Default state is off, so the
 * tone never plays for users who haven't enabled it.
 */
export function NotificationsChime({
  userId: userIdProp,
}: NotificationsChimeProps = {}) {
  const enabled = useSyncExternalStore(
    subscribeToChimePreference,
    readChimePreference,
    readChimePreferenceSSR,
  );
  // The admin layout resolves the user server-side, so inside /admin the
  // self-fetch below never runs. An explicit prop still wins.
  const session = useAdminSession();
  const seededUserId = userIdProp ?? session?.userId ?? null;
  const [userId, setUserId] = useState<string | null>(seededUserId);

  // Self-fetch userId when nothing seeded us (same shape as the bell).
  useEffect(() => {
    if (seededUserId) return;
    let cancelled = false;
    fetch("/api/notifications/recent", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { userId?: string | null } | null) => {
        if (cancelled || !json) return;
        setUserId(json.userId ?? null);
      })
      .catch(() => {
        // Offline or transient — the chime stays muted, which is the
        // default state anyway. Drop a breadcrumb so we know if this
        // becomes a pattern, but don't pop up a Sentry event for what
        // is usually a network blip.
        Sentry.addBreadcrumb({
          category: "realtime/chime",
          message: "userId self-fetch failed",
          level: "info",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [seededUserId]);

  // Subscribe to the user's notifications. The refresh fired by the hook is
  // harmless (the bell does its own refresh too) — what we actually use is
  // the onEvent callback to play the tone.
  usePostgresChanges({
    channel: userId ? `notifications-chime:${userId}` : "notifications-chime:anon",
    table: "notifications",
    event: "INSERT",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: enabled && userId != null,
    onEvent: () => {
      if (isChimeEnabled()) playChime();
    },
  });

  const toggle = useCallback(() => {
    const next = !enabled;
    setChimeEnabled(next);
    if (next) playChime();
  }, [enabled]);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={
        enabled
          ? "Mute notification chime"
          : "Enable notification chime (off by default)"
      }
      aria-pressed={enabled}
      title={enabled ? "Notification chime: on" : "Notification chime: off"}
      onClick={toggle}
    >
      {enabled ? (
        <Bell size={15} strokeWidth={1.6} />
      ) : (
        <BellOff size={15} strokeWidth={1.6} className="text-bz-muted" />
      )}
    </Button>
  );
}
