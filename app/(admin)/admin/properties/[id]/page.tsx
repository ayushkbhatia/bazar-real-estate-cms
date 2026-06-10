import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { propertyUrl } from "@/lib/queries/properties";
import { currentStaffRow } from "@/lib/queries/staff";
import { PresenceBanner } from "@/lib/realtime/presence-banner";
import { PresencePile } from "@/lib/realtime/presence-pile";
import {
  type PropertyEditInput,
  normaliseCompliance,
  type PropertyCompliance,
} from "@/lib/schemas/property";
import { evaluatePublishability } from "@/lib/publishability";
import { PropertyEditForm, type AreaOption } from "./_form";
import {
  HeroPicker,
  type HeroState,
  type MediaOption,
} from "./_hero-picker";
import { PublishCard } from "./_publish-card";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function fetchPropertyForEdit(id: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, reference, slug, title, short_description, type, mode, status, price_aed, service_charge_per_ft2, beds, baths, built_up_ft2, plot_ft2, year_built, tenure, furnishing, view, orientation, parking_bays, floor, address_line, listing_permit_no, listing_permit_expires_at, dld_plot_number, area_id, amenities, seo, compliance",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function fetchAreas(): Promise<AreaOption[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("areas")
    .select("id, name, kind")
    .order("kind", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data as AreaOption[];
}

async function fetchHeroAndMedia(
  propertyId: string,
): Promise<{ hero: HeroState; media: MediaOption[] }> {
  if (!isSupabaseConfigured) return { hero: null, media: [] };
  const supabase = await createSupabaseServerClient();

  const [{ data: heroJoin }, { data: media }] = await Promise.all([
    supabase
      .from("property_media")
      .select("media_id, media_assets:media_id(id, storage_key, filename)")
      .eq("property_id", propertyId)
      .eq("role", "hero")
      .maybeSingle(),
    supabase
      .from("media_assets")
      .select("id, storage_key, filename, mime_type")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  let hero: HeroState = null;
  const heroRow = (
    heroJoin as
      | {
          media_assets:
            | { id: string; storage_key: string; filename: string }
            | null;
        }
      | null
  )?.media_assets;
  if (heroRow) {
    hero = {
      id: heroRow.id,
      storage_key: heroRow.storage_key,
      filename: heroRow.filename,
    };
  }

  return {
    hero,
    media: (media ?? []) as MediaOption[],
  };
}

export default async function PropertyEditPage({ params }: PageProps) {
  const { id } = await params;
  const [property, areas, heroAndMedia] = await Promise.all([
    fetchPropertyForEdit(id),
    fetchAreas(),
    fetchHeroAndMedia(id),
  ]);
  if (!property) notFound();

  const seo = (property.seo as Record<string, unknown> | null) ?? {};
  const compliance: PropertyCompliance = normaliseCompliance(
    property.compliance as Record<string, unknown> | null,
  );

  const initial: PropertyEditInput = {
    title: property.title,
    short_description: property.short_description,
    type: property.type,
    mode: property.mode,
    price_aed: Number(property.price_aed),
    service_charge_per_ft2:
      property.service_charge_per_ft2 != null
        ? Number(property.service_charge_per_ft2)
        : null,
    beds: property.beds,
    baths: property.baths,
    built_up_ft2: property.built_up_ft2,
    plot_ft2: property.plot_ft2,
    year_built: property.year_built,
    tenure: property.tenure,
    furnishing: property.furnishing,
    view: property.view,
    orientation: property.orientation,
    parking_bays: property.parking_bays,
    floor: property.floor,
    address_line: property.address_line,
    listing_permit_no: property.listing_permit_no,
    listing_permit_expires_at: property.listing_permit_expires_at,
    dld_plot_number: property.dld_plot_number,
    area_id: property.area_id,
    amenities: property.amenities ?? [],
    slug: property.slug,
    meta_title: (seo.meta_title as string | null) ?? null,
    meta_description: (seo.meta_description as string | null) ?? null,
  };

  const isPublished = property.status === "published";

  // Used by presence — null when the viewer isn't on the staff table.
  const me = await currentStaffRow();
  const presenceSelf = me
    ? {
        user_id: me.user_id,
        display_name: me.display_name,
        joined_at: new Date().toISOString(),
        photo_url: me.photo_url ?? null,
      }
    : null;

  const publishability = evaluatePublishability({
    status: property.status,
    has_hero: heroAndMedia.hero !== null,
    listing_permit_no: property.listing_permit_no,
    listing_permit_expires_at: property.listing_permit_expires_at,
    slug: property.slug,
    title: property.title,
    price_aed: Number(property.price_aed),
    compliance,
  });

  return (
    <CmsShell
      title={property.title}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/properties" className="hover:text-bz-ink">
            Properties
          </Link>
          <ChevronRight size={11} />
          <span className="mono">{property.reference}</span>
        </span>
      }
      secondary={
        isPublished ? (
          <Link
            href={propertyUrl(property)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
          >
            View on site
            <ExternalLink size={12} />
          </Link>
        ) : null
      }
      live={
        presenceSelf ? (
          <PresencePile
            channel={`presence:property:${property.id}`}
            self={presenceSelf}
          />
        ) : null
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          {presenceSelf ? (
            <PresenceBanner
              channel={`presence:property:${property.id}`}
              self={presenceSelf}
            />
          ) : null}
          <HeroPicker
            propertyId={property.id}
            initial={heroAndMedia.hero}
            media={heroAndMedia.media}
          />
          <PropertyEditForm
            propertyId={property.id}
            initial={initial}
            reference={property.reference}
            areas={areas}
          />
        </div>
        <aside className="sticky top-6">
          <PublishCard
            propertyId={property.id}
            status={property.status}
            compliance={compliance}
            checks={publishability.checks}
            publishable={publishability.ok}
          />
        </aside>
      </div>
    </CmsShell>
  );
}
