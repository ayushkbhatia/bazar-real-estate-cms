import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { fmtMs, type HealthReport } from "@/lib/health";
import { buildHealthReport } from "@/lib/health-probes";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Status",
  description: "Live operational status of the Bazar marketplace.",
  robots: { index: true, follow: true },
};

const STATUS_COPY = {
  ok: {
    label: "Operational",
    classes: "bg-bz-success text-white",
    description: "All systems operating normally.",
  },
  degraded: {
    label: "Degraded",
    classes: "bg-bz-warning text-bz-ink",
    description:
      "One or more services are responding slowly. The site is still serving traffic.",
  },
  down: {
    label: "Service disruption",
    classes: "bg-bz-danger text-white",
    description:
      "One or more critical services are unreachable. We are investigating.",
  },
  unconfigured: {
    label: "Partial setup",
    classes: "bg-bz-surface-2 text-bz-ink-2",
    description:
      "Some integrations are not configured in this environment — expected on preview deploys.",
  },
} as const;

const CHECK_LABELS: Record<string, string> = {
  supabase: "Database & auth (Supabase)",
  resend: "Transactional email (Resend)",
};

async function loadHealth(): Promise<HealthReport | null> {
  // Build the report in-process — calling our own /api/health over HTTP
  // would require knowing the public hostname at SSR time, which is brittle
  // (and broken in CI's localhost run). Same probes, no round-trip.
  try {
    return await buildHealthReport();
  } catch {
    return null;
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default async function StatusPage() {
  const report = await loadHealth();

  if (!report) {
    return (
      <section className="px-12 py-20 max-w-[840px] mx-auto">
        <Eyebrow>Status</Eyebrow>
        <h1
          className="serif text-[44px] font-normal mt-2"
          style={{ letterSpacing: "-0.025em" }}
        >
          We can&apos;t reach the health endpoint.
        </h1>
        <p className="mt-4 text-[15px] text-bz-ink-2 leading-relaxed">
          This usually means the marketplace itself is responding to your
          browser but our internal probe failed. Try refreshing in a minute.
        </p>
      </section>
    );
  }

  const overall = STATUS_COPY[report.status];

  return (
    <section className="px-12 py-20 max-w-[840px] mx-auto">
      <Eyebrow>Status</Eyebrow>
      <h1
        className="serif text-[44px] font-normal mt-2"
        style={{ letterSpacing: "-0.025em" }}
      >
        Bazar marketplace
      </h1>

      <div className="mt-6 inline-flex items-center gap-3 px-4 py-2 rounded-full border border-bz-border bg-bz-surface">
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            report.status === "ok"
              ? "bg-bz-success"
              : report.status === "down"
                ? "bg-bz-danger"
                : "bg-bz-warning",
          )}
          aria-hidden
        />
        <span
          className={cn(
            "inline-flex items-center h-[20px] px-2 rounded-full text-[11px] font-medium",
            overall.classes,
          )}
        >
          {overall.label}
        </span>
        <span className="text-[12.5px] text-bz-muted">
          {overall.description}
        </span>
      </div>

      <p className="mt-3 text-[11.5px] text-bz-muted-2 mono">
        Last probe: {fmtDate(report.checked_at)}
      </p>

      <h2
        className="mt-12 serif text-[24px] font-normal"
        style={{ letterSpacing: "-0.015em" }}
      >
        Components
      </h2>
      <ul className="mt-4 flex flex-col gap-2">
        {report.checks.map((check) => {
          const copy = STATUS_COPY[check.status];
          return (
            <li
              key={check.name}
              className="border border-bz-border rounded-lg p-4 bg-bz-surface flex items-baseline gap-4 flex-wrap"
            >
              <div className="flex-1 min-w-[180px]">
                <div className="text-[14px] font-medium">
                  {CHECK_LABELS[check.name] ?? check.name}
                </div>
                {check.detail ? (
                  <div className="text-[12px] text-bz-muted mt-0.5">
                    {check.detail}
                  </div>
                ) : null}
              </div>
              <span
                className={cn(
                  "inline-flex items-center h-[20px] px-2 rounded-full text-[11px] font-medium",
                  copy.classes,
                )}
              >
                {copy.label}
              </span>
              <span className="mono text-[12px] text-bz-muted-2 min-w-[60px] text-right">
                {fmtMs(check.latency_ms)}
              </span>
            </li>
          );
        })}
      </ul>

      <h2
        className="mt-12 serif text-[24px] font-normal"
        style={{ letterSpacing: "-0.015em" }}
      >
        Last deploy
      </h2>
      <dl className="mt-4 text-[13px] grid grid-cols-[160px_1fr] gap-y-2 max-w-[480px]">
        <dt className="text-bz-muted">Environment</dt>
        <dd className="mono">{report.deploy.environment}</dd>
        <dt className="text-bz-muted">Commit</dt>
        <dd className="mono">{report.deploy.commit_short ?? "—"}</dd>
        <dt className="text-bz-muted">Branch</dt>
        <dd className="mono">{report.deploy.commit_ref ?? "—"}</dd>
      </dl>

      <p className="mt-12 text-[12px] text-bz-muted leading-snug max-w-[60ch]">
        This page is generated from <span className="mono">/api/health</span>{" "}
        every time you visit. For incidents, contact{" "}
        <a
          href="mailto:hello@bazar.ae"
          className="underline text-bz-ink hover:text-bz-accent"
        >
          hello@bazar.ae
        </a>
        .
      </p>
    </section>
  );
}
