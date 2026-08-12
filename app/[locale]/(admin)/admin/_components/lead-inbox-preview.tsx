import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Inbox } from "lucide-react";

type Row = {
  id: string;
  name: string;
  brief: string | null;
  status: string;
  temperature: string;
  ageMin: number;
  propertyTitle: string | null;
};

/**
 * Sprint 7a (backfilled): "Lead inbox" preview card on the admin
 * dashboard. Shows the 5 most-recent open enquiries with a quick-link
 * into the full inbox.
 */
export function LeadInboxPreview({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <Eyebrow>Inbox · open leads</Eyebrow>
          <h3
            className="serif text-[18px] mt-1 leading-tight"
            style={{ letterSpacing: "-0.01em" }}
          >
            What needs a reply.
          </h3>
        </div>
        <Link
          href="/admin/enquiries"
          className="text-[12.5px] text-bz-muted hover:text-bz-ink-2"
        >
          Open inbox →
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-center text-bz-muted text-[13px]">
          <Inbox size={20} strokeWidth={1.4} className="mx-auto mb-2 opacity-50" />
          Inbox is clean.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/enquiries/${r.id}`}
                className="block py-2 -mx-1 px-1 rounded hover:bg-bz-bg/60 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-bz-ink font-medium truncate">
                    {r.name}
                  </span>
                  <span
                    className={
                      r.temperature === "hot"
                        ? "text-[10.5px] uppercase tracking-wider text-bz-accent"
                        : r.ageMin > 60
                          ? "text-[10.5px] uppercase tracking-wider text-bz-danger"
                          : "text-[10.5px] uppercase tracking-wider text-bz-muted"
                    }
                  >
                    {r.temperature === "hot"
                      ? "Hot"
                      : r.ageMin > 60
                        ? `+${r.ageMin - 60}m overdue`
                        : `${r.ageMin}m ago`}
                  </span>
                </div>
                {r.propertyTitle ? (
                  <div className="text-[11.5px] text-bz-muted mt-0.5 truncate">
                    {r.propertyTitle}
                  </div>
                ) : null}
                {r.brief ? (
                  <p className="text-[12px] text-bz-ink-2 mt-1 line-clamp-1">
                    {r.brief}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
