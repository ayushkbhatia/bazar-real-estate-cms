import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { listEnquiriesForUser } from "@/lib/queries/enquiries";

export const metadata: Metadata = {
  title: "My enquiries",
  description: "Your conversations with Bazar advisors.",
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  qualifying: "Qualifying",
  viewing: "Viewing",
  offer: "Offer",
  negotiation: "Negotiation",
  closed_won: "Closed",
  closed_lost: "Closed",
};

export default async function AccountEnquiriesPage() {
  const rows = await listEnquiriesForUser();

  return (
    <div>
      <Eyebrow>Enquiries</Eyebrow>
      <h1
        className="serif text-[48px] mt-2 font-normal leading-[1.05]"
        style={{ letterSpacing: "-0.025em" }}
      >
        Your conversations.
      </h1>
      <p className="mt-4 text-[15px] text-bz-muted max-w-[60ch]">
        Every brief you&apos;ve sent to a Bazar advisor lives here. Replies
        appear in-thread; new advisor messages send an email alert.
      </p>

      {rows.length === 0 ? (
        <div className="mt-12 py-16 text-center max-w-[52ch] mx-auto border border-dashed border-bz-border rounded-md">
          <p className="text-[15px] text-bz-ink-2">
            You haven&apos;t sent any briefs yet.
          </p>
          <Button asChild className="mt-6">
            <Link href="/contact">Start a conversation</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-10 flex flex-col gap-2">
          {rows.map((row) => {
            const status =
              STATUS_LABEL[row.status as keyof typeof STATUS_LABEL] ?? "Open";
            return (
              <li key={row.id}>
                <Link
                  href={`/account/enquiries/${row.id}`}
                  className="group block rounded-md border border-bz-border bg-bz-surface p-5 hover:border-bz-border-strong transition-colors"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 text-[12px]">
                        <span className="uppercase tracking-wider text-bz-accent">
                          {status}
                        </span>
                        {row.unread_count > 0 ? (
                          <span className="inline-flex items-center h-5 px-2 rounded-full bg-bz-accent text-bz-accent-fg text-[10.5px] font-medium">
                            {row.unread_count} new
                          </span>
                        ) : null}
                        <span className="text-bz-muted">·</span>
                        <span className="mono text-bz-muted">
                          {formatRelative(row.created_at)}
                        </span>
                      </div>
                      <div
                        className="serif text-[19px] mt-1.5 truncate"
                        style={{ letterSpacing: "-0.008em" }}
                      >
                        {row.properties
                          ? row.properties.title
                          : "General brief"}
                      </div>
                      {row.properties ? (
                        <div className="mono text-[11px] text-bz-muted mt-0.5">
                          {row.properties.reference}
                        </div>
                      ) : null}
                      {row.brief_raw ? (
                        <p className="mt-2.5 text-[13px] text-bz-ink-2 leading-snug line-clamp-2">
                          {row.brief_raw}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {row.staff ? (
                        <>
                          <div className="text-[11px] uppercase tracking-wider text-bz-muted">
                            Advisor
                          </div>
                          <div className="text-[13px] text-bz-ink mt-0.5">
                            {row.staff.display_name}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11.5px] text-bz-muted italic">
                          Assigning advisor…
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
