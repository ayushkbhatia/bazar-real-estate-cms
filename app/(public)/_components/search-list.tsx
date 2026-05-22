import Link from "next/link";
import { ListingCard } from "@/components/brand/listing-card";
import { Eyebrow } from "@/components/brand/eyebrow";
import {
  listPublishedProperties,
  formatPriceAED,
  getSavedPropertyIds,
  propertyUrl,
  type ListingRow,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { getSessionUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  countActiveFilters,
  describeFilters,
  PAGE_SIZE,
  type PropertyFilters,
} from "@/lib/filters/property";
import type { Database } from "@/db/types";
import { FilterBar, type AreaOption } from "./filter-bar";
import type { MapPin } from "./map-view";
import { MapViewClient } from "./map-view-client";
import { SortDropdown } from "./sort-dropdown";
import { ViewToggle, type SearchView } from "./view-toggle";
import { MoreFiltersDrawer } from "./more-filters-drawer";
import { Pagination } from "./pagination";

type Mode = Database["public"]["Enums"]["property_mode"];

const MODE_COPY: Record<
  Mode,
  { eyebrow: string; title: string; lede: string }
> = {
  buy: {
    eyebrow: "For sale",
    title: "Properties for sale",
    lede: "Curated freehold and leasehold listings across the United Arab Emirates.",
  },
  rent: {
    eyebrow: "For rent",
    title: "Properties for rent",
    lede: "Long-let homes from advisor-vetted landlords. Furnished and unfurnished.",
  },
  off_plan: {
    eyebrow: "Off-plan",
    title: "New developments",
    lede: "Pre-launch and on-sale developments from Abu Dhabi's leading developers.",
  },
  commercial: {
    eyebrow: "Commercial",
    title: "Commercial real estate",
    lede: "Office, retail, and industrial leases and freeholds.",
  },
};

function badgeFor(row: ListingRow):
  | { label: string; kind: "ink" | "accent" }
  | undefined {
  if (row.flags?.exclusive) return { label: "Exclusive", kind: "ink" };
  if (row.flags?.vacant_on_transfer)
    return { label: "Vacant on transfer", kind: "accent" };
  return undefined;
}

async function fetchAreas(): Promise<AreaOption[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("areas")
    .select("slug, name, kind")
    .in("kind", ["area", "sub_community"])
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data.map((d) => ({ slug: d.slug, name: d.name }));
}

export async function SearchList({
  mode,
  filters,
  view = "grid",
  searchParams,
}: {
  mode: Mode;
  filters: PropertyFilters;
  view?: SearchView;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const [{ rows, total }, areas, user] = await Promise.all([
    listPublishedProperties({ mode, filters, limit: PAGE_SIZE, offset }),
    fetchAreas(),
    getSessionUser(),
  ]);
  const savedSet = await getSavedPropertyIds(rows.map((r) => r.id));
  const isAuthed = user !== null;
  const copy = MODE_COPY[mode];

  const selectedArea =
    filters.area && areas.length
      ? (areas.find((a) => a.slug === filters.area)?.name ?? filters.area)
      : undefined;
  const activeCount = countActiveFilters(filters);
  const filterSummary = describeFilters(filters, selectedArea);

  const firstShown = total === 0 ? 0 : offset + 1;
  const lastShown = Math.min(offset + rows.length, total);

  return (
    <div>
      <section className="px-12 pt-16 pb-10 border-b border-bz-border">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1
          className="serif text-[56px] font-normal mt-2 max-w-[24ch]"
          style={{ letterSpacing: "-0.025em" }}
        >
          {copy.title}
        </h1>
        <p className="mt-4 text-[15px] text-bz-muted max-w-[60ch]">
          {copy.lede}
        </p>
      </section>

      <FilterBar mode={mode} areas={areas} isAuthed={isAuthed} />

      <section className="px-12 py-10">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="text-[13px] text-bz-muted">
            {total > 0
              ? `${firstShown}–${lastShown} of ${total.toLocaleString()} properties`
              : "0 properties"}
            {filterSummary ? (
              <>
                {" · "}
                <span className="text-bz-ink-2">{filterSummary}</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <MoreFiltersDrawer />
            <SortDropdown />
            <ViewToggle />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="py-20 text-center text-bz-muted">
            {activeCount > 0
              ? "No properties match those filters. Try widening the price range or clearing a filter."
              : "No properties to show yet — seed the database to see real listings."}
          </div>
        ) : view === "map" ? (
          <div className="rounded-lg overflow-hidden border border-bz-border h-[640px]">
            <MapViewClient
              pins={rows
                .filter(
                  (
                    r,
                  ): r is typeof r & { geo: { lat: number; lng: number } } =>
                    r.geo !== null &&
                    typeof r.geo.lat === "number" &&
                    typeof r.geo.lng === "number",
                )
                .map(
                  (r): MapPin => ({
                    id: r.id,
                    reference: r.reference,
                    slug: r.slug,
                    title: r.title,
                    price_aed: r.price_aed,
                    geo: r.geo,
                  }),
                )}
              className="w-full h-full"
            />
          </div>
        ) : view === "list" ? (
          <div className="flex flex-col gap-4">
            {rows.map((row, index) => {
              const badge = badgeFor(row);
              return (
                <Link
                  key={row.reference}
                  href={propertyUrl(row)}
                  className="block"
                >
                  <ListingCard
                    variant="row"
                    price={formatPriceAED(row.price_aed)}
                    title={row.title}
                    location={row.areas?.name ?? "United Arab Emirates"}
                    beds={row.beds}
                    baths={row.baths}
                    area={row.built_up_ft2 ?? 0}
                    badge={badge?.label}
                    badgeKind={badge?.kind}
                    imgLabel={row.reference}
                    heroSrc={
                      row.hero ? mediaPublicUrl(row.hero.storage_key) : null
                    }
                    heroAlt={row.hero?.alt_text ?? row.title}
                    priority={index < 2}
                    propertyId={row.id}
                    initialSaved={savedSet.has(row.id)}
                    isAuthed={isAuthed}
                    verified={Boolean((row.flags as Record<string, unknown> | null)?.verified)}
                    compareEnabled
                  />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_500px] gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
              {rows.map((row, index) => {
                const badge = badgeFor(row);
                const priority = index < 2;
                return (
                  <Link
                    key={row.reference}
                    href={propertyUrl(row)}
                    className="block"
                  >
                    <ListingCard
                      price={formatPriceAED(row.price_aed)}
                      title={row.title}
                      location={row.areas?.name ?? "United Arab Emirates"}
                      beds={row.beds}
                      baths={row.baths}
                      area={row.built_up_ft2 ?? 0}
                      badge={badge?.label}
                      badgeKind={badge?.kind}
                      imgLabel={row.reference}
                      heroSrc={
                        row.hero ? mediaPublicUrl(row.hero.storage_key) : null
                      }
                      heroAlt={row.hero?.alt_text ?? row.title}
                      priority={priority}
                      propertyId={row.id}
                      initialSaved={savedSet.has(row.id)}
                      isAuthed={isAuthed}
                      verified={Boolean((row.flags as Record<string, unknown> | null)?.verified)}
                      compareEnabled
                    />
                  </Link>
                );
              })}
            </div>
            <aside className="hidden lg:block sticky top-[64px] self-start h-[calc(100vh-64px-48px)] rounded-lg overflow-hidden border border-bz-border">
              <MapViewClient
                pins={rows
                  .filter(
                    (
                      r,
                    ): r is typeof r & { geo: { lat: number; lng: number } } =>
                      r.geo !== null &&
                      typeof r.geo.lat === "number" &&
                      typeof r.geo.lng === "number",
                  )
                  .map(
                    (r): MapPin => ({
                      id: r.id,
                      reference: r.reference,
                      slug: r.slug,
                      title: r.title,
                      price_aed: r.price_aed,
                      geo: r.geo,
                    }),
                  )}
                className="w-full h-full"
              />
            </aside>
          </div>
        )}

        <Pagination
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          searchParams={searchParams}
        />
      </section>
    </div>
  );
}
