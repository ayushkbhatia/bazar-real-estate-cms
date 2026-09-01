import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import {
  listPublishedProperties,
  propertyUrl,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { getSearchHeaderCopy } from "@/lib/queries/search-headers";
import { currentLocale } from "@/lib/i18n/current";
import { localiseRow } from "@/lib/i18n/localise";
import { isSupabaseConfigured } from "@/lib/env";
import { listingBadge } from "@/lib/listing-badge";
import {
  countActiveFilters,
  describeFilters,
  PAGE_SIZE,
  type FilterSummaryLabels,
  type PropertyFilters,
} from "@/lib/filters/property";
import type { Database } from "@/db/types";
import { FilterBar, type AreaOption } from "./filter-bar";
import type { MapPin } from "./map-view";
import { MapViewClient } from "./map-view-client";
import { LgOnly } from "./lg-only";
import { SortDropdown } from "./sort-dropdown";
import { ViewToggle } from "./view-toggle";
import { resolveSearchView } from "./search-view";
import { MoreFiltersDrawer } from "./more-filters-drawer";
import { Pagination } from "./pagination";
import { SegmentSegmented } from "./segment-segmented";
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
async function FormEmptyState({
  form,
  activeCount,
}: {
  form: Form;
  activeCount: number;
}) {
  const t = await getTranslations("search");
  /*
   * One key per form rather than a label interpolated into a sentence. The
   * English read `No ${label} homes match those filters`, which needs the
   * noun phrase to inflect with the sentence around it — "ready,
   * never-lived-in homes" is three words of adjective in front of a plural in
   * English and a different construction entirely in Arabic. Splitting into
   * whole sentences is what makes each one translatable.
   */
  const headline = t(
    `empty.form.${form}.${activeCount > 0 ? "filtered" : "none"}`,
  );
  return (
    <div className="py-16 md:py-20 max-w-[52ch] mx-auto text-center">
      <p className="serif text-[22px] md:text-[26px] text-bz-ink">{headline}</p>
      <p className="mt-3 text-[14px] text-bz-muted">
        {activeCount > 0 ? t("empty.widenFiltered") : t("empty.widenNone")}
      </p>
      <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
        <Link
          href="/buy/search"
          className="inline-flex items-center h-9 px-4 rounded-md bg-bz-navy text-bz-bg text-[13px] font-medium"
        >
          {t("empty.allForSale")}
        </Link>
        {/* The second move widens the axis this route narrowed. On the
            off-plan facet that would point back at itself, so it offers the
            projects instead — those exist in areas with no unit listings. */}
        <Link
          href={form === "off_plan" ? "/off-plan" : "/buy/search?form=off_plan"}
          className="inline-flex items-center h-9 px-4 rounded-md border border-bz-border text-bz-ink-2 text-[13px] hover:border-bz-border-strong"
        >
          {form === "off_plan"
            ? t("empty.browseOffPlanProjects")
            : t("empty.browseOffPlan")}
        </Link>
      </div>
    </div>
  );
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
  const tl = await getTranslations("listing");
  const badgeLabels = {
    exclusive: tl("badge.exclusive"),
    vacantOnTransfer: tl("badge.vacantOnTransfer"),
  };

  /*
   * The filter chips under the result count. `describeFilters` is shared with
   * `lib/queries/*` and with tests that have no request scope, so it takes the
   * words rather than a translator — see `FilterSummaryLabels`.
   */
  const summaryLabels: FilterSummaryLabels = {
    beds: (count) => t("summary.beds", { count }),
    baths: (count) => t("summary.baths", { count }),
    type: (type) => t(`typePlural.${type}`),
    segment: (segment) => t(`segment.${segment}`),
    form: (form) => t(`formOption.${form}`),
    inArea: (area) => t("summary.inArea", { area }),
  };

  const selectedArea =
    filters.area && areas.length
      ? (areas.find((a) => a.slug === filters.area)?.name ?? filters.area)
      : undefined;
  const activeCount = countActiveFilters(filters);
  const filterSummary = describeFilters(filters, selectedArea, summaryLabels);

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
        <SegmentSegmented />
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
              {activeCount > 0 ? t("empty.filtered") : t("empty.none")}
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
              const badge = listingBadge(row.flags, badgeLabels);
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
                const badge = listingBadge(row.flags, badgeLabels);
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
            {/*
              Sticky offset moved off a literal 64px onto `--bz-header-h`.

              `public-mega-nav.tsx:125` is `sticky top-0 z-40 h-[72px]` at
              EVERY breakpoint, so `top-[64px]` parked the top 8px of this map
              underneath the header once the column stuck — and the height
              subtracted the same wrong 64. That is the exact failure
              `globals.css:145` documents for the two other sticky consumers
              ("each hard-coded its own guess"); Phase 3 moved the filter bar
              and the development sub-nav onto the token and this was the one
              left behind. Nothing between here and the viewport absorbs the
              offset — the public layout is `<body flex flex-col>` →
              `<main flex-1>` → plain blocks — so `top` is measured from the
              viewport and the token is the right number at every width.

              KNOWN RESIDUAL, not fixed here: `filter-bar.tsx:283` is also
              sticky at `top-[var(--bz-header-h)]` and carries `z-20`, so once
              scrolled it paints over this map's top edge (this aside has no
              z-index). Clearing it too needs the filter bar's own height,
              which is content-dependent and has no token — inventing a second
              literal here is what the comment above says not to do. Moving to
              72px makes the overlap 8px smaller than it was, not larger.
            */}
            <aside className="hidden lg:block sticky top-[var(--bz-header-h)] self-start h-[calc(100vh_-_var(--bz-header-h)_-_48px)] rounded-lg overflow-hidden border border-bz-border">
              {/*
                A REAL mount gate, not a CSS one.

                `hidden lg:block` on the aside stops the map being painted; it
                does not stop React rendering the subtree, so `MapViewClient`'s
                `next/dynamic` loader fired on every phone that reached grid
                view and pulled the whole MapLibre engine (~1.8MB raw, ~276KB
                transferred) down for a map the viewport can never show —
                MOBILE_AUDIT §5.7, which cites this aside at its pre-fix line
                number (search-list.tsx:374).

                Scope of the waste, measured against the code rather than
                assumed: a phone's DEFAULT here is list view, not grid
                (`search-view.ts` picks from the UA), and list view renders no
                aside at all. So the download hit the paths that reach grid on
                a narrow viewport — a shared `?view=grid` link, the ViewToggle's
                own Grid button, any tablet UA (`lib/device.ts` counts only
                `device.type === "mobile"` as a phone, so tablets default to
                grid), and any desktop window narrower than `lg` (64rem —
                1024px at a 16px root). Narrower than "every search route on
                every phone", still pure waste.

                The `fallback` is byte-identical to `map-view-client.tsx`'s own
                `loading:` placeholder on purpose: the aside's box is fixed
                height and comes from the server at every width, so the only
                thing that could shift is what fills it. Same fill before
                hydration, during the import and below `lg` = no shift and
                nothing to mismatch.

                Deliberately NOT also gated on IntersectionObserver the way
                `area-map-home.tsx` is. That component's gate exists because
                its map sits below the fold and Lighthouse's no-scroll audit
                was paying for it; this aside is top-aligned in the results
                grid and I did not measure whether it falls inside the desktop
                audit viewport, so adding a second gate would be a guess with
                its own failure modes. If LHCI desktop regresses, measure that
                separately.
              */}
              <LgOnly
                fallback={
                  <div className="w-full h-full bg-bz-surface-2 animate-pulse" />
                }
              >
                <MapViewClient
                  pins={rows
                    .filter(
                      (
                        r,
                      ): r is typeof r & {
                        geo: { lat: number; lng: number };
                      } =>
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
              </LgOnly>
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
