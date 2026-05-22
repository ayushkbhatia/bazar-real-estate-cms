"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { updateSavedSearchAlert } from "../../_actions";

const OPTIONS: { value: "off" | "instant" | "daily" | "weekly"; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "instant", label: "Instant" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

export function FrequencyPicker({
  id,
  initial,
}: {
  id: string;
  initial: "off" | "instant" | "daily" | "weekly";
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  function pick(next: typeof value) {
    if (next === value) return;
    const prev = value;
    setValue(next); // optimistic
    startTransition(async () => {
      const result = await updateSavedSearchAlert({
        id,
        frequency: next,
      });
      if (result.status === "ok") {
        toast.success(
          next === "off" ? "Alerts paused." : `Set to ${next}.`,
        );
      } else {
        setValue(prev);
        toast.error(
          result.status === "auth_required"
            ? "Sign in to change alerts."
            : (result as { message?: string }).message ?? "Could not save.",
        );
      }
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Alert frequency"
      className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          disabled={pending}
          onClick={() => pick(opt.value)}
          className={
            value === opt.value
              ? "h-7 px-3 rounded text-[12px] font-medium bg-bz-ink text-bz-bg"
              : "h-7 px-3 rounded text-[12px] text-bz-ink-2 hover:text-bz-ink transition-colors"
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
