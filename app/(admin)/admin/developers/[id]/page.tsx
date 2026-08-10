import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { getDeveloperRecord } from "@/lib/queries/developers-extras";
import type { MediaOption } from "../../pages/master/[key]/_editor";
import { DeveloperRecordForm } from "./_form";
import { DeveloperLogoCard } from "./_logo-card";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function fetchMedia(): Promise<MediaOption[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("media_assets")
    .select("id, filename, storage_key, mime_type")
    .is("deleted_at", null)
    .like("mime_type", "image/%")
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []).map((m) => ({
    id: m.id,
    filename: m.filename,
    url: mediaPublicUrl(m.storage_key),
    mime: m.mime_type,
  }));
}

/**
 * One developer's record — the facts behind /developers/<slug>.
 *
 * The counterpart to the areas record editor. A developer is referenced by
 * every property and project filed under it, so the page states that count
 * before the operator renames or re-links anything.
 */
export default async function DeveloperRecordPage({ params }: PageProps) {
  const { id } = await params;
  const [record, media] = await Promise.all([
    getDeveloperRecord(id),
    fetchMedia(),
  ]);
  if (!record) notFound();

  return (
    <CmsShell
      title={record.name}
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
          <Link href="/admin/pages/sub/developer" className="hover:text-bz-ink">
            Developers
          </Link>
          <ChevronRight size={11} />
          <span>Record</span>
        </span>
      }
      primary={
        <Link
          href={`/developers/${record.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          View page <ExternalLink size={12} />
        </Link>
      }
    >
      <div className="flex flex-col gap-6 max-w-3xl">
        <p className="text-[12.5px] text-bz-muted">
          {record.property_count} {record.property_count === 1 ? "listing" : "listings"}
          {" · "}
          {record.development_count}{" "}
          {record.development_count === 1 ? "project" : "projects"} filed under
          this developer. Changing the link moves the public page.
        </p>

        <DeveloperRecordForm
          initial={{
            id: record.id,
            name: record.name,
            slug: record.slug,
            description: record.description,
            founded_year: record.founded_year,
          }}
        />

        <DeveloperLogoCard
          developerId={record.id}
          media={media}
          logoId={record.logo_id}
        />
      </div>
    </CmsShell>
  );
}
