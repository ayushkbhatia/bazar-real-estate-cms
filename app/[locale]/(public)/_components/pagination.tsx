import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Numbered pagination — server-side, query-string driven. Renders
 * `[prev] 1 … 5 6 [7] 8 9 … 27 [next]` style.
 */
export async function Pagination({
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

  // Server Component, so `getTranslations` rather than the hook — the three
  // strings here are accessible names and never cross into a client payload.
  const t = await getTranslations("search");

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

  /*
   * Every target below is 44px on a phone and back to 36px (`h-9`) from `md`
   * up. These are <Link>s, not the Button primitive, so the `(pointer: coarse)`
   * 44px floor in globals.css — which selects on data-slot — never applied to
   * them. Both axes are widened: a 44x36 number pill fails the same check as a
   * 36x36 one.
   *
   * `flex-wrap` below `md` is the counterweight. At full spread the row is
   * prev + five numbers + next at 44px, two 24px ellipses and eight 4px gaps —
   * about 388px, against the 358px that SearchList's `px-4` leaves inside a
   * 390px viewport. Wrapping the last chevron onto a second centred line is
   * the graceful failure; without it the row would push the page sideways.
   * Desktop is unchanged: `md:flex-nowrap` restores the single line, which had
   * room for the 36px version all along.
   *
   * The "…" spans are deliberately left at h-9/w-6 — they are not links and
   * carry no handler, so they are neither a target nor measured as one.
   */
  return (
    <nav
      role="navigation"
      aria-label={t("pagination.label")}
      className="flex flex-wrap md:flex-nowrap items-center justify-center gap-1 py-12"
    >
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="inline-flex items-center justify-center h-11 w-11 md:h-9 md:w-9 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 hover:border-bz-border-strong"
          aria-label={t("pagination.previous")}
        >
          <ChevronLeft size={14} strokeWidth={1.7} />
        </Link>
      ) : (
        <span className="inline-flex items-center justify-center h-11 w-11 md:h-9 md:w-9 rounded-md border border-bz-border bg-bz-bg text-bz-muted opacity-40">
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
                ? "inline-flex items-center justify-center h-11 min-w-11 md:h-9 md:min-w-9 px-2 rounded-md bg-bz-navy text-bz-bg text-[13px] font-medium"
                : "inline-flex items-center justify-center h-11 min-w-11 md:h-9 md:min-w-9 px-2 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 text-[13px] hover:border-bz-border-strong"
            }
          >
            {p}
          </Link>
        ),
      )}

      {page < lastPage ? (
        <Link
          href={hrefFor(page + 1)}
          className="inline-flex items-center justify-center h-11 w-11 md:h-9 md:w-9 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 hover:border-bz-border-strong"
          aria-label={t("pagination.next")}
        >
          <ChevronRight size={14} strokeWidth={1.7} />
        </Link>
      ) : (
        <span className="inline-flex items-center justify-center h-11 w-11 md:h-9 md:w-9 rounded-md border border-bz-border bg-bz-bg text-bz-muted opacity-40">
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
