import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { propertyUrl } from "@/lib/queries/properties";
import type { PropertyEditInput } from "@/lib/schemas/property";
import { PropertyEditForm, type AreaOption } from "./_form";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function fetchPropertyForEdit(id: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, reference, slug, title, short_description, type, mode, status, price_aed, service_charge_per_ft2, beds, baths, built_up_ft2, plot_ft2, year_built, tenure, furnishing, view, orientation, parking_bays, floor, address_line, listing_permit_no, listing_permit_expires_at, dld_plot_number, area_id, amenities, seo",
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

export default async function PropertyEditPage({ params }: PageProps) {
  const { id } = await params;
  const [property, areas] = await Promise.all([
    fetchPropertyForEdit(id),
    fetchAreas(),
  ]);
  if (!property) notFound();

  const seo = (property.seo as Record<string, unknown> | null) ?? {};

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
    >
      <PropertyEditForm
        propertyId={property.id}
        initial={initial}
        reference={property.reference}
        areas={areas}
      />
    </CmsShell>
  );
}
