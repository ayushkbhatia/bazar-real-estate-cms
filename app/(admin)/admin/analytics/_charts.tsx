"use client";

import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type {
  EnquiriesBySource,
  FunnelStage,
  TimeBucket,
  ViewingsByStatus,
} from "@/lib/queries/analytics-utils";

const AXIS_FONT_SIZE = 11;
const TOOLTIP_STYLE = {
  background: "var(--bz-surface)",
  border: "1px solid var(--bz-border)",
  borderRadius: 6,
  fontSize: 12,
  padding: "6px 10px",
};

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function PublishedOverTimeChart({
  data,
}: {
  data: TimeBucket[];
}) {
  if (data.length === 0) {
    return <EmptyChart label="No properties published in this range." />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={data}
        margin={{ top: 10, right: 10, left: -16, bottom: 0 }}
      >
        <CartesianGrid stroke="var(--bz-border)" strokeDasharray="2 4" />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: AXIS_FONT_SIZE, fill: "var(--bz-muted)" }}
          minTickGap={20}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: AXIS_FONT_SIZE, fill: "var(--bz-muted)" }}
          width={28}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(label) => formatShortDate(String(label))}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--bz-ink)"
          strokeWidth={1.6}
          dot={{ r: 2.5, fill: "var(--bz-ink)" }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function EnquiriesOverTimeChart({
  data,
}: {
  data: TimeBucket[];
}) {
  if (data.length === 0) {
    return <EmptyChart label="No enquiries in this range." />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={data}
        margin={{ top: 10, right: 10, left: -16, bottom: 0 }}
      >
        <CartesianGrid stroke="var(--bz-border)" strokeDasharray="2 4" />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: AXIS_FONT_SIZE, fill: "var(--bz-muted)" }}
          minTickGap={20}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: AXIS_FONT_SIZE, fill: "var(--bz-muted)" }}
          width={28}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(label) => formatShortDate(String(label))}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--bz-accent)"
          strokeWidth={1.6}
          dot={{ r: 2.5, fill: "var(--bz-accent)" }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function EnquiriesBySourceChart({
  data,
}: {
  data: EnquiriesBySource[];
}) {
  if (data.length === 0) {
    return <EmptyChart label="No enquiries to break down by source." />;
  }
  const total = data.reduce((s, r) => s + r.count, 0);
  return (
    <ul className="flex flex-col gap-2">
      {data.map((row) => {
        const share = total === 0 ? 0 : (row.count / total) * 100;
        return (
          <li key={row.source}>
            <div className="flex items-baseline justify-between text-[12.5px] mb-1">
              <span className="capitalize">
                {row.source.replace(/[_-]/g, " ")}
              </span>
              <span className="mono text-bz-muted">
                {row.count} · {share.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 bg-bz-surface-2 rounded">
              <div
                className="h-full bg-bz-ink rounded"
                style={{ width: `${share}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function FunnelChart({ data }: { data: FunnelStage[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((stage, i) => {
        const share = (stage.count / max) * 100;
        const dropOff =
          i === 0 || data[i - 1].count === 0
            ? null
            : Math.round((1 - stage.count / data[i - 1].count) * 100);
        return (
          <div key={stage.status} className="flex items-center gap-3">
            <span className="text-[12.5px] w-[100px] shrink-0">
              {stage.label}
            </span>
            <div className="flex-1 relative h-7 bg-bz-surface-2 rounded">
              <div
                className="absolute top-0 left-0 h-full bg-bz-ink rounded"
                style={{ width: `${Math.max(share, 2)}%` }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11.5px] text-bz-ink-2 mono">
                {stage.count}
              </span>
            </div>
            <span className="text-[10.5px] text-bz-muted w-[60px] text-right">
              {dropOff != null && dropOff > 0
                ? `−${dropOff}%`
                : i === 0
                  ? "start"
                  : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const VIEWING_STATUS_COLOURS: Record<string, string> = {
  scheduled: "var(--bz-ink)",
  confirmed: "var(--bz-accent)",
  completed: "oklch(0.6 0.12 145)",
  cancelled: "oklch(0.6 0.14 28)",
  no_show: "var(--bz-muted-2)",
};

export function ViewingsByStatusChart({
  data,
}: {
  data: ViewingsByStatus[];
}) {
  if (data.length === 0) {
    return <EmptyChart label="No viewings in this range." />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 10, left: -16, bottom: 0 }}
      >
        <CartesianGrid stroke="var(--bz-border)" strokeDasharray="2 4" />
        <XAxis
          dataKey="status"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: AXIS_FONT_SIZE, fill: "var(--bz-muted)" }}
          tickFormatter={(s) => s.replace(/_/g, " ")}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: AXIS_FONT_SIZE, fill: "var(--bz-muted)" }}
          width={28}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="count" radius={[2, 2, 0, 0]}>
          {data.map((row) => (
            <Cell
              key={row.status}
              fill={
                VIEWING_STATUS_COLOURS[row.status] ?? "var(--bz-ink-2)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center bg-bz-surface-2 rounded text-[12.5px] text-bz-muted">
      {label}
    </div>
  );
}
