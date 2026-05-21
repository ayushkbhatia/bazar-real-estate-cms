"use client";

import { AlertTriangle } from "lucide-react";
import { usePresence, type PresenceMember } from "./use-presence";

type PresenceBannerProps = {
  channel: string;
  self: PresenceMember;
  /** Override the body text. Defaults to "is also editing this. Last save wins." */
  message?: string;
};

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * Informative-only warning shown when another staff member is viewing the
 * same edit screen. No locking — last save wins — but at least we surface
 * the collision so the second editor can self-coordinate.
 *
 * Renders nothing when nobody else is present.
 */
export function PresenceBanner({
  channel,
  self,
  message = "is also editing this. Last save wins.",
}: PresenceBannerProps) {
  const { others } = usePresence({ channel, self });

  if (others.length === 0) return null;

  const names = others.map((o) => o.display_name);

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-[oklch(0.85_0.1_75)] bg-[oklch(0.97_0.05_80)] px-4 py-3 text-[12.5px] text-[oklch(0.35_0.12_60)]"
    >
      <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
      <div>
        <span className="font-medium">{joinNames(names)}</span> {message}
      </div>
    </div>
  );
}
