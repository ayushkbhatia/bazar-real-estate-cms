import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

export type CrmSync = {
  state: string;
  syncedAt: string | null;
  error: string | null;
  /** The record in Salesforce, when it has one and the instance is known. */
  url: string | null;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Where the lead went after it arrived — the answer to "is it in Salesforce
 * yet?" without leaving the enquiry.
 *
 * The acknowledgement row appears only when `ack_sent_at` is set. The inline
 * send at submission does not stamp it, so an empty column cannot be read as
 * "nothing was sent" and is never shown as such.
 */
export function FollowThrough({
  crm,
  ackSentAt,
}: {
  /** Null when Salesforce isn't connected — the queue means nothing then. */
  crm: CrmSync | null;
  ackSentAt: string | null;
}) {
  if (!crm && !ackSentAt) return null;

  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
      <Eyebrow>Follow-through</Eyebrow>
      <dl className="mt-3 grid grid-cols-[84px_1fr] gap-x-3 gap-y-2 text-[12.5px]">
        {crm ? (
          <>
            <dt className="text-bz-muted">Salesforce</dt>
            <dd className="min-w-0">
              <CrmLine crm={crm} />
            </dd>
          </>
        ) : null}
        {ackSentAt ? (
          <>
            <dt className="text-bz-muted">Auto-reply</dt>
            <dd className="text-bz-ink-2">Emailed {formatDateTime(ackSentAt)}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

function CrmLine({ crm }: { crm: CrmSync }) {
  switch (crm.state) {
    case "synced":
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-bz-ink-2">
          <span>
            Synced{crm.syncedAt ? ` ${formatDateTime(crm.syncedAt)}` : ""}
          </span>
          {crm.url ? (
            <a
              href={crm.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink"
            >
              Open record <ExternalLink size={11} />
            </a>
          ) : null}
        </div>
      );
    case "pending":
      return (
        <span className="text-bz-ink-2">
          Queued — the sync runs every five minutes
          {crm.error ? (
            <span className="block mt-0.5 text-[11.5px] text-bz-muted break-words">
              Last attempt: {crm.error}
            </span>
          ) : null}
        </span>
      );
    case "failed":
      return (
        <span className="text-bz-danger">
          Didn&apos;t reach Salesforce
          {crm.error ? (
            <span className="block mt-0.5 text-[11.5px] break-words">
              {crm.error}
            </span>
          ) : null}
          <Link
            href="/admin/settings/integrations"
            className="block mt-0.5 text-[11.5px] text-bz-muted underline underline-offset-2 hover:text-bz-ink"
          >
            Integration status
          </Link>
        </span>
      );
    case "skipped":
      // Two ways here: the lead predates the sync (0130's backfill), or a
      // data-deletion request withdrew it before it went (dsr/_actions.ts).
      return (
        <span className="text-bz-muted">
          Not sent — older than the sync, or held back by a data request
        </span>
      );
    default:
      return <span className="text-bz-muted">{crm.state}</span>;
  }
}
