import Link from "next/link";
import { Plus } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { fetchInboxKpis } from "@/lib/queries/enquiries";
import { PipelineBarChart } from "./_components/pipeline-bar-chart";
import { ActivityFeed } from "./_components/activity-feed";

async function fetchKpis() {
  if (!isSupabaseConfigured)
    return {
      active: null,
      drafts: null,
      total: null,
      pipeline: {} as Record<string, number>,
    };
  try {
    const supabase = await createSupabaseServerClient();
    const [
      { count: active },
      { count: drafts },
      { count: total },
      pipelineRes,
    ] = await Promise.all([
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .is("deleted_at", null),
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft")
        .is("deleted_at", null),
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase.from("enquiries").select("status"),
    ]);

    const pipeline: Record<string, number> = {};
    for (const row of (pipelineRes.data as { status: string }[] | null) ??
      []) {
      pipeline[row.status] = (pipeline[row.status] ?? 0) + 1;
    }
    return { active, drafts, total, pipeline };
  } catch (e) {
    console.error("[admin/dashboard] kpis", e);
    return {
      active: null,
      drafts: null,
      total: null,
      pipeline: {} as Record<string, number>,
    };
  }
}

async function fetchRecentActivity() {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("audit_log")
      .select("id, action, target_kind, target_id, at, actor_id")
      .order("at", { ascending: false })
      .limit(8);
    if (!data) return [];

    const actorIds = Array.from(
      new Set(
        (data as unknown as { actor_id: string | null }[])
          .map((r) => r.actor_id)
          .filter((a): a is string => a !== null),
      ),
    );
    const { data: staff } =
      actorIds.length > 0
        ? await supabase
            .from("staff")
            .select("user_id, display_name")
            .in("user_id", actorIds)
        : { data: null };
    const nameMap = new Map(
      (staff as { user_id: string; display_name: string }[] | null)?.map(
        (s) => [s.user_id, s.display_name],
      ) ?? [],
    );

    type RawEntry = {
      id: string;
      action: string;
      target_kind: string | null;
      target_id: string | null;
      at: string;
      actor_id: string | null;
    };
    const now = Date.now();
    return (data as unknown as RawEntry[]).map((row) => ({
      id: row.id,
      actor: row.actor_id
        ? (nameMap.get(row.actor_id) ?? "Staff")
        : "System",
      action: prettyAction(row.action),
      target: prettyTarget(row.target_kind ?? "—", row.target_id ?? ""),
      targetHref:
        row.target_kind && row.target_id
          ? prettyHref(row.target_kind, row.target_id)
          : undefined,
      ago: relativeTime(row.at, now),
    }));
  } catch (e) {
    console.error("[admin/dashboard] recent-activity", e);
    return [];
  }
}

function prettyAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\./g, " · ");
}
function prettyTarget(kind: string, id: string): string {
  return `${kind} · ${id.slice(0, 8)}`;
}
function prettyHref(kind: string, id: string): string | undefined {
  if (kind === "property") return `/admin/properties/${id}`;
  if (kind === "enquiry") return `/admin/enquiries?id=${id}`;
  if (kind === "staff") return `/admin/agents/${id}`;
  return undefined;
}
function relativeTime(iso: string, nowMs: number): string {
  const ms = nowMs - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default async function AdminDashboardPage() {
  const [{ active, drafts, total, pipeline }, inbox, activity] =
    await Promise.all([
      fetchKpis(),
      fetchInboxKpis(),
      fetchRecentActivity(),
    ]);

  const KPIS: {
    label: string;
    value: string | number;
    href?: string;
    note?: string;
  }[] = [
    {
      label: "Active listings",
      value: active ?? "—",
      href: "/admin/properties?status=published",
    },
    {
      label: "Drafts",
      value: drafts ?? "—",
      href: "/admin/properties?status=draft",
    },
    {
      label: "New enquiries (24h)",
      value: inbox.new_enquiries_today,
      href: "/admin/enquiries",
    },
    {
      label: "Hot leads",
      value: inbox.hot,
      href: "/admin/enquiries?temperature=hot",
    },
  ];

  return (
    <CmsShell
      title="Dashboard"
      breadcrumbs="Workspace"
      primary={
        <Button asChild size="sm">
          <Link href="/admin/properties/new">
            <Plus size={13} strokeWidth={1.8} />
            New property
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div>
          <Eyebrow>Workspace</Eyebrow>
          <h1
            className="serif text-[32px] font-normal mt-2"
            style={{ letterSpacing: "-0.025em" }}
          >
            Good morning, advisor.
          </h1>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {KPIS.map((kpi) => {
            const content = (
              <>
                <div className="text-[12px] text-bz-muted">{kpi.label}</div>
                <div
                  className="text-[28px] font-medium mt-1 text-bz-navy"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {kpi.value}
                </div>
                {kpi.note ? (
                  <div className="text-[11.5px] text-bz-muted-2 mt-2">
                    {kpi.note}
                  </div>
                ) : null}
              </>
            );
            return kpi.href ? (
              <Link
                key={kpi.label}
                href={kpi.href}
                className="p-5 border border-bz-border rounded-lg bg-bz-surface hover:border-bz-border-strong transition-colors"
              >
                {content}
              </Link>
            ) : (
              <div
                key={kpi.label}
                className="p-5 border border-bz-border rounded-lg bg-bz-surface"
              >
                {content}
              </div>
            );
          })}
        </div>

        {/* Pipeline chart */}
        <PipelineBarChart counts={pipeline} />

        {/* Activity feed + properties summary */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <ActivityFeed entries={activity} />
          <div className="p-6 border border-bz-border rounded-lg bg-bz-surface">
            <Eyebrow>Catalogue</Eyebrow>
            <h2
              className="serif text-[20px] mt-2 mb-3"
              style={{ letterSpacing: "-0.012em" }}
            >
              Properties
            </h2>
            <p className="text-[13px] text-bz-ink-2 leading-relaxed">
              {total ?? 0} total listings, {active ?? 0} live on the
              marketplace, {drafts ?? 0} draft.
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link href="/admin/properties">Open properties</Link>
            </Button>
          </div>
        </div>
      </div>
    </CmsShell>
  );
}
