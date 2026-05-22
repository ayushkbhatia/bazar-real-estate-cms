import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { propertyUrl } from "@/lib/queries/property-utils";
import { cn } from "@/lib/utils";
import type { Database } from "@/db/types";
import { ViewingActions } from "./_components/viewing-actions";

export const dynamic = "force-dynamic";

type Status = Database["public"]["Enums"]["viewing_status"];

type Row = {
  id: string;
  starts_at: string;
  duration_minutes: number;
  location: string | null;
  status: Status;
  notes: string | null;
  property_id: string | null;
  properties: { reference: string; slug: string; title: string } | null;
};

const STATUS_LABELS: Record<Status, string> = {
  tentative: "Tentative",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};
const STATUS_STYLES: Record<Status, string> = {
  tentative: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  confirmed: "bg-bz-accent-soft text-bz-accent",
  completed: "bg-bz-surface-2 text-bz-muted",
  cancelled: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
  no_show: "bg-bz-surface-3 text-bz-muted",
};

async function fetchMyViewings(): Promise<{ rows: Row[]; nowMs: number }> {
  if (!isSupabaseConfigured) return { rows: [], nowMs: Date.now() };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("viewings")
    .select(
      "id, starts_at, duration_minutes, location, status, notes, property_id, properties:property_id(reference, slug, title)",
    )
    .order("starts_at", { ascending: true });
  return {
    rows: (data ?? []) as unknown as Row[],
    nowMs: Date.now(),
  };
}

function formatRange(iso: string, minutes: number): string {
  const d = new Date(iso);
  return `${d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  })} · ${minutes} min`;
}

export default async function AccountViewingsPage() {
  const { rows, nowMs } = await fetchMyViewings();
  const upcoming = rows.filter(
    (r) =>
      new Date(r.starts_at).getTime() >= nowMs - 60 * 60_000 &&
      r.status !== "cancelled" &&
      r.status !== "completed" &&
      r.status !== "no_show",
  );
  const past = rows.filter((r) => !upcoming.includes(r));

  return (
    <div className="flex flex-col gap-12">
      <header>
        <Eyebrow>Account · Viewings</Eyebrow>
        <h1
          className="serif text-[48px] font-normal mt-2"
          style={{ letterSpacing: "-0.025em" }}
        >
          Your viewings.
        </h1>
        <p className="mt-3 text-[14px] text-bz-muted max-w-[60ch]">
          When an advisor schedules a viewing for you, it appears here with a
          calendar invite sent to your inbox.
        </p>
      </header>

      <section>
        <h2 className="serif text-[22px] mb-4" style={{ letterSpacing: "-0.02em" }}>
          Upcoming{" "}
          <span className="text-bz-muted text-[14px] ml-1">
            {upcoming.length}
          </span>
        </h2>
        {upcoming.length === 0 ? (
          <div className="bg-bz-surface border border-bz-border rounded-lg p-8 text-center text-bz-muted">
            Nothing on the calendar.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.map((v) => (
              <ViewingRow key={v.id} v={v} isUpcoming={upcoming.includes(v)} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section>
          <h2
            className="serif text-[22px] mb-4"
            style={{ letterSpacing: "-0.02em" }}
          >
            History{" "}
            <span className="text-bz-muted text-[14px] ml-1">{past.length}</span>
          </h2>
          <ul className="flex flex-col gap-3">
            {past.map((v) => (
              <ViewingRow key={v.id} v={v} isUpcoming={upcoming.includes(v)} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ViewingRow({ v, isUpcoming }: { v: Row; isUpcoming: boolean }) {
  return (
    <li className="bg-bz-surface border border-bz-border rounded-lg p-4 flex items-start gap-4">
      <Calendar size={16} strokeWidth={1.6} className="text-bz-muted mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-medium text-[14.5px]">
            {formatRange(v.starts_at, v.duration_minutes)}
          </span>
          <span
            className={cn(
              "inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] font-medium",
              STATUS_STYLES[v.status],
            )}
          >
            {STATUS_LABELS[v.status]}
          </span>
        </div>
        {v.properties ? (
          <div className="mt-1.5 text-[13px] text-bz-ink-2">
            <Link
              href={propertyUrl({
                slug: v.properties.slug,
                reference: v.properties.reference,
              })}
              className="hover:text-bz-accent"
            >
              <span className="mono text-[11.5px] text-bz-muted">
                {v.properties.reference}
              </span>{" "}
              · {v.properties.title}
            </Link>
          </div>
        ) : null}
        {v.location ? (
          <div className="mt-1 text-[12px] text-bz-muted flex items-center gap-1.5">
            <MapPin size={12} />
            {v.location}
          </div>
        ) : null}
        {isUpcoming ? (
          <ViewingActions
            viewing={{
              id: v.id,
              startsAt: v.starts_at,
              durationMinutes: v.duration_minutes,
              propertyReference: v.properties?.reference ?? null,
              propertyTitle: v.properties?.title ?? null,
              location: v.location,
            }}
          />
        ) : null}
      </div>
    </li>
  );
}
