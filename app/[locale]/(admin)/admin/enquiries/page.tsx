import Link from "next/link";
import { ChevronRight, KanbanSquare, ListTree } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { LiveDot } from "@/lib/realtime/live-dot";
import { listEnquiries, type EnquiryListRow } from "@/lib/queries/enquiries";
import { cn } from "@/lib/utils";
import type { Database } from "@/db/types";
import { KanbanBoard } from "./_kanban";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    scope?: string;
    status?: string;
    temperature?: string;
    view?: string;
  }>;
};

const SCOPES = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "unassigned", label: "Unassigned" },
] as const;

const STATUS_LABELS: Record<
  Database["public"]["Enums"]["enquiry_status"],
  string
> = {
  new: "New",
  qualified: "Qualified",
  viewing_scheduled: "Viewing",
  offer: "Offer",
  closed_won: "Won",
  closed_lost: "Lost",
};

const STATUS_STYLES: Record<
  Database["public"]["Enums"]["enquiry_status"],
  string
> = {
  new: "bg-[oklch(0.96_0.05_240)] text-[oklch(0.45_0.1_240)]",
  qualified: "bg-bz-accent-soft text-bz-accent",
  viewing_scheduled: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  offer: "bg-bz-surface-2 text-bz-ink-2",
  closed_won: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  closed_lost: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
};

const TEMPERATURE_STYLES: Record<
  Database["public"]["Enums"]["enquiry_temperature"],
  string
> = {
  cold: "text-bz-muted",
  warm: "text-[oklch(0.55_0.12_60)]",
  hot: "text-[oklch(0.55_0.18_28)]",
};

function relative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

function summariseSource(s: EnquiryListRow["source"]): string {
  return s.replace(/_/g, " ");
}

function ScopeTabs({
  current,
  hot,
}: {
  current: string;
  hot: boolean;
}) {
  return (
    <nav className="flex gap-1">
      {SCOPES.map((s) => (
        <Link
          key={s.value}
          href={s.value === "all" ? "/admin/enquiries" : `?scope=${s.value}`}
          className={cn(
            "px-3 h-8 inline-flex items-center rounded text-[13px] transition-colors",
            current === s.value
              ? "bg-bz-navy text-bz-bg"
              : "text-bz-ink-2 hover:bg-bz-surface-2",
          )}
        >
          {s.label}
        </Link>
      ))}
      <Link
        href="?temperature=hot"
        className={cn(
          "px-3 h-8 inline-flex items-center rounded text-[13px] transition-colors ms-2",
          hot
            ? "bg-[oklch(0.55_0.18_28)] text-white"
            : "text-bz-ink-2 hover:bg-bz-surface-2",
        )}
      >
        Hot only
      </Link>
    </nav>
  );
}

export default async function EnquiriesPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const scope = (raw.scope === "mine" || raw.scope === "unassigned"
    ? raw.scope
    : "all") as "all" | "mine" | "unassigned";
  const status = (
    raw.status &&
    (
      [
        "new",
        "qualified",
        "viewing_scheduled",
        "offer",
        "closed_won",
        "closed_lost",
      ] as const
    ).includes(raw.status as never)
      ? raw.status
      : null
  ) as Database["public"]["Enums"]["enquiry_status"] | null;
  const temperature = raw.temperature === "hot" ? "hot" : null;
  const view = raw.view === "kanban" ? "kanban" : "list";

  // In Kanban mode the status filter is meaningless — the columns ARE
  // the status partition — but scope + temperature still apply.
  const { rows, total } = await listEnquiries({
    scope,
    status: view === "kanban" ? null : status,
    temperature,
    limit: 200,
  });

  return (
    <CmsShell
      title="Enquiries"
      breadcrumbs="Inbox"
      primary={<ViewToggle view={view} />}
      live={
        <LiveDot
          channel="public:enquiries:list"
          table="enquiries"
          event="*"
        />
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between gap-4">
          <ScopeTabs current={scope} hot={temperature === "hot"} />
          <div className="text-[13px] text-bz-muted">
            {total} {total === 1 ? "enquiry" : "enquiries"}
          </div>
        </div>

        {view === "kanban" ? (
          <KanbanBoard rows={rows} />
        ) : rows.length === 0 ? (
          <div className="bg-bz-surface border border-bz-border rounded-lg p-12 text-center text-bz-muted">
            No enquiries match this view.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/enquiries/${row.id}`}
                  className="block bg-bz-surface border border-bz-border rounded-lg p-4 hover:border-bz-border-strong transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        <span className="font-medium text-[14.5px]">
                          {row.name}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] font-medium",
                            STATUS_STYLES[row.status],
                          )}
                        >
                          {STATUS_LABELS[row.status]}
                        </span>
                        <span
                          className={cn(
                            "text-[11px] uppercase tracking-wider",
                            TEMPERATURE_STYLES[row.temperature],
                          )}
                        >
                          ● {row.temperature}
                        </span>
                        {row.unread_count > 0 ? (
                          <span className="inline-flex items-center h-[20px] px-1.5 rounded-full text-[10.5px] bg-bz-navy text-bz-bg">
                            {row.unread_count} unread
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[13px] text-bz-ink-2 mt-2 line-clamp-2 leading-snug">
                        {row.brief_raw}
                      </p>
                      <div className="flex flex-wrap gap-3 text-[11.5px] text-bz-muted mt-2.5">
                        {row.properties ? (
                          <span>
                            <span className="text-bz-ink-2">
                              {row.properties.reference}
                            </span>{" "}
                            · {row.properties.title}
                          </span>
                        ) : null}
                        {/* Brochure requests carry a development, not a
                            listing — without this the row showed no source
                            page at all. */}
                        {row.developments ? (
                          <span className="text-bz-ink-2">
                            {row.developments.name}
                          </span>
                        ) : null}
                        <span className="capitalize">
                          via {summariseSource(row.source)}
                        </span>
                        {row.staff ? (
                          <span>assigned to {row.staff.display_name}</span>
                        ) : (
                          <span>unassigned</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-[11.5px] text-bz-muted mono">
                        {relative(row.created_at)} ago
                      </span>
                      <ChevronRight
                        size={14}
                        strokeWidth={1.6}
                        className="text-bz-muted"
                      />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CmsShell>
  );
}

function ViewToggle({ view }: { view: "list" | "kanban" }) {
  return (
    <div className="inline-flex items-center bg-bz-surface border border-bz-border rounded overflow-hidden h-9 text-[12.5px]">
      <Link
        href="/admin/enquiries"
        className={cn(
          "h-full px-3 inline-flex items-center gap-1.5 transition-colors",
          view === "list"
            ? "bg-bz-navy text-bz-bg"
            : "text-bz-ink-2 hover:bg-bz-surface-2",
        )}
        aria-pressed={view === "list"}
      >
        <ListTree size={13} strokeWidth={1.7} /> List
      </Link>
      <Link
        href="/admin/enquiries?view=kanban"
        className={cn(
          "h-full px-3 inline-flex items-center gap-1.5 transition-colors",
          view === "kanban"
            ? "bg-bz-navy text-bz-bg"
            : "text-bz-ink-2 hover:bg-bz-surface-2",
        )}
        aria-pressed={view === "kanban"}
      >
        <KanbanSquare size={13} strokeWidth={1.7} /> Pipeline
      </Link>
    </div>
  );
}
