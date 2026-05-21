import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { fetchInboxKpis } from "@/lib/queries/enquiries";

async function fetchKpis() {
  if (!isSupabaseConfigured)
    return { active: null, drafts: null, total: null };
  try {
    const supabase = await createSupabaseServerClient();
    const [{ count: active }, { count: drafts }, { count: total }] = await Promise.all([
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
    ]);
    return { active, drafts, total };
  } catch (e) {
    console.error("[admin/dashboard] kpis", e);
    return { active: null, drafts: null, total: null };
  }
}

export default async function AdminDashboardPage() {
  const [{ active, drafts, total }, inbox] = await Promise.all([
    fetchKpis(),
    fetchInboxKpis(),
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
    <CmsShell title="Dashboard" breadcrumbs="Workspace">
      <div className="flex flex-col gap-8">
        <div>
          <Eyebrow>Workspace</Eyebrow>
          <h1
            className="serif text-[32px] font-normal mt-2"
            style={{ letterSpacing: "-0.025em" }}
          >
            Good morning, advisor.
          </h1>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {KPIS.map((kpi) => {
            const content = (
              <>
                <div className="text-[12px] text-bz-muted">{kpi.label}</div>
                <div
                  className="text-[28px] font-medium mt-1"
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

        <div className="grid grid-cols-2 gap-4">
          <div className="p-6 border border-bz-border rounded-lg bg-bz-surface">
            <Eyebrow>Inbox</Eyebrow>
            <h2
              className="serif text-[20px] mt-2 mb-3"
              style={{ letterSpacing: "-0.02em" }}
            >
              Lead pipeline
            </h2>
            <ul className="text-[13px] text-bz-ink-2 leading-relaxed grid grid-cols-2 gap-y-2">
              <li>Unassigned: <span className="text-bz-ink">{inbox.unassigned}</span></li>
              <li>Hot: <span className="text-bz-ink">{inbox.hot}</span></li>
            </ul>
            <Button asChild variant="outline" className="mt-5">
              <Link href="/admin/enquiries">Open inbox</Link>
            </Button>
          </div>
          <div className="p-6 border border-bz-border rounded-lg bg-bz-surface">
            <Eyebrow>Catalogue</Eyebrow>
            <h2
              className="serif text-[20px] mt-2 mb-3"
              style={{ letterSpacing: "-0.02em" }}
            >
              Properties
            </h2>
            <p className="text-[13px] text-bz-ink-2 leading-relaxed">
              {total ?? 0} total listings, {active ?? 0} live on the marketplace.
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
