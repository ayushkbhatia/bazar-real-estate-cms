import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Sprint 7b (backfilled): numbered pagination for the admin properties
 * table. Mirrors the public-side pagination component but renders into
 * the admin shell.
 */
export function AdminPropertiesPagination({
  page,
  total,
  pageSize,
  searchParams,
}: {
  page: number;
  total: number;
  pageSize: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (last <= 1) return null;

  function hrefFor(p: number): string {
    const base = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "page") continue;
      if (Array.isArray(v)) v.forEach((x) => base.append(k, x));
      else if (typeof v === "string" && v !== "") base.set(k, v);
    }
    if (p > 1) base.set("page", String(p));
    const qs = base.toString();
    return qs ? `?${qs}` : "";
  }

  const pages = pageRange(page, last);

  return (
    <nav
      role="navigation"
      aria-label="Properties pagination"
      className="flex items-center justify-end gap-1 mt-4"
    >
      <span className="mono text-[11px] text-bz-muted mr-2">
        Page {page} of {last} · {total.toLocaleString()} total
      </span>
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="inline-flex items-center justify-center h-8 w-8 rounded border border-bz-border bg-bz-bg text-bz-ink-2 hover:border-bz-border-strong"
          aria-label="Previous page"
        >
          <ChevronLeft size={12} strokeWidth={1.7} />
        </Link>
      ) : null}
      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span
            key={`e${i}`}
            className="inline-flex items-center justify-center h-8 w-5 text-[12px] text-bz-muted"
          >
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={
              p === page
                ? "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded bg-bz-ink text-bz-bg text-[12px] font-medium"
                : "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded border border-bz-border bg-bz-bg text-bz-ink-2 text-[12px] hover:border-bz-border-strong"
            }
          >
            {p}
          </Link>
        ),
      )}
      {page < last ? (
        <Link
          href={hrefFor(page + 1)}
          className="inline-flex items-center justify-center h-8 w-8 rounded border border-bz-border bg-bz-bg text-bz-ink-2 hover:border-bz-border-strong"
          aria-label="Next page"
        >
          <ChevronRight size={12} strokeWidth={1.7} />
        </Link>
      ) : null}
    </nav>
  );
}

function pageRange(current: number, last: number): (number | "ellipsis")[] {
  const set = new Set<number>([1, last, current]);
  for (const d of [1]) {
    if (current - d > 1) set.add(current - d);
    if (current + d < last) set.add(current + d);
  }
  const sorted = Array.from(set).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    out.push(sorted[i]);
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) {
      out.push("ellipsis");
    }
  }
  return out;
}
