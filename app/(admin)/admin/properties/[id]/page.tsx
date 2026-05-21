import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { propertyUrl } from "@/lib/queries/properties";
import type { PropertyEditInput } from "@/lib/schemas/property";
import { PropertyEditForm } from "./_form";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function fetchPropertyForEdit(id: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, reference, slug, title, short_description, type, mode, status, price_aed, service_charge_per_ft2, beds, baths, built_up_ft2, plot_ft2",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export default async function PropertyEditPage({ params }: PageProps) {
  const { id } = await params;
  const property = await fetchPropertyForEdit(id);
  if (!property) notFound();

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
      />
    </CmsShell>
  );
}
