import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink, LayoutList } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { AreaKind } from "@/lib/schemas/area";
import { AreaRecordForm, type AreaRecord } from "./_form";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function fetchArea(id: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("areas")
    .select("id, name, name_ar, slug, kind, parent_id, description, description_ar, seo_meta, geo")
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function fetchParents() {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("areas")
    .select("id, name, kind")
    .order("kind", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as { id: string; name: string; kind: AreaKind }[];
}

export default async function AreaRecordPage({ params }: PageProps) {
  const { id } = await params;
  const [area, parents] = await Promise.all([fetchArea(id), fetchParents()]);
  if (!area) notFound();

  const seo = (area.seo_meta as Record<string, unknown> | null) ?? {};
  const geo = (area.geo as { lat?: unknown; lng?: unknown } | null) ?? {};

  const initial: AreaRecord = {
    id: area.id,
    name: area.name,
    name_ar: area.name_ar,
    slug: area.slug,
    kind: area.kind as AreaKind,
    parent_id: area.parent_id,
    description: area.description,
    description_ar: area.description_ar,
    meta_title: (seo.meta_title as string | null) ?? null,
    meta_description: (seo.meta_description as string | null) ?? null,
    lat: typeof geo.lat === "number" ? geo.lat : null,
    lng: typeof geo.lng === "number" ? geo.lng : null,
  };

  return (
    <CmsShell
      title={area.name}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <Link href="/admin/pages/sub" className="hover:text-bz-ink">
            Sub-pages
          </Link>
          <ChevronRight size={11} />
          <Link href="/admin/pages/sub/area" className="hover:text-bz-ink">
            Areas
          </Link>
          <ChevronRight size={11} />
          <span className="mono">{area.slug}</span>
        </span>
      }
      secondary={
        <span className="inline-flex items-center gap-4">
          {/* This page holds the area's facts; how its guide reads — section
              order, copy, imagery — is the page editor. */}
          <Link
            href={`/admin/pages/sub/area/${area.slug}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
          >
            <LayoutList size={12} />
            Edit page layout
          </Link>
          <Link
            href={`/areas/${area.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
          >
            View on site
            <ExternalLink size={12} />
          </Link>
        </span>
      }
    >
      <div className="max-w-[860px]">
        <AreaRecordForm initial={initial} parents={parents} />
      </div>
    </CmsShell>
  );
}
