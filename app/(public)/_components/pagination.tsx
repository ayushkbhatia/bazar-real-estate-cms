import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Numbered pagination — server-side, query-string driven. Renders
 * `[prev] 1 … 5 6 [7] 8 9 … 27 [next]` style.
 */
export function Pagination({
  page,
  total,
  pageSize,
  searchParams,
}: {
  page: number;
  total: number;
  pageSize: number;
  /** Current querystring — preserved across pages except for `page`. */
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage <= 1) return null;

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

  const pages = pageRange(page, lastPage);

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className="flex items-center justify-center gap-1 py-12"
    >
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 hover:border-bz-border-strong"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} strokeWidth={1.7} />
        </Link>
      ) : (
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-bz-border bg-bz-bg text-bz-muted opacity-40">
          <ChevronLeft size={14} strokeWidth={1.7} />
        </span>
      )}

      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span
            key={`e${i}`}
            className="inline-flex items-center justify-center h-9 w-6 text-[13px] text-bz-muted"
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
                ? "inline-flex items-center justify-center h-9 min-w-9 px-2 rounded-md bg-bz-ink text-bz-bg text-[13px] font-medium"
                : "inline-flex items-center justify-center h-9 min-w-9 px-2 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 text-[13px] hover:border-bz-border-strong"
            }
          >
            {p}
          </Link>
        ),
      )}

      {page < lastPage ? (
        <Link
          href={hrefFor(page + 1)}
          className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 hover:border-bz-border-strong"
          aria-label="Next page"
        >
          <ChevronRight size={14} strokeWidth={1.7} />
        </Link>
      ) : (
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-bz-border bg-bz-bg text-bz-muted opacity-40">
          <ChevronRight size={14} strokeWidth={1.7} />
        </span>
      )}
    </nav>
  );
}

function pageRange(current: number, last: number): (number | "ellipsis")[] {
  const window = 1;
  const set = new Set<number>([1, last, current]);
  for (let d = 1; d <= window; d++) {
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
