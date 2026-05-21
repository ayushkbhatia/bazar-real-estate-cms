"use client";

import { cn } from "@/lib/utils";
import { usePresence, type PresenceMember } from "./use-presence";

type PresencePileProps = {
  channel: string;
  self: PresenceMember;
  /** Max avatars to render before the "+N" overflow chip. Default 3. */
  max?: number;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Stack of tiny avatars representing other staff currently viewing the
 * same record. Renders nothing when no other staff are present.
 */
export function PresencePile({
  channel,
  self,
  max = 3,
}: PresencePileProps) {
  const { others } = usePresence({ channel, self });

  if (others.length === 0) return null;

  const shown = others.slice(0, max);
  const overflow = others.length - shown.length;

  return (
    <div
      className="inline-flex items-center"
      role="status"
      aria-live="polite"
      aria-label={
        others.length === 1
          ? `${others[0].display_name} is also viewing this`
          : `${others.length} other staff are also viewing this`
      }
    >
      <div className="flex -space-x-1.5">
        {shown.map((m) => (
          <span
            key={m.user_id}
            title={`${m.display_name} is also viewing this`}
            className={cn(
              "inline-flex items-center justify-center w-6 h-6 rounded-full",
              "bg-bz-surface-3 text-bz-ink text-[10px] font-medium",
              "ring-2 ring-bz-surface",
            )}
          >
            {initials(m.display_name)}
          </span>
        ))}
        {overflow > 0 ? (
          <span
            title={`${overflow} more`}
            className={cn(
              "inline-flex items-center justify-center w-6 h-6 rounded-full",
              "bg-bz-surface-2 text-bz-muted text-[10px] font-medium",
              "ring-2 ring-bz-surface",
            )}
          >
            +{overflow}
          </span>
        ) : null}
      </div>
    </div>
  );
}
