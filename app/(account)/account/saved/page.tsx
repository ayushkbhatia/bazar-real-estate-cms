import Link from "next/link";

import { Eyebrow } from "@/components/brand/eyebrow";
import { ListingCard } from "@/components/brand/listing-card";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  formatPriceAED,
  listPropertiesByIds,
  propertyUrl,
} from "@/lib/queries/properties";
import { listRecentlyViewed } from "@/lib/queries/recently-viewed";
import { listTourRequests } from "@/lib/queries/tour-requests";
import { mediaPublicUrl } from "@/lib/media";
import { describeFilters, parseFilters } from "@/lib/filters/property";
import { DeleteSavedSearchButton } from "./_delete-button";
import { FrequencyPicker } from "../alerts/_frequency-picker";
import { SavedTabs, type SavedTab } from "./_components/tabs";

export const dynamic = "force-dynamic";

type SavedSearchRow = {
  id: string;
  name: string;
  mode: "buy" | "rent" | "off_plan" | "commercial" | null;
  query: Record<string, unknown> | null;
  alert_frequency: "off" | "instant" | "daily" | "weekly";
  created_at: string;
};

async function fetchSavedPropertyIds(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("saved_properties")
    .select("property_id")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => r.property_id);
}

async function fetchSavedSearches(): Promise<SavedSearchRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, name, mode, query, alert_frequency, created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as SavedSearchRow[];
}

