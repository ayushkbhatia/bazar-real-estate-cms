import Link from "next/link";
import { ArrowDown } from "lucide-react";

/**
 * Sprint 5d (backfilled): "Load more" pagination on /insights index.
 * Server-side via querystring (?show=N) — keeps the page static-friendly.
 */
export function LoadMoreButton({
  current,
  total,
  step,
  searchParams,
}: {
  current: number;
  total: number;
  step: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (current >= total) return null;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === "show") continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else if (typeof v === "string" && v !== "") params.set(k, v);
  }
  params.set("show", String(Math.min(current + step, total)));

  return (
    <div className="flex justify-center pt-10">
      <Link
        href={`?${params.toString()}`}
        scroll={false}
        className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md border border-bz-border bg-bz-bg text-[13px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
      >
        <ArrowDown size={13} strokeWidth={1.7} />
        Load more · {Math.min(step, total - current)} of {total - current}{" "}
        remaining
      </Link>
    </div>
  );
}
