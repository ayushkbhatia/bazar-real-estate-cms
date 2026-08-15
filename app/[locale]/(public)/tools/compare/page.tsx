import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
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

export const metadata: Metadata = {
  title: "Compare properties",
  description:
    "Compare up to 4 Abu Dhabi properties side-by-side across price, specifications, location, amenities, and investment fundamentals. Share the URL to send the comparison to a partner or advisor.",
};

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
  const { ids: idsRaw, diff: diffRaw } = await searchParams;
  const requestedIds = parseIds(idsRaw);
  const showDiff = diffRaw !== "0"; // default on

  const properties = await getComparableProperties(requestedIds);

  if (requestedIds.length === 0) {
    return <EmptyState t={t} />;
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
              {t("compare.heading")}
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
                    t={t}
                  />
                ) : (
                  <EmptySlot
                    index={i}
                    requestedIds={requestedIds}
                    showTestId={false}
                    t={t}
                  />
                )}
              </div>
            ))}
          </SnapRail>
        </section>

        {diffRows.length > 0 ? (
          <section className="px-4 pt-8">
            <Eyebrow className="text-bz-ink">
              {t("compare.whatDiffers")}
            </Eyebrow>
            <div className="mt-3 divide-y divide-bz-border">
              {diffRows.map((r) => (
                <MobileAttrRow key={r.key} row={r} present={present} t={t} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="px-4 pt-8 pb-4">
          <details className="rounded-lg border border-bz-border bg-bz-surface">
            <summary className="cursor-pointer list-none px-4 py-3 text-[14px] font-medium flex items-center justify-between">
              {t("compare.fullComparison")}
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
                      <MobileAttrRow key={r.key} row={r} present={present} t={t} />
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
                t={t}
              />
            ) : (
              <EmptySlot
                key={`empty-${i}`}
                index={i}
                requestedIds={requestedIds}
                t={t}
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
                      {rowLabel(r, t)}
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
}: {
  row: AttributeRow;
  present: ComparableProperty[];
  t: T;
}) {
  return (
    <div className="py-3">
      <div className="text-[12px] text-bz-muted">{rowLabel(row, t)}</div>
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
 * An amenity row is named by an amenity string out of the database, which gets
 * its Arabic through the DB read fold rather than the catalogue — so it
 * carries `dataLabel` and prints verbatim. Everything else is code copy and
 * resolves through `key`.
 */
function rowLabel(row: AttributeRow, t: T): string {
  return row.dataLabel ?? t(`compare.row.${row.key}`);
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
  t,
}: {
  property: ComparableProperty;
  pickIndex: number;
  /** Suppressed on the mobile rail so the desktop matrix testids stay
   *  unique for the e2e specs (both trees are in the DOM at once). */
  showTestId?: boolean;
  t: T;
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
            {t("compare.bestFit")}
          </span>
        </div>
      ) : null}
      <div className="aspect-[4/3] bg-bz-surface-2">
        {property.hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaPublicUrl(property.hero.storage_key)}
            alt={property.hero.alt_text ?? property.title}
            className="w-full h-full object-cover"
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
  t,
}: {
  index: number;
  requestedIds: string[];
  showTestId?: boolean;
  t: T;
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
        {t(
          isUnresolved
            ? "compare.unresolvedTitle"
            : "compare.emptySlotTitle",
        )}
      </div>
      <p className="text-[11px] text-center max-w-[160px]">
        {t(
          isUnresolved ? "compare.unresolvedBody" : "compare.emptySlotBody",
        )}
      </p>
      {/* An unresolved slot already holds an id, so there's nothing to add
          into — only the genuinely empty ones get the picker. */}
      {isUnresolved ? (
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link href="/buy">{t("compare.browse")}</Link>
        </Button>
      ) : (
        <div className="mt-2">
          <PickerDrawer requestedIds={requestedIds}>
            <Button variant="outline" size="sm">
              {t("compare.addFromShortlist")}
            </Button>
          </PickerDrawer>
        </div>
      )}
    </article>
  );
}

function EmptyState({ t }: { t: T }) {
  return (
    <div className="bg-bz-bg px-4 md:px-12 py-12 md:py-20">
      <Eyebrow>{t("compare.emptyEyebrow")}</Eyebrow>
      <h1
        className="serif text-[30px] md:text-[48px] mt-2 max-w-[18ch]"
        style={{ letterSpacing: "-0.025em" }}
      >
        {t("compare.emptyHeading")}
      </h1>
      <p className="mt-4 max-w-[58ch] text-[15px] text-bz-ink-2 leading-relaxed">
        {t("compare.emptyBody")}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/buy">{t("compare.browseMarketplace")}</Link>
        </Button>
      </div>
    </div>
  );
}
