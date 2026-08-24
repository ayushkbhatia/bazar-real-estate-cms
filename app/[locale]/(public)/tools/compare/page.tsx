import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/i18n/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { Check, X, Plus } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getComparableProperties,
  type ComparableProperty,
} from "@/lib/queries/compare";
import {
  getCompareCopy,
  type SectionCopy,
} from "@/lib/queries/content-sections";
import { arabicFor } from "@/lib/i18n/arabic-store";
import {
  buildAttributeGroups,
  type CellValue,
  type AttributeRow,
} from "@/lib/compare";
import {
  AreaText,
  PriceText,
  PricePerAreaText,
} from "../../_components/area-text";
import { propertyUrl } from "@/lib/queries/property-utils";
import { mediaPublicUrl } from "@/lib/media";
import { SnapRail } from "@/components/brand/mobile";
import { CompareToolbar } from "./compare-toolbar";
import { PickerDrawer } from "./_components/picker-drawer";
import { InvestmentMetrics } from "./_components/investment-metrics";
import { VerdictBand } from "./_components/verdict-band";

/**
 * A static `metadata` export cannot see the locale, so `/ar/tools/compare`
 * shipped an English `<title>` and an English `og:description` — the two
 * strings a shared link is judged by. It is also the pair the client is most
 * likely to want to rewrite, so both come from the CMS document rather than
 * from a literal here.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const copy = await getCompareCopy(locale);
  return { title: copy.meta_title, description: copy.meta_description };
}

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    ids?: string;
    diff?: string;
  }>;
};

/**
 * `getTranslations` bound once and threaded down, rather than each helper
 * awaiting its own.
 *
 * The helpers below are plain functions in this file, so making them async to
 * fetch their own translator would make the whole tree async for no gain — and
 * an ambient `getTranslations()` inside one of them would resolve through
 * `headers()`, which is how a page silently loses its render mode.
 */
type T = Awaited<ReturnType<typeof getTranslations>>;

const SLOT_COUNT = 4;
const TABLE_COLS = `220px repeat(${SLOT_COUNT}, minmax(0, 1fr))`;

/**
 * Slot width of one card hero. The mobile rail and the desktop matrix are
 * both in the DOM at once — the `showTestId` prop below exists because of
 * that — so four compared properties meant eight raw `<img>` elements
 * pointed at eight untouched Supabase originals, only four of which were
 * ever displayed.
 *
 * Mobile is the snap rail: each card is `w-[78%] max-w-[300px]` of a
 * gutter-width rail. From md up it is the desktop matrix — a 220px label
 * column plus four equal tracks with 16px gaps inside a `px-12` section that
 * never caps its width, so one track is (100vw − 96 − 220 − 80) / 4.
 */
const CARD_HERO_SIZES =
  "(min-width: 768px) calc((100vw - 396px) / 4), min(78vw, 300px)";

function parseIds(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, SLOT_COUNT);
}

