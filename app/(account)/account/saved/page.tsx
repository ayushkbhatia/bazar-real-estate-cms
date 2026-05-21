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
import { mediaPublicUrl } from "@/lib/media";
import { describeFilters, parseFilters } from "@/lib/filters/property";
import { DeleteSavedSearchButton } from "./_delete-button";

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
  const base = s.mode === "rent" ? "/rent" : "/buy";
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function SavedPage() {
  const ids = await fetchSavedPropertyIds();
  const [savedProps, savedSearches] = await Promise.all([
    listPropertiesByIds(ids),
    fetchSavedSearches(),
  ]);

  return (
    <div className="flex flex-col gap-14">
      <header>
        <Eyebrow>Saved</Eyebrow>
        <h1
          className="serif text-[48px] font-normal mt-2"
          style={{ letterSpacing: "-0.025em" }}
        >
          Your saved properties.
        </h1>
        <p className="mt-3 text-[14px] text-bz-muted max-w-[60ch]">
          Heart a listing anywhere on the marketplace to keep it here. Save a
          search and we&apos;ll send you new matches at your chosen cadence.
        </p>
      </header>

      <section>
        <div className="flex items-baseline justify-between mb-6">
          <h2
            className="serif text-[24px] font-normal"
            style={{ letterSpacing: "-0.02em" }}
          >
            Properties
            <span className="text-bz-muted ml-2 text-[14px]">
              {savedProps.length}
            </span>
          </h2>
        </div>
        {savedProps.length === 0 ? (
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
          <div className="grid grid-cols-3 gap-6">
            {savedProps.map((row) => (
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
                  imgLabel={row.reference}
                  heroSrc={
                    row.hero ? mediaPublicUrl(row.hero.storage_key) : null
                  }
                  heroAlt={row.hero?.alt_text ?? row.title}
                  propertyId={row.id}
                  initialSaved
                  isAuthed
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-6">
          <h2
            className="serif text-[24px] font-normal"
            style={{ letterSpacing: "-0.02em" }}
          >
            Searches
            <span className="text-bz-muted ml-2 text-[14px]">
              {savedSearches.length}
            </span>
          </h2>
        </div>
        {savedSearches.length === 0 ? (
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
                    <div className="text-[14px] font-medium truncate">
                      {s.name}
                    </div>
                    <div className="text-[12px] text-bz-muted mt-1 truncate">
                      {summary} · alerts{" "}
                      <span className="text-bz-ink-2">
                        {s.alert_frequency}
                      </span>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={searchHref(s)}>Run search</Link>
                  </Button>
                  <DeleteSavedSearchButton id={s.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
