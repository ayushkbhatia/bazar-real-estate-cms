import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { AUDIENCE_LABELS, type Audience, type CampaignRow } from "@/lib/newsletter/campaign";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import { duplicateCampaign } from "../_actions";
import { formatDubai } from "../_shared";
import type { DeliveryCounts } from "@/lib/newsletter/send";
import { ReportPreview, RefreshWhileSending } from "./_report-client";

/** A campaign that has gone out (or is going): what was sent, to how many, and how it went. */
export function CampaignReport({
  campaign,
  counts,
  english,
  arabic,
  from,
  replyTo,
  canWrite,
}: {
  campaign: CampaignRow;
  counts: DeliveryCounts;
  english: RenderedEmail;
  arabic: RenderedEmail | null;
  from: string;
  replyTo: string;
  canWrite: boolean;
}) {
  const total = campaign.recipient_count;
  const done = counts.sent + counts.failed + counts.skipped;
  const pct = total > 0 ? Math.round((done / total) * 100) : 100;
  const sending = campaign.status === "sending";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,660px)] gap-6 items-start">
      <div className="flex flex-col gap-5 min-w-0">
        {sending ? <RefreshWhileSending /> : null}
        <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-4">
          <Eyebrow>{sending ? "Sending" : "Sent"}</Eyebrow>
          <div>
            <div className="flex items-baseline justify-between text-[12.5px] text-bz-muted">
              <span>
                {done} of {total} processed
              </span>
              <span className="mono">{pct}%</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-bz-surface-2 overflow-hidden">
              <div className="h-full bg-bz-teal transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(
              [
                ["Delivered to Resend", counts.sent],
                ["Queued", counts.queued + counts.sending],
                ["Skipped", counts.skipped],
                ["Failed", counts.failed],
                ["Audience", total],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-md border border-bz-border p-3">
                <dt className="text-[11px] text-bz-muted">{label}</dt>
                <dd className="mt-1 serif text-[24px] leading-none">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[12px] text-bz-muted">
            Skipped means the subscriber left the list before their copy went out, or email was switched off where
            this ran (a dry run). Failed means Resend refused it three times.
          </p>
          <dl className="grid grid-cols-3 gap-3">
            {(
              [
                ["Reached the inbox", counts.delivered],
                ["Bounced", counts.bounced],
                ["Marked as spam", counts.complained],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-md border border-bz-border p-3">
                <dt className="text-[11px] text-bz-muted">{label}</dt>
                <dd className="mt-1 serif text-[24px] leading-none">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[12px] text-bz-muted">
            Reported by the receiving mail servers, through Resend, usually within a minute of sending. A permanent
            bounce marks the address Bounced and it gets no more newsletters; marking one as spam unsubscribes that
            reader.
          </p>
          <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-[12.5px]">
            <dt className="text-bz-muted">Audience</dt>
            <dd>{AUDIENCE_LABELS[campaign.audience as Audience] ?? campaign.audience}</dd>
            <dt className="text-bz-muted">Started</dt>
            <dd>{formatDubai(campaign.started_at)}</dd>
            <dt className="text-bz-muted">Finished</dt>
            <dd>{sending ? "Still sending — this page updates by itself" : formatDubai(campaign.sent_at)}</dd>
          </dl>
        </section>
        {canWrite ? (
          <form action={duplicateCampaign.bind(null, campaign.id)}>
            <Button type="submit" variant="outline">
              <Copy size={14} strokeWidth={1.8} /> Use as the start of a new newsletter
            </Button>
          </form>
        ) : null}
      </div>
      <ReportPreview english={english} arabic={arabic} from={from} replyTo={replyTo} />
    </div>
  );
}
