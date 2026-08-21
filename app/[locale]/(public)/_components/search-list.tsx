import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import {
  listPublishedProperties,
  propertyUrl,
  type ListingRow,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { getSearchHeaderCopy } from "@/lib/queries/search-headers";
import { currentLocale } from "@/lib/i18n/current";
import { localiseRow } from "@/lib/i18n/localise";
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
import { ViewToggle } from "./view-toggle";
import { resolveSearchView } from "./search-view";
import { MoreFiltersDrawer } from "./more-filters-drawer";
import { Pagination } from "./pagination";
import { ModeSegmented } from "./mode-segmented";
import { DrawAreaTool } from "./draw-area-tool";
import { CommuteTimeTool } from "./commute-time-tool";
import { ListingCardPriced } from "./listing-card-priced";

type Mode = Database["public"]["Enums"]["property_mode"];
type Form = Database["public"]["Enums"]["property_form"];

/**
 * Empty state for the form sub-routes. A bare "0 properties" is a dead end on
 * a route this narrow, so we always offer the two widening moves: all sale
 * stock, and off-plan.
 */
function FormEmptyState({
  form,
  activeCount,
}: {
  form: Form;
  activeCount: number;
}) {
  const label =
    form === "resale"
      ? "resale"
      : form === "off_plan"
        ? "off-plan"
        : "ready, never-lived-in";
  return (
    <div className="py-16 md:py-20 max-w-[52ch] mx-auto text-center">
      <p className="serif text-[22px] md:text-[26px] text-bz-ink">
        {activeCount > 0
          ? `No ${label} homes match those filters`
          : `No ${label} homes are listed right now`}
      </p>
      <p className="mt-3 text-[14px] text-bz-muted">
        {activeCount > 0
          ? "Try widening the price range or clearing a filter — or step up to the full sale catalogue, where our advisors can flag matching stock before it publishes."
          : "Our sale catalogue moves quickly. Browse everything currently for sale, or look at what is still under construction."}
      </p>
      <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
        <Link
          href="/buy/search"
          className="inline-flex items-center h-9 px-4 rounded-md bg-bz-navy text-bz-bg text-[13px] font-medium"
        >
          All properties for sale
        </Link>
        {/* The second move widens the axis this route narrowed. On the
            off-plan facet that would point back at itself, so it offers the
            projects instead — those exist in areas with no unit listings. */}
        <Link
          href={form === "off_plan" ? "/off-plan" : "/buy/search?form=off_plan"}
          className="inline-flex items-center h-9 px-4 rounded-md border border-bz-border text-bz-ink-2 text-[13px] hover:border-bz-border-strong"
        >
          {form === "off_plan" ? "Browse off-plan projects" : "Browse off-plan"}
        </Link>
      </div>
    </div>
  );
}

function badgeFor(
  row: ListingRow,
): { label: string; kind: "ink" | "accent" } | undefined {
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
    .select("slug, name, name_ar, kind")
    .in("kind", ["area", "sub_community"])
    .order("name", { ascending: true });
  if (error || !data) return [];
  const locale = await currentLocale();
  /*
   * The LABEL folds; the VALUE does not. This dropdown writes `slug` into the
   * query string and the filter compares against `slug`, so folding the label
   * is safe and folding the value would silently return nothing on /ar — the
   * identity-versus-display split that also bit `communityKey`.
   */
  return data.map((d) => ({
    slug: d.slug,
    name: (
      localiseRow(d as unknown as Record<string, unknown>, locale) as {
        name: string;
      }
    ).name,
  }));
}

/**
 * Breakpoint override for `ListingCard`'s `row` variant, applied here rather
 * than in the component because `components/brand/*` is shared chrome.
 *
 * The variant hard-codes a 280px media column next to a `flex-1` text column
 * with no `min-w-0`. That was fine while list view was an opt-in on desktop;
 * as the phone default it leaves ~60px for the text and pushes the card past
 * the viewport. So: shrink the media column, let the text column shrink below
 * its content width, tighten the padding, and let the beds/baths/ft² row wrap
 * instead of clipping. Everything is back to the component's own numbers at
 * `md:` and up, so desktop list view is untouched.
 */
const ROW_CARD_RESPONSIVE = [
  "[&>div:first-child]:w-[116px]",
  "sm:[&>div:first-child]:w-[200px]",
  "md:[&>div:first-child]:w-[280px]",
  "[&>div:last-child]:min-w-0",
  "[&>div:last-child]:px-3.5",
  "[&>div:last-child]:py-3",
  "md:[&>div:last-child]:px-[22px]",
  "md:[&>div:last-child]:py-[18px]",
  "[&>div:last-child>div:last-child]:flex-wrap",
  "[&>div:last-child>div:last-child]:gap-x-3",
  "[&>div:last-child>div:last-child]:gap-y-1",
].join(" ");

export async function SearchList({
  mode,
  form,
  filters,
  searchParams,
}: {
  mode: Mode;
  /**
   * Optional completion-form narrowing for sale stock (/buy/ready,
   * /buy/resale). Omitted by every other caller, which keeps showing the
   * whole mode.
   */
  form?: Form;
  filters: PropertyFilters;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Resolved here, not per-route: all six callers were parsing `view` out of
  // the same search params with the same six lines, and the device-dependent
  // default made that a sixfold chance of drift.
  const { view, defaultView } = await resolveSearchView(searchParams);
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const offset = (page - 1) * PAGE_SIZE;

  /*
   * The completion form can arrive two ways, and the route wins: /buy/ready is
   * the ready-new page whatever `?form=` says. The URL facet is honoured on
   * /buy/search only — "buy" is the umbrella that spans all three forms, so it
   * is the one surface where narrowing on the second axis means anything.
   * Passing it through on /rent/search would return zero rows by construction
   * (the DB check keeps `property_form` NULL on tenancies).
   */
  const effectiveForm: Form | undefined =
    form ?? (mode === "buy" ? (filters.form ?? undefined) : undefined);

  /*
   * The three lines above the filter bar are CMS content, not catalogue
   * strings — one document per facet, edited at
   * /admin/pages/sub/search/<key>. `form` wins over `mode` inside
   * `searchHeaderFor`, mirroring `effectiveForm` above, so /buy/ready and
   * /buy/resale each get their own h1: a shared heading is what made those two
   * look identical for 27 migrations. Since 0110 `off_plan` is a written form
   * too and carries its own document, so /buy/search?form=off_plan is the
   * off-plan slice *of buy* and must not borrow the /off-plan heading.
   *
   * Blank eyebrow and sub-title are honoured — an editor who clears one means
   * to drop the line — while a blank title falls back to the shipped headline
   * rather than rendering an empty h1.
   */
  const [{ rows, total }, areas, copy] = await Promise.all([
    listPublishedProperties({
      mode,
      form: effectiveForm,
      filters,
      limit: PAGE_SIZE,
      offset,
    }),
    fetchAreas(),
    getSearchHeaderCopy(mode, effectiveForm ?? null),
  ]);
  const t = await getTranslations("search");

  const selectedArea =
    filters.area && areas.length
      ? (areas.find((a) => a.slug === filters.area)?.name ?? filters.area)
      : undefined;
  const activeCount = countActiveFilters(filters);
  const filterSummary = describeFilters(filters, selectedArea);

  const firstShown = total === 0 ? 0 : offset + 1;
  const lastShown = Math.min(offset + rows.length, total);

  return (
    <>
      <section className="px-4 md:px-12 pt-10 md:pt-16 pb-6 md:pb-10 border-b border-bz-border">
        {copy.eyebrow ? <Eyebrow>{copy.eyebrow}</Eyebrow> : null}
        <h1
          className="serif text-[32px] md:text-[56px] font-normal mt-2 max-w-[24ch]"
          style={{ letterSpacing: "-0.025em" }}
        >
          {copy.title}
        </h1>
        {copy.subtitle ? (
          <p className="mt-4 text-[15px] text-bz-muted max-w-[60ch]">
            {copy.subtitle}
          </p>
        ) : null}
      </section>

      <FilterBar mode={mode} areas={areas} />

      <section className="px-4 md:px-12 pt-4 md:pt-6 pb-3 flex items-center gap-3 flex-wrap border-b border-bz-border">
        <ModeSegmented />
        <span className="text-bz-muted text-[11px] hidden md:inline">·</span>
        <DrawAreaTool />
        <CommuteTimeTool />
      </section>

      <section className="px-4 md:px-12 py-8 md:py-10">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="text-[13px] text-bz-muted">
            {total > 0
              ? t("results.range", {
                  first: firstShown,
                  last: lastShown,
                  total: total.toLocaleString(),
                })
              : t("results.none")}
            {filterSummary ? (
              <>
                {" · "}
                <span className="text-bz-ink-2">{filterSummary}</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <MoreFiltersDrawer showForm={mode === "buy" && !form} />
            <SortDropdown />
            <ViewToggle defaultView={defaultView} />
          </div>
        </div>

        {rows.length === 0 ? (
          effectiveForm ? (
            <FormEmptyState form={effectiveForm} activeCount={activeCount} />
          ) : (
            <div className="py-20 text-center text-bz-muted">
              {activeCount > 0
                ? "No properties match those filters. Try widening the price range or clearing a filter."
                : "No properties to show yet — seed the database to see real listings."}
            </div>
          )
        ) : view === "map" ? (
          <div className="rounded-lg overflow-hidden border border-bz-border h-[70vh] md:h-[640px]">
            <MapViewClient
              pins={rows
                .filter(
                  (r): r is typeof r & { geo: { lat: number; lng: number } } =>
                    r.geo !== null &&
                    typeof r.geo.lat === "number" &&
                    typeof r.geo.lng === "number",
                )
                .map((r): MapPin => ({
                  id: r.id,
                  reference: r.reference,
                  slug: r.slug,
                  title: r.title,
                  price_aed: r.price_aed,
                  geo: r.geo,
                }))}
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
                  <ListingCardPriced
                    variant="row"
                    className={ROW_CARD_RESPONSIVE}
                    priceAed={row.price_aed}
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
                    verified={Boolean(
                      (row.flags as Record<string, unknown> | null)?.verified,
                    )}
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
                    <ListingCardPriced
                      priceAed={row.price_aed}
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
                      verified={Boolean(
                        (row.flags as Record<string, unknown> | null)?.verified,
                      )}
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
                  .map((r): MapPin => ({
                    id: r.id,
                    reference: r.reference,
                    slug: r.slug,
                    title: r.title,
                    price_aed: r.price_aed,
                    geo: r.geo,
                  }))}
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
    </>
  );
}
