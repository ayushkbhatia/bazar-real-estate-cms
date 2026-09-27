import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import type { RelatedEnquiry } from "@/lib/queries/enquiries";
import { STATUS_LABELS, STATUS_STYLES } from "../_status";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The same person's other enquiries — a buyer who asked about three listings
 * this month is a different conversation from a first contact, and the desk
 * could only find that out by searching the inbox for their email.
 */
export function RelatedEnquiries({
  rows,
  currentName,
}: {
  rows: RelatedEnquiry[];
  /** This lead's name, so a different one on a match is called out. */
  currentName: string;
}) {
  if (rows.length === 0) return null;
  const sameName = (name: string) =>
    name.trim().toLowerCase() === currentName.trim().toLowerCase();

  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
      <Eyebrow>Also from this person</Eyebrow>
      <ul className="mt-3 flex flex-col divide-y divide-bz-border">
        {rows.map((row) => {
          const subject =
            row.property?.reference ??
            row.development?.name ??
            row.origin.form ??
            row.origin.surface;
          return (
            <li key={row.id} className="py-2.5 first:pt-0 last:pb-0">
              <Link href={`/admin/enquiries/${row.id}`} className="group block">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] text-bz-ink truncate group-hover:text-bz-accent">
                    {subject}
                  </span>
                  <span className="mono text-[11px] text-bz-muted shrink-0">
                    {formatDate(row.created_at)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-bz-muted">
                  <span
                    className={cn(
                      "inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-medium",
                      STATUS_STYLES[row.status],
                    )}
                  >
                    {STATUS_LABELS[row.status]}
                  </span>
                  <span>{row.origin.surface}</span>
                  {row.archived_at ? <span>· archived</span> : null}
                  {sameName(row.name) ? null : <span>· as “{row.name}”</span>}
                  {/* A shared number is a household as often as a person. */}
                  {row.matchedOn.includes("email") ? null : (
                    <span>· same phone</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
