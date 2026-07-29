import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink, LayoutList } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  developmentUrl,
  getDevelopmentForAdmin,
} from "@/lib/queries/developments";
import type { DevelopmentEditInput } from "@/lib/schemas/development";
import { DevelopmentEditForm } from "./_form";
import { PublishCard } from "./_publish-card";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function fetchDevelopers() {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("developers")
    .select("id, name")
    .order("name", { ascending: true });
  return data ?? [];
}

async function fetchAreas() {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("areas")
    .select("id, name, kind")
    .order("kind", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
}

export default async function AdminDevelopmentEditPage({ params }: PageProps) {
  const { id } = await params;
  const [development, developers, areas] = await Promise.all([
    getDevelopmentForAdmin(id),
    fetchDevelopers(),
    fetchAreas(),
  ]);
  if (!development) notFound();

  const initial: DevelopmentEditInput = {
    name: development.name,
    slug: development.slug,
    status: development.status,
    developer_id: development.developer_id,
    area_id: development.area_id,
    handover_date: development.handover_date,
    total_units: development.total_units,
    starting_price:
      development.starting_price != null
        ? Number(development.starting_price)
        : null,
    tagline: development.tagline,
    bedrooms_text: development.bedrooms_text,
    description: development.description,
    vision: development.vision,
    escrow_account: development.escrow_account,
  };

  const isPublished = development.published_at != null;

  return (
    <CmsShell
      title={development.name}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link
            href="/admin/developments"
            className="hover:text-bz-ink"
          >
            Developments
          </Link>
          <ChevronRight size={11} />
          <span className="mono">{development.slug}</span>
        </span>
      }
      secondary={
        <span className="inline-flex items-center gap-4">
          {/* This page edits the project's facts. How its public page reads —
              section order, copy, imagery — is the page editor. */}
          <Link
            href={`/admin/pages/sub/development/${development.slug}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
          >
            <LayoutList size={12} />
            Edit page layout
          </Link>
          {isPublished ? (
            <Link
              href={developmentUrl(development)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
            >
              View on site
              <ExternalLink size={12} />
            </Link>
          ) : null}
        </span>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <DevelopmentEditForm
            developmentId={development.id}
            initial={initial}
            developers={developers}
            areas={areas}
          />
        </div>
        <aside className="sticky top-6">
          <PublishCard
            developmentId={development.id}
            publishedAt={development.published_at}
          />
        </aside>
      </div>
    </CmsShell>
  );
}