function searchHref(s: SavedSearchRow): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(s.query ?? {})) {
    if (v != null && v !== "") params.set(k, String(v));
  }
  const base =
    s.mode === "rent"
      ? "/rent/search"
      : s.mode === "off_plan"
        ? "/off-plan/search"
        : s.mode === "commercial"
          ? "/commercial"
          : "/buy/search";
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function SavedPage() {
  const ids = await fetchSavedPropertyIds();
  // Resolve current user id for recently-viewed / tour-requests reads.
  let userId: string | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }
  const [savedProps, savedSearches, recentlyViewed, tourRequests] =
    await Promise.all([
      listPropertiesByIds(ids),
      fetchSavedSearches(),
      userId ? listRecentlyViewed(userId, 20) : Promise.resolve([]),
      userId ? listTourRequests(userId) : Promise.resolve([]),
    ]);

  const counts: Record<SavedTab, number> = {
    properties: savedProps.length,
    searches: savedSearches.length,
    recent: recentlyViewed.length,
    tours: tourRequests.length,
  };

  const propertiesPanel =
    savedProps.length === 0 ? (
      <div className="bg-bz-surface border border-bz-border rounded-lg p-10 text-center text-bz-muted">
        Nothing saved yet.{" "}
        <Link
          href="/buy"
          className="underline text-bz-ink-2 hover:text-bz-ink"
        >
          Browse the marketplace
        </Link>
        .
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {savedProps.map((row) => (
          <Link key={row.reference} href={propertyUrl(row)} className="block">
            <ListingCard
              price={formatPriceAED(row.price_aed)}
              title={row.title}
              location={row.areas?.name ?? "United Arab Emirates"}
              beds={row.beds}
              baths={row.baths}
              area={row.built_up_ft2 ?? 0}
              imgLabel={row.reference}
              heroSrc={row.hero ? mediaPublicUrl(row.hero.storage_key) : null}
              heroAlt={row.hero?.alt_text ?? row.title}
              propertyId={row.id}
              initialSaved
              isAuthed
              compareEnabled
            />
          </Link>
        ))}
      </div>
    );

  const searchesPanel =
    savedSearches.length === 0 ? (
      <div className="bg-bz-surface border border-bz-border rounded-lg p-10 text-center text-bz-muted">
        Save a search from{" "}
        <Link href="/buy" className="underline text-bz-ink-2">
          /buy
        </Link>{" "}
        or{" "}
        <Link href="/rent" className="underline text-bz-ink-2">
          /rent
        </Link>{" "}
        to track new matches automatically.
      </div>
    ) : (
      <ul className="flex flex-col gap-3">
        {savedSearches.map((s) => {
          const parsed = parseFilters(s.query ?? {});
          const summary =
            describeFilters(parsed) ||
            (s.mode === "rent" ? "All rentals" : "All for-sale listings");
          return (
            <li
              key={s.id}
              className="flex items-center gap-4 bg-bz-surface border border-bz-border rounded-lg p-4"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium truncate">{s.name}</div>
                <div className="text-[12px] text-bz-muted mt-1 truncate">
                  {summary}
                </div>
              </div>
              <FrequencyPicker id={s.id} initial={s.alert_frequency} />
              <Button asChild variant="outline" size="sm">
                <Link href={searchHref(s)}>Run</Link>
              </Button>
              <DeleteSavedSearchButton id={s.id} />
            </li>
          );
        })}
      </ul>
    );

  const recentPanel =
    recentlyViewed.length === 0 ? (
      <div className="bg-bz-surface border border-dashed border-bz-border rounded-lg p-12 text-center max-w-[60ch] mx-auto">
        <Eyebrow className="text-bz-muted">Recently viewed</Eyebrow>
        <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed">
          Listings you open will land here.
        </p>
        <Button asChild className="mt-6">
          <Link href="/buy">Browse listings</Link>
        </Button>
      </div>
    ) : (
      <ul className="flex flex-col divide-y divide-bz-border bg-bz-surface border border-bz-border rounded-lg">
        {recentlyViewed.map((r) => (
          <li key={r.property_id} className="p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <Link
                href={`/p/${r.slug}`}
                className="text-[14px] text-bz-ink hover:text-bz-accent transition-colors truncate block"
              >
                {r.title}
              </Link>
              <div className="mt-1 text-[11.5px] mono text-bz-muted">
                {r.reference} · AED {Number(r.price_aed).toLocaleString()}
              </div>
            </div>
            <div className="text-[11px] text-bz-muted whitespace-nowrap">
              {new Date(r.viewed_at).toLocaleDateString()}
            </div>
          </li>
        ))}
      </ul>
    );

  const toursPanel =
    tourRequests.length === 0 ? (
      <div className="bg-bz-surface border border-dashed border-bz-border rounded-lg p-12 text-center max-w-[60ch] mx-auto">
        <Eyebrow className="text-bz-muted">Tour requests</Eyebrow>
        <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed">
          Viewing requests you submit from any listing land here.
        </p>
        <Button asChild className="mt-6">
          <Link href="/account/viewings">View scheduled viewings</Link>
        </Button>
      </div>
    ) : (
      <ul className="flex flex-col divide-y divide-bz-border bg-bz-surface border border-bz-border rounded-lg">
        {tourRequests.map((t) => (
          <li key={t.id} className="p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-[14px] text-bz-ink truncate">
                {t.property_title ?? t.property_reference ?? "Property"}
              </div>
              <div className="mt-1 text-[11.5px] mono text-bz-muted">
                {t.preferred_window ?? "Window TBD"}
                {t.message ? ` · ${t.message}` : ""}
              </div>
            </div>
            <span
              className={`text-[11px] mono px-2 py-0.5 rounded ${
                t.status === "scheduled"
                  ? "bg-bz-accent/15 text-bz-accent"
                  : t.status === "completed"
                    ? "bg-bz-surface-2 text-bz-muted"
                    : "bg-bz-surface-2 text-bz-ink-2"
              }`}
            >
              {t.status}
            </span>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="flex flex-col gap-10">
      <header>
        <Eyebrow>Saved</Eyebrow>
        <h1
          className="serif text-[30px] md:text-[48px] font-normal mt-2"
          style={{ letterSpacing: "-0.025em" }}
        >
          Your saved properties.
        </h1>
        <p className="mt-3 text-[14px] text-bz-muted max-w-[60ch]">
          Heart a listing anywhere on the marketplace to keep it here. Save a
          search and we&apos;ll send you new matches at your chosen cadence.
        </p>
      </header>

      <SavedTabs
        counts={counts}
        panels={{
          properties: propertiesPanel,
          searches: searchesPanel,
          recent: recentPanel,
          tours: toursPanel,
        }}
      />
    </div>
  );
}
