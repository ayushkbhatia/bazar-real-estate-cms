import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, isMapboxConfigured } from "@/lib/env";
import { propertyUrl } from "@/lib/queries/properties";
import { currentStaffRow } from "@/lib/queries/staff";
import { listActiveAgents, type ActiveAgent } from "@/lib/queries/staff-agents";
import { PresenceBanner } from "@/lib/realtime/presence-banner";
import { PresencePile } from "@/lib/realtime/presence-pile";
import { type PropertyEditInput } from "@/lib/schemas/property";
import {
  PropertyEditForm,
  type AreaOption,
  type DeveloperOption,
} from "./_form";
import {
  PropertyMediaLibrary,
  type PropertyMediaItem,
} from "./_media-library";
import { PublishCard, type PublishInput } from "./_publish-card";
import { AssignedAgentCard } from "./_components/assigned-agent-card";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function fetchPropertyForEdit(id: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, reference, slug, title, short_description, type, mode, status, price_aed, service_charge_per_ft2, beds, baths, built_up_ft2, plot_ft2, year_built, tenure, furnishing, view, orientation, parking_bays, floor, address_line, listing_permit_no, listing_permit_expires_at, dld_plot_number, area_id, developer_id, amenities, seo, assigned_agent_id, geo",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function fetchDevelopers(): Promise<DeveloperOption[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developers")
    .select("id, name")
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data as DeveloperOption[];
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

/** Every photo attached to this property, in display order — for the media
 *  library. Hero is one row (role='hero') among them, not a separate fetch. */
async function fetchPropertyMedia(
  propertyId: string,
): Promise<PropertyMediaItem[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("property_media")
    .select(
      "media_id, role, sort_order, media_assets:media_id(id, storage_key, alt_text)",
    )
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: true });

  type Row = {
    role: PropertyMediaItem["role"];
    sort_order: number;
    media_assets:
      | { id: string; storage_key: string; alt_text: string | null }
      | null;
  };

  return ((data as Row[] | null) ?? [])
    .filter((r) => r.media_assets !== null)
    .map((r) => ({
      id: r.media_assets!.id,
      storage_key: r.media_assets!.storage_key,
      alt_text: r.media_assets!.alt_text,
      role: r.role,
      sort_order: r.sort_order,
    }));
}

/**
 * Ensure `assignedId` (if set) appears in the options even when they're no
 * longer an active agent — otherwise the picker would misrepresent an existing
 * assignment as "Unassigned".
 */
async function withCurrentAgent(
  activeAgents: ActiveAgent[],
  assignedId: string | null,
): Promise<ActiveAgent[]> {
  if (!assignedId || activeAgents.some((a) => a.user_id === assignedId)) {
    return activeAgents;
  }
  if (!isSupabaseConfigured) return activeAgents;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("staff")
    .select("user_id, display_name, title, photo_url")
    .eq("user_id", assignedId)
    .maybeSingle();
  if (!data) return activeAgents;
  return [
    {
      user_id: data.user_id,
      display_name: `${data.display_name} (inactive)`,
      title: data.title,
      photo_url: data.photo_url,
    },
    ...activeAgents,
  ];
}

export default async function PropertyEditPage({ params }: PageProps) {
  const { id } = await params;
  const [property, areas, developers, media, activeAgents] = await Promise.all([
    fetchPropertyForEdit(id),
    fetchAreas(),
    fetchDevelopers(),
    fetchPropertyMedia(id),
    listActiveAgents(),
  ]);
  if (!property) notFound();

  // Keep the currently-assigned agent selectable even if they've since gone
  // inactive, so the picker shows the real assignee instead of "Unassigned".
  const assignedAgentId = (property as { assigned_agent_id: string | null })
    .assigned_agent_id;
  const agentOptions = await withCurrentAgent(activeAgents, assignedAgentId);

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
    developer_id: property.developer_id ?? "",
    amenities: property.amenities ?? [],
    slug: property.slug,
    meta_title: (seo.meta_title as string | null) ?? null,
    meta_description: (seo.meta_description as string | null) ?? null,
  };

  const rawGeo = (property as { geo: unknown }).geo as
    | { lat?: unknown; lng?: unknown }
    | null;
  const geo =
    rawGeo &&
    typeof rawGeo.lat === "number" &&
    typeof rawGeo.lng === "number"
      ? { lat: rawGeo.lat, lng: rawGeo.lng }
      : null;

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

  // Raw inputs for the publish gate. The PublishCard renders the checklist
  // from these; every value is server truth, so the card re-reads on
  // `router.refresh()` after a save.
  const publishInput: PublishInput = {
    status: property.status,
    has_developer: initial.developer_id !== "",
    listing_permit_no: property.listing_permit_no,
    listing_permit_expires_at: property.listing_permit_expires_at,
    slug: property.slug,
    title: property.title,
    price_aed: Number(property.price_aed),
  };

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
          <PropertyMediaLibrary propertyId={property.id} initial={media} />
          <PropertyEditForm
            propertyId={property.id}
            initial={initial}
            reference={property.reference}
            areas={areas}
            developers={developers}
            geo={geo}
            mapboxAvailable={isMapboxConfigured}
          />
        </div>
        <aside className="sticky top-6 flex flex-col gap-6">
          <AssignedAgentCard
            propertyId={property.id}
            agents={agentOptions}
            value={assignedAgentId}
          />
          <PublishCard
            propertyId={property.id}
            status={property.status}
            input={publishInput}
          />
        </aside>
      </div>
    </CmsShell>
  );
}
