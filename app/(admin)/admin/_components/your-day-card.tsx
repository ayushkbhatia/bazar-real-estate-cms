import Link from "next/link";
import { Calendar, AlertCircle, MapPin, Check } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

type Task = {
  kind: "viewing" | "follow_up" | "escalation" | "deal_action";
  label: string;
  detail: string;
  href: string;
  time?: string;
};

/**
 * Sprint 7a (backfilled): "Your day" card on the admin dashboard.
 * Combines today's viewings + escalated leads + deal-stage actions into a
 * single scannable agenda.
 */
export function YourDayCard({ tasks }: { tasks: Task[] }) {
  const KIND_ICONS = {
    viewing: MapPin,
    follow_up: Calendar,
    escalation: AlertCircle,
    deal_action: Check,
  } as const;

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <Eyebrow>Your day</Eyebrow>
          <h3
            className="serif text-[18px] mt-1 leading-tight"
            style={{ letterSpacing: "-0.01em" }}
          >
            What&apos;s on the calendar.
          </h3>
        </div>
        <Link
          href="/admin/enquiries"
          className="text-[12.5px] text-bz-muted hover:text-bz-ink-2"
        >
          All tasks →
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-[13px] text-bz-muted">Nothing on the calendar.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((t, i) => {
            const Icon = KIND_ICONS[t.kind];
            return (
              <li key={i}>
                <Link
                  href={t.href}
                  className="flex items-start gap-3 py-2 -mx-1 px-1 rounded hover:bg-bz-bg/60 transition-colors"
                >
                  <Icon
                    size={14}
                    strokeWidth={1.7}
                    className={
                      t.kind === "escalation"
                        ? "text-bz-danger mt-0.5"
                        : "text-bz-muted mt-0.5"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-bz-ink truncate">
                      {t.label}
                    </div>
                    <div className="text-[11.5px] text-bz-muted truncate">
                      {t.detail}
                    </div>
                  </div>
                  {t.time ? (
                    <span className="mono text-[11px] text-bz-muted">
                      {t.time}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
