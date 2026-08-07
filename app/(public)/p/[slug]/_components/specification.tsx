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
        /* A `<dl>` may only wrap each dt/dd group in a *single* `<div>` —
           nesting them two deep fails axe's definition-list and dlitem
           rules. So the grid lives on the `<dl>` itself and each row is one
           flat div. The 1px rules are the `gap-px` showing the container
           colour through, which needs no last-row arithmetic. */
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-px overflow-hidden rounded-lg border border-bz-border bg-bz-border">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={[
                "flex items-baseline justify-between gap-4 px-4 py-3 bg-bz-surface",
                // An odd final row spans the full width, so the grid never
                // leaves an empty cell showing the divider colour as a block.
                rows.length % 2 === 1 && i === rows.length - 1
                  ? "sm:col-span-2"
                  : "",
              ].join(" ")}
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
