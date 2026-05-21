"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { Database } from "@/db/types";
import { cn } from "@/lib/utils";
import { setEnquiryStatus, setEnquiryTemperature } from "../_actions";

type Status = Database["public"]["Enums"]["enquiry_status"];
type Temperature = Database["public"]["Enums"]["enquiry_temperature"];

const STATUS_FLOW: { value: Status; label: string }[] = [
  { value: "new", label: "New" },
  { value: "qualified", label: "Qualified" },
  { value: "viewing_scheduled", label: "Viewing" },
  { value: "offer", label: "Offer" },
  { value: "closed_won", label: "Won" },
  { value: "closed_lost", label: "Lost" },
];

const TEMPERATURES: Temperature[] = ["cold", "warm", "hot"];

export function StatusPipeline({
  enquiryId,
  current,
}: {
  enquiryId: string;
  current: Status;
}) {
  const [pending, start] = useTransition();
  const idx = STATUS_FLOW.findIndex((s) => s.value === current);

  return (
    <ol className="flex items-center gap-1 flex-wrap">
      {STATUS_FLOW.map((s, i) => {
        const active = s.value === current;
        const past = i < idx;
        return (
          <li key={s.value}>
            <button
              type="button"
              disabled={pending || active}
              onClick={() => {
                start(async () => {
                  const r = await setEnquiryStatus(enquiryId, s.value);
                  if (r.status === "error") toast.error(r.message);
                  else toast.success(r.message ?? "Status updated.");
                });
              }}
              className={cn(
                "px-2.5 h-7 rounded text-[12px] font-medium border transition-colors whitespace-nowrap",
                active
                  ? "bg-bz-ink text-bz-bg border-bz-ink"
                  : past
                    ? "bg-bz-accent-soft text-bz-accent border-bz-accent-soft"
                    : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
              )}
            >
              {s.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function TemperatureToggle({
  enquiryId,
  current,
}: {
  enquiryId: string;
  current: Temperature;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1">
      {TEMPERATURES.map((t) => {
        const active = t === current;
        return (
          <button
            key={t}
            type="button"
            disabled={pending || active}
            onClick={() => {
              start(async () => {
                const r = await setEnquiryTemperature(enquiryId, t);
                if (r.status === "error") toast.error(r.message);
                else toast.success(r.message ?? "Updated.");
              });
            }}
            className={cn(
              "px-2.5 h-7 rounded text-[12px] font-medium border transition-colors capitalize",
              active
                ? t === "hot"
                  ? "bg-[oklch(0.55_0.18_28)] text-white border-[oklch(0.55_0.18_28)]"
                  : t === "warm"
                    ? "bg-[oklch(0.55_0.12_60)] text-white border-[oklch(0.55_0.12_60)]"
                    : "bg-bz-surface-3 text-bz-ink border-bz-border-strong"
                : "bg-bz-surface text-bz-muted border-bz-border hover:border-bz-border-strong",
            )}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
