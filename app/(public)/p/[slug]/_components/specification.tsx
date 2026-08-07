import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Full specification table.
 *
 * Replaces the "True cost of buying" block, which derived a DLD-4% +
 * trustee + 1.5%-advisory total from the list price alone — hardcoded
 * arithmetic that appeared identically on every listing and is simply wrong
 * for off-plan stock, where there is no resale transfer at that price.
 *
 * This renders what the listing itself actually stores. `DETAIL_FIELDS`
 * already fetches plot size, furnishing, view, orientation, parking, service
 * charge, floor, development and permit — the page rendered none of them.
 * Rows with no value are dropped upstream, so a thin listing shows a short
 * table rather than a wall of em-dashes, and the whole section hides when
 * there is nothing to say beyond the key-facts tiles above.
 */

export type SpecRow = { label: string; value: string; note?: string };

/** Two per visual row on ≥sm, one on mobile. Pairing them here keeps the
 *  divider rules trivial instead of nth-child arithmetic in class names. */
function pairs(rows: SpecRow[]): SpecRow[][] {
  const out: SpecRow[][] = [];
  for (let i = 0; i < rows.length; i += 2) out.push(rows.slice(i, i + 2));
  return out;
}

export function SpecificationTable({
  rows,
  permitNo,
  permitExpiry,
  plotNumber,
}: {
  rows: SpecRow[];
  permitNo?: string | null;
  permitExpiry?: string | null;
  plotNumber?: string | null;
}) {
  const hasCompliance = Boolean(permitNo || plotNumber);
  if (rows.length === 0 && !hasCompliance) return null;

  return (
    <div id="specification" className="scroll-mt-16">
      <Eyebrow>Specification</Eyebrow>
      <h3
        className="serif text-[24px] mt-2 mb-4 leading-tight"
        style={{ letterSpacing: "-0.012em" }}
      >
        The full detail.
      </h3>

      {rows.length > 0 ? (
        <dl className="overflow-hidden rounded-lg border border-bz-border bg-bz-surface">
          {pairs(rows).map((pair, i, all) => (
            <div
              key={pair[0].label}
              className={
                i < all.length - 1
                  ? "grid grid-cols-1 sm:grid-cols-2 border-b border-bz-border"
                  : "grid grid-cols-1 sm:grid-cols-2"
              }
            >
              {pair.map((r, j) => (
                <div
                  key={r.label}
                  className={
                    j === 0 && pair.length > 1
                      ? "flex items-baseline justify-between gap-4 px-4 py-3 border-b border-bz-border sm:border-b-0 sm:border-r"
                      : "flex items-baseline justify-between gap-4 px-4 py-3"
                  }
                >
                  <dt className="text-[13.5px] text-bz-muted shrink-0">
                    {r.label}
                  </dt>
                  <dd className="text-[14px] text-bz-ink text-right">
                    {r.value}
                    {r.note ? (
                      <span className="block text-[11.5px] text-bz-muted mt-0.5">
                        {r.note}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </div>
          ))}
        </dl>
      ) : null}

      {hasCompliance ? (
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[12px] text-bz-muted">
          {permitNo ? (
            <span>
              Listing permit{" "}
              <span className="mono text-bz-ink-2">{permitNo}</span>
              {permitExpiry ? ` · valid to ${permitExpiry}` : null}
            </span>
          ) : null}
          {plotNumber ? (
            <span>
              DLD plot <span className="mono text-bz-ink-2">{plotNumber}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
