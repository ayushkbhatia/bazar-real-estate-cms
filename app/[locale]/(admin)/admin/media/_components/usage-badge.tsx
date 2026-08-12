import { Link2 } from "lucide-react";

/**
 * "Used in N places" badge overlaying a media tile. The count covers every
 * record that references the asset — listings, developments, articles, pages,
 * nav tiles, deal documents — as resolved by `lib/queries/media-usage.ts`.
 */
export function MediaUsageBadge({
  count,
  title,
}: {
  count: number;
  title?: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className="absolute bottom-2 start-2 inline-flex items-center gap-1 h-5 px-1.5 rounded bg-bz-ink/80 text-bz-bg text-[10px] font-medium backdrop-blur"
      title={title ?? `Used in ${count} place${count === 1 ? "" : "s"}`}
    >
      <Link2 size={9} strokeWidth={2} />
      {count}
    </span>
  );
}
