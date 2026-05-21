import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

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
  const { active, drafts, total } = await fetchKpis();
  const KPIS = [
    { label: "Active listings", value: active ?? "—", href: "/admin/properties?status=published" },
    { label: "Drafts", value: drafts ?? "—", href: "/admin/properties?status=draft" },
    { label: "All properties", value: total ?? "—", href: "/admin/properties" },
    { label: "New enquiries", value: "—", note: "Phase 2" as const },
  ];
  return (
    <CmsShell title="Dashboard" breadcrumbs="Workspace">
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>Phase 0 · Foundations</Eyebrow>
        <h1
          className="serif text-[32px] font-normal mt-2"
          style={{ letterSpacing: "-0.025em" }}
        >
          Good morning, advisor.
        </h1>
        <p className="mt-2 text-[14px] text-bz-muted max-w-[72ch]">
          The CMS shell is wired. Real KPIs and the lead inbox come online in
          Phase 1–2.
        </p>
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
              {"note" in kpi ? (
                <div className="text-[11.5px] text-bz-muted-2 mt-2">
                  {kpi.note}
                </div>
              ) : null}
            </>
          );
          return "href" in kpi && kpi.href ? (
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
      <div className="p-6 border border-bz-border rounded-lg bg-bz-surface">
        <Eyebrow>Next up</Eyebrow>
        <h2
          className="serif text-[20px] mt-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          Phase 1 · Public catalogue
        </h2>
        <ul className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed list-disc pl-5">
          <li>Drizzle/Supabase schema for properties, areas, developers, media</li>
          <li>Property edit form (Overview / Details / Pricing / Location / Amenities / SEO)</li>
          <li>Media library uploads to Supabase Storage</li>
          <li>Public Search page (Buy / Rent) with Mapbox sidebar</li>
          <li>Property detail page</li>
          <li>Meilisearch indexing on publish</li>
        </ul>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/admin/properties">Open properties list</Link>
        </Button>
      </div>
    </div>
    </CmsShell>
  );
}