export default async function ComparePage({ params, searchParams }: PageProps) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "tools" });
  // Editable at /admin/pages/sub/section/compare. The attribute NAMES stay in
  // `t` — they are the property vocabulary the filter bar and the listing page
  // share, not copy belonging to this screen.
  const copy = await getCompareCopy(locale);
  const { ids: idsRaw, diff: diffRaw } = await searchParams;
  const requestedIds = parseIds(idsRaw);
  const showDiff = diffRaw !== "0"; // default on

  const properties = await getComparableProperties(requestedIds);

  if (requestedIds.length === 0) {
    return <EmptyState copy={copy} />;
  }

  // Some ids may not resolve (unpublished, deleted, bad uuid). Keep the
  // slot grid stable — render placeholders for unresolved ids so the
  // "remove" buttons in the URL still target the right index.
  const slots: (ComparableProperty | null)[] = requestedIds.map(
    (id) => properties.find((p) => p.id === id) ?? null,
  );
  // Pad up to SLOT_COUNT with empty slots.
  while (slots.length < SLOT_COUNT) slots.push(null);

  const present = slots.filter((s): s is ComparableProperty => s !== null);
  const groups = buildAttributeGroups(present);

  // Mobile-only: the attributes that actually differ across the present
  // properties, flattened across groups. Drives the "What differs"
  // section so mobile shows the decision-relevant rows up front instead
  // of the full desktop matrix (handoff pattern 6).
  const diffRows = groups.flatMap((g) => g.rows.filter((r) => r.differs));

  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 py-8 md:py-10 border-b border-bz-border">
        <div className="flex justify-between items-center gap-6 flex-wrap">
          <div>
            <Eyebrow>
              {t("compare.comparingCount", { count: present.length })}
            </Eyebrow>
            <h1
              className="serif text-[28px] md:text-[36px] mt-1.5"
              style={{ letterSpacing: "-0.02em" }}
            >
              {copy.heading}
            </h1>
          </div>
          <CompareToolbar
            ids={requestedIds}
            showDiff={showDiff}
            count={present.length}
          />
        </div>
      </section>

      {/* ── Mobile compare (< md): summary cards → what differs → full
          comparison accordion. The desktop matrix below is hidden. ── */}
      <div className="md:hidden">
        <section className="px-4 pt-6">
          <SnapRail>
            {slots.map((slot, i) => (
              <div key={`m-card-${i}`} className="w-[78%] max-w-[300px]">
                {slot ? (
                  <PropertyCard
                    property={slot}
                    pickIndex={i}
                    showTestId={false}
                    copy={copy}
                  />
                ) : (
                  <EmptySlot
                    index={i}
                    requestedIds={requestedIds}
                    showTestId={false}
                    copy={copy}
                  />
                )}
              </div>
            ))}
          </SnapRail>
        </section>

        {diffRows.length > 0 ? (
          <section className="px-4 pt-8">
            <Eyebrow className="text-bz-ink">
              {copy.what_differs}
            </Eyebrow>
            <div className="mt-3 divide-y divide-bz-border">
              {diffRows.map((r) => (
                <MobileAttrRow
                key={r.key}
                row={r}
                present={present}
                t={t}
                locale={locale}
              />
              ))}
            </div>
          </section>
        ) : null}

        <section className="px-4 pt-8 pb-4">
          <details className="rounded-lg border border-bz-border bg-bz-surface">
            <summary className="cursor-pointer list-none px-4 py-3 text-[14px] font-medium flex items-center justify-between">
              {copy.full_comparison}
              <span className="text-[12px] text-bz-muted">
                {t("compare.propertyCount", { count: present.length })}
              </span>
            </summary>
            <div className="px-4 pb-4">
              {groups.map((group) => (
                <div key={group.key} className="mt-4 first:mt-2">
                  <Eyebrow className="text-bz-ink">
                    {t(`compare.group.${group.key}`)}
                  </Eyebrow>
                  <div className="mt-1 divide-y divide-bz-border">
                    {group.rows.map((r) => (
                      <MobileAttrRow
                key={r.key}
                row={r}
                present={present}
                t={t}
                locale={locale}
              />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </section>
      </div>

      {/* Cards strip — desktop matrix */}
      <section className="hidden md:block px-12 pt-8">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: TABLE_COLS }}
        >
          <div /> {/* spacer aligned with attribute labels */}
          {slots.map((slot, i) =>
            slot ? (
              <PropertyCard
                key={`card-${i}-${slot.id}`}
                property={slot}
                pickIndex={i}
                copy={copy}
              />
            ) : (
              <EmptySlot
                key={`empty-${i}`}
                index={i}
                requestedIds={requestedIds}
                copy={copy}
              />
            ),
          )}
        </div>
      </section>

      {/* Attribute groups — desktop matrix */}
      <section className="hidden md:block px-12 pb-24" data-testid="compare-groups">
        {groups.map((group) => (
          <div key={group.key} className="mt-8">
            <div
              className="grid gap-4 py-3 border-t border-bz-ink"
              style={{ borderTopWidth: 1.5, gridTemplateColumns: TABLE_COLS }}
            >
              <Eyebrow className="text-bz-ink">
                {t(`compare.group.${group.key}`)}
              </Eyebrow>
            </div>
            <table
              className="w-full"
              style={{ borderCollapse: "collapse" }}
              data-testid={`group-${group.key}`}
            >
              <tbody>
                {group.rows.map((r) => (
                  <tr
                    key={r.key}
                    className="border-b border-bz-border align-top"
                    data-row-key={r.key}
                    data-differs={r.differs ? "true" : "false"}
                  >
                    <td
                      style={{ width: 220 }}
                      className="py-3.5 pe-4 text-[13px] text-bz-muted"
                    >
                      {rowLabel(r, t, locale)}
                    </td>
                    {slots.map((slot, i) => {
                      // Cells for *present* properties are indexed by their
                      // position in the `present` array; cells for missing
                      // slots render as "—".
                      const presentIdx = slot
                        ? present.indexOf(slot)
                        : -1;
                      const value: CellValue =
                        presentIdx >= 0 ? r.values[presentIdx] : null;
                      const highlight =
                        showDiff && r.differs && presentIdx >= 0;
                      return (
                        <td
                          key={i}
                          className={cn(
                            "py-3.5 px-4 text-[14px] border-s border-bz-border",
                            highlight && "bg-bz-surface-2",
                            value === null && "text-bz-muted-2",
                          )}
                        >
                          {renderCell(value, t)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      {/* Sprint 5b: investment metrics + verdict band */}
      {present.length >= 2 ? (
        <section className="px-4 md:px-12 pb-12 space-y-6">
          <InvestmentMetrics
            rows={present.map((p, i) => ({
              ref: p.reference,
              // Sprint 12: real yield from DLD comparables; placeholder
              // here uses a deterministic spread by index for visual demo.
              yieldPct: 5.2 + i * 0.4,
              yoyGrowthPct: 6.1 + i * 0.8,
              foreignEligible: true,
              mortgageableNow: i !== 1,
            }))}
          />
          <VerdictBand
            references={present.map((p) => p.reference)}
            locale={locale}
          />
        </section>
      ) : null}
    </div>
  );
}

/* ─── helpers ───────────────────────────────────────────────── */

/** Mobile attribute row — label with each present property's value
 *  stacked beneath, used for both "What differs" and the full-comparison
 *  accordion. Replaces the desktop matrix table on small screens. */
function MobileAttrRow({
  row,
  present,
  t,
  locale,
}: {
  row: AttributeRow;
  present: ComparableProperty[];
  t: T;
  locale: Locale;
}) {
  return (
    <div className="py-3">
      <div className="text-[12px] text-bz-muted">
        {rowLabel(row, t, locale)}
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        {present.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 text-[13px]"
          >
            <span className="mono text-[11px] text-bz-muted truncate">
              {p.reference}
            </span>
            <span className="font-medium text-end">
              {renderCell(row.values[i], t)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The row's name: a message, unless the row is an amenity.
 *
 * An amenity row is named by an amenity string out of the database, so it
 * carries `dataLabel` and cannot resolve through the catalogue. The comment
 * here used to say it "gets its Arabic through the DB read fold" — it does
 * not, and never did: `properties.amenities` is a bare `text[]` with no `_ar`
 * sibling for `localiseRow` to pair it with, so the Arabic table printed
 * "Concierge" and "Family Pool" down the side of an otherwise Arabic page.
 *
 * `arabicFor` is the same fallback `localiseRow` reaches for when a twin
 * column is blank — one store keyed by the English, so an amenity gets the
 * identical Arabic here, on the property page and in the filter facet. An
 * amenity nobody has translated falls back to its English, which is the
 * designed direction.
 */
function rowLabel(row: AttributeRow, t: T, locale: Locale): string {
  if (!row.dataLabel) return t(`compare.row.${row.key}`);
  if (locale === DEFAULT_LOCALE) return row.dataLabel;
  return arabicFor(row.dataLabel) ?? row.dataLabel;
}

function renderCell(value: CellValue, t: T) {
  if (value === null) return <span>—</span>;
  // Money and areas arrive as raw AED / ft² tagged with their unit; these
  // leaves are client components that render them in the visitor's currency
  // and area unit. The page itself stays a server component.
  if (typeof value === "object") {
    switch (value.kind) {
      case "aed":
        return <PriceText aed={value.value} />;
      case "ft2":
        return <AreaText ft2={value.value} />;
      case "aedPerFt2":
        return (
          <PricePerAreaText
            aedPerFt2={value.value}
            suffix={value.per === "yr" ? " / yr" : ""}
          />
        );
      case "msg":
        // The enums — mode, tenure, type, furnishing — plus the two that
        // carry a count. `lib/compare.ts` emits the key; the words live here.
        return (
          <span>
            {value.count === undefined
              ? t(`compare.${value.key}`)
              : t(`compare.${value.key}`, { count: value.count })}
          </span>
        );
    }
  }
  if (value === true) {
    return (
      <span className="text-bz-success inline-flex items-center gap-1.5">
        <Check size={14} strokeWidth={1.8} />
        <span className="text-[12px] text-bz-ink-2">{t("compare.yes")}</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="text-bz-muted-2 inline-flex items-center gap-1.5">
        <X size={14} strokeWidth={1.8} />
        <span className="text-[12px]">—</span>
      </span>
    );
  }
  return <span>{value}</span>;
}

function PropertyCard({
  property,
  pickIndex,
  showTestId = true,
  copy,
}: {
  property: ComparableProperty;
  pickIndex: number;
  /** Suppressed on the mobile rail so the desktop matrix testids stay
   *  unique for the e2e specs (both trees are in the DOM at once). */
  showTestId?: boolean;
  copy: SectionCopy;
}) {
  return (
    <article
      className={cn(
        "relative border rounded-lg overflow-hidden bg-bz-surface",
        pickIndex === 0
          ? "border-bz-ink"
          : "border-bz-border",
      )}
      data-testid={showTestId ? `compare-card-${pickIndex}` : undefined}
    >
      {pickIndex === 0 ? (
        <div className="absolute top-2 start-2 z-10">
          <span className="bg-bz-navy text-bz-bg text-[10px] uppercase tracking-wider font-medium rounded-sm px-1.5 py-1">
            {copy.best_fit}
          </span>
        </div>
      ) : null}
      <div className="relative aspect-[4/3] bg-bz-surface-2">
        {property.hero ? (
          <Image
            src={mediaPublicUrl(property.hero.storage_key)}
            alt={property.hero.alt_text ?? property.title}
            fill
            sizes={CARD_HERO_SIZES}
            className="object-cover"
          />
        ) : (
          <PlaceholderImage label={property.reference} />
        )}
      </div>
      <div className="p-4">
        <div
          className="serif text-[20px] text-bz-navy"
          style={{ letterSpacing: "-0.01em" }}
        >
          <PriceText aed={property.price_aed} />
        </div>
        <div className="text-[13px] text-bz-ink-2 mt-0.5">
          <Link
            href={propertyUrl(property)}
            className="hover:underline"
          >
            {property.title}
          </Link>
        </div>
        <div className="text-[11.5px] text-bz-muted mt-0.5">
          {property.area_name ?? "—"} · {property.reference}
        </div>
      </div>
    </article>
  );
}

function EmptySlot({
  index,
  requestedIds,
  showTestId = true,
  copy,
}: {
  index: number;
  requestedIds: string[];
  showTestId?: boolean;
  copy: SectionCopy;
}) {
  // If this slot index is occupied in the URL but couldn't be resolved,
  // show a different message than for genuinely empty slots.
  const isUnresolved = index < requestedIds.length;
  return (
    <article
      className="border-[1.5px] border-dashed border-bz-border-strong rounded-lg flex flex-col items-center justify-center gap-2 p-6 text-bz-muted min-h-[320px]"
      data-testid={showTestId ? `empty-slot-${index}` : undefined}
    >
      <div className="w-9 h-9 rounded-full bg-bz-surface-2 flex items-center justify-center">
        <Plus size={16} strokeWidth={1.8} />
      </div>
      <div className="text-[13px] text-bz-ink-2">
        {isUnresolved ? copy.unresolved_title : copy.slot_title}
      </div>
      <p className="text-[11px] text-center max-w-[160px]">
        {isUnresolved ? copy.unresolved_body : copy.slot_body}
      </p>
      {/* An unresolved slot already holds an id, so there's nothing to add
          into — only the genuinely empty ones get the picker. */}
      {isUnresolved ? (
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link href="/buy">{copy.unresolved_cta}</Link>
        </Button>
      ) : (
        <div className="mt-2">
          <PickerDrawer requestedIds={requestedIds}>
            <Button variant="outline" size="sm">
              {copy.slot_cta}
            </Button>
          </PickerDrawer>
        </div>
      )}
    </article>
  );
}

/**
 * The `data-testid`s carry no styling and exist for `e2e/tools-compare.spec.ts`.
 *
 * Every word on this screen is a CMS field, so a spec that recognises the
 * empty state by its heading is asserting on something an editor may rewrite
 * at any time with no commit behind it — which is exactly how main went red
 * here. The rest of the compare page is already addressed by test id
 * (`group-*`, `compare-card-*`, `empty-slot-*`); this is the one branch that
 * was not.
 */
function EmptyState({ copy }: { copy: SectionCopy }) {
  return (
    <div
      data-testid="compare-empty"
      className="bg-bz-bg px-4 md:px-12 py-12 md:py-20"
    >
      <Eyebrow>{copy.empty_eyebrow}</Eyebrow>
      <h1
        className="serif text-[30px] md:text-[48px] mt-2 max-w-[18ch]"
        style={{ letterSpacing: "-0.025em" }}
      >
        {copy.empty_heading}
      </h1>
      <p className="mt-4 max-w-[58ch] text-[15px] text-bz-ink-2 leading-relaxed">
        {copy.empty_body}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link data-testid="compare-empty-cta" href="/buy">
            {copy.empty_cta}
          </Link>
        </Button>
      </div>
    </div>
  );
}
