import type { Metadata } from "next";
import Link from "next/link";
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
  formatAed,
  type CellValue,
} from "@/lib/compare";
import { propertyUrl } from "@/lib/queries/property-utils";
import { mediaPublicUrl } from "@/lib/media";
import { CompareToolbar } from "./compare-toolbar";

export const metadata: Metadata = {
  title: "Compare properties",
  description:
    "Compare up to 4 Abu Dhabi properties side-by-side across price, specifications, location, amenities, and investment fundamentals. Share the URL to send the comparison to a partner or advisor.",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    ids?: string;
    diff?: string;
  }>;
};

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

export default async function ComparePage({ searchParams }: PageProps) {
  const { ids: idsRaw, diff: diffRaw } = await searchParams;
  const requestedIds = parseIds(idsRaw);
  const showDiff = diffRaw !== "0"; // default on

  const properties = await getComparableProperties(requestedIds);

  if (requestedIds.length === 0) {
    return <EmptyState />;
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

  return (
    <div className="bg-bz-bg">
      <section className="px-12 py-10 border-b border-bz-border">
        <div className="flex justify-between items-center gap-6 flex-wrap">
          <div>
            <Eyebrow>
              Comparing {present.length}{" "}
              {present.length === 1 ? "property" : "properties"}
            </Eyebrow>
            <h1
              className="serif text-[36px] mt-1.5"
              style={{ letterSpacing: "-0.02em" }}
            >
              Side by side
            </h1>
          </div>
          <CompareToolbar
            ids={requestedIds}
            showDiff={showDiff}
            count={present.length}
          />
        </div>
      </section>

      {/* Cards strip */}
      <section className="px-12 pt-8">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: TABLE_COLS }}
        >
          <div /> {/* spacer aligned with attribute labels */}
          {slots.map((slot, i) =>
            slot ? (
              <PropertyCard key={`card-${i}-${slot.id}`} property={slot} pickIndex={i} />
            ) : (
              <EmptySlot key={`empty-${i}`} index={i} requestedIds={requestedIds} />
            ),
          )}
        </div>
      </section>

      {/* Attribute groups */}
      <section className="px-12 pb-24" data-testid="compare-groups">
        {groups.map((group) => (
          <div key={group.key} className="mt-8">
            <div
              className="grid gap-4 py-3 border-t border-bz-ink"
              style={{ borderTopWidth: 1.5, gridTemplateColumns: TABLE_COLS }}
            >
              <Eyebrow className="text-bz-ink">{group.label}</Eyebrow>
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
                      className="py-3.5 pr-4 text-[13px] text-bz-muted"
                    >
                      {r.label}
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
                            "py-3.5 px-4 text-[14px] border-l border-bz-border",
                            highlight && "bg-bz-surface-2",
                            value === null && "text-bz-muted-2",
                          )}
                        >
                          {renderCell(value)}
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
    </div>
  );
}

/* ─── helpers ───────────────────────────────────────────────── */

function renderCell(value: CellValue) {
  if (value === null) return <span>—</span>;
  if (value === true) {
    return (
      <span className="text-bz-success inline-flex items-center gap-1.5">
        <Check size={14} strokeWidth={1.8} />
        <span className="text-[12px] text-bz-ink-2">Yes</span>
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
}: {
  property: ComparableProperty;
  pickIndex: number;
}) {
  return (
    <article
      className={cn(
        "relative border rounded-lg overflow-hidden bg-bz-surface",
        pickIndex === 0
          ? "border-bz-ink"
          : "border-bz-border",
      )}
      data-testid={`compare-card-${pickIndex}`}
    >
      {pickIndex === 0 ? (
        <div className="absolute top-2 left-2 z-10">
          <span className="bg-bz-ink text-bz-bg text-[10px] uppercase tracking-wider font-medium rounded-sm px-1.5 py-1">
            Best fit · advisor pick
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
          className="serif text-[20px]"
          style={{ letterSpacing: "-0.01em" }}
        >
          {formatAed(property.price_aed)}
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
}: {
  index: number;
  requestedIds: string[];
}) {
  // If this slot index is occupied in the URL but couldn't be resolved,
  // show a different message than for genuinely empty slots.
  const isUnresolved = index < requestedIds.length;
  return (
    <article
      className="border-[1.5px] border-dashed border-bz-border-strong rounded-lg flex flex-col items-center justify-center gap-2 p-6 text-bz-muted min-h-[320px]"
      data-testid={`empty-slot-${index}`}
    >
      <div className="w-9 h-9 rounded-full bg-bz-surface-2 flex items-center justify-center">
        <Plus size={16} strokeWidth={1.8} />
      </div>
      <div className="text-[13px] text-bz-ink-2">
        {isUnresolved ? "Couldn't load this property" : "Add another property"}
      </div>
      <p className="text-[11px] text-center max-w-[160px]">
        {isUnresolved
          ? "It may be off-market or no longer published."
          : "Pull from saved, search, or paste a Bazar link"}
      </p>
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link href="/buy">Browse</Link>
      </Button>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="bg-bz-bg px-12 py-20">
      <Eyebrow>Compare</Eyebrow>
      <h1
        className="serif text-[48px] mt-2 max-w-[18ch]"
        style={{ letterSpacing: "-0.025em" }}
      >
        Stack properties side by side.
      </h1>
      <p className="mt-4 max-w-[58ch] text-[15px] text-bz-ink-2 leading-relaxed">
        Pull two to four properties into a comparison and we&apos;ll line
        up price, specs, location, amenities, and investment fundamentals.
        Share the URL to send the same comparison to a partner or advisor.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/buy">Browse the marketplace</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/account/saved">Open saved properties</Link>
        </Button>
      </div>
    </div>
  );
}
