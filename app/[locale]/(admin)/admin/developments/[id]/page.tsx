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
import {
  evaluateDevelopmentHeroFacts,
  type DevelopmentEditInput,
} from "@/lib/schemas/development";
import { listAmenitiesTaxonomy } from "@/lib/queries/amenities-taxonomy";
import { toOptions } from "@/lib/amenities";
import { DevelopmentEditForm } from "./_form";
import { PublishCard } from "../_publish-card";

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
  const [development, developers, areas, taxonomy] = await Promise.all([
    getDevelopmentForAdmin(id),
    fetchDevelopers(),
    fetchAreas(),
    listAmenitiesTaxonomy(),
  ]);
  if (!development) notFound();

  const amenityOptions = toOptions(taxonomy);

  // The twins are mapped here, not just selected. #348 added them to the
  // schema, the selects and the inputs but not to this object, so every field
  // read "— not set" on a project that had Arabic — no data was lost, because
  // an omitted optional key is left alone on update, but it invites an editor
  // to translate the same field twice.
  const initial: DevelopmentEditInput = {
    name: development.name,
    name_ar: development.name_ar,
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
    tagline_ar: development.tagline_ar,
    bedrooms_text: development.bedrooms_text,
    bedrooms_text_ar: development.bedrooms_text_ar,
    description: development.description,
    description_ar: development.description_ar,
    vision: development.vision,
    vision_ar: development.vision_ar,
    escrow_account: development.escrow_account,
    amenities: development.amenities ?? [],
    amenities_ar: development.amenities_ar ?? null,
  };

  const isPublished = development.published_at != null;
  // The same gate the publish action enforces, evaluated here so the card can
  // name what is outstanding instead of failing on click.
  const heroFactsGate = evaluateDevelopmentHeroFacts({
    starting_price: initial.starting_price ?? null,
    bedrooms_text: initial.bedrooms_text ?? null,
    total_units: initial.total_units ?? null,
    handover_date: initial.handover_date ?? null,
  });

  return (
    <CmsShell
      title={development.name}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link
            href="/admin/pages/sub/development"
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
            amenityOptions={amenityOptions}
          />
        </div>
        <aside className="sticky top-6">
          <PublishCard
            developmentId={development.id}
            publishedAt={development.published_at}
            slug={development.slug}
            checks={heroFactsGate.checks}
            fixHref={`/admin/pages/sub/development/${development.slug}`}
          />
        </aside>
      </div>
    </CmsShell>
  );
}
