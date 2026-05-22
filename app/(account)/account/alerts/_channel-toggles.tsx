"use client";

import { useState } from "react";
import { Mail, MessageCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Channel = "email" | "whatsapp" | "sms";

const CHANNELS: { value: Channel; label: string; icon: React.ElementType }[] = [
  { value: "email", label: "Email", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "sms", label: "SMS", icon: MessageSquare },
];

/**
 * Sprint 2 (backfilled): per-channel alert delivery toggles. Email is the
 * only channel wired today; WhatsApp + SMS land in Sprint 10 alongside the
 * lead-engine workflows.
 *
 * State persists to localStorage as a transitional store — Sprint 8 adds
 * an `alert_channels` jsonb column on `saved_searches`; Sprint 9 swaps
 * the persistence layer with no UI change.
 */
const STORAGE_KEY_PREFIX = "bz:alert-channels:";

function loadChannels(searchId: string): Channel[] {
  if (typeof window === "undefined") return ["email"];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + searchId);
    if (!raw) return ["email"];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ["email"];
    return parsed.filter(
      (c): c is Channel => c === "email" || c === "whatsapp" || c === "sms",
    );
  } catch {
    return ["email"];
  }
}

function saveChannels(searchId: string, channels: Channel[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY_PREFIX + searchId,
      JSON.stringify(channels),
    );
  } catch {
    // ignore
  }
}

export function ChannelToggles({ searchId }: { searchId: string }) {
  const [channels, setChannels] = useState<Channel[]>(() =>
    loadChannels(searchId),
  );

  function toggle(channel: Channel) {
    setChannels((prev) => {
      const next = prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel];
      // Email is the only currently-wired channel — keep at least one
      // channel selected so the user doesn't accidentally silence the search.
      if (next.length === 0) {
        toast.error("At least one channel must stay on.");
        return prev;
      }
      saveChannels(searchId, next);
      const added = !prev.includes(channel);
      if (channel !== "email") {
        toast.info(
          added
            ? `${channel === "whatsapp" ? "WhatsApp" : "SMS"} alerts queued — channel wires up in Sprint 10.`
            : "Channel removed.",
        );
      }
      return next;
    });
  }

  return (
    <div className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
      {CHANNELS.map(({ value, label, icon: Icon }) => {
        const active = channels.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            aria-pressed={active}
            title={`${label} alerts ${active ? "on" : "off"}`}
            className={cn(
              "inline-flex items-center gap-1 h-7 px-2 rounded text-[11.5px] transition-colors",
              active
                ? "bg-bz-ink text-bz-bg font-medium"
                : "text-bz-muted hover:text-bz-ink",
            )}
          >
            <Icon size={11} strokeWidth={1.8} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
