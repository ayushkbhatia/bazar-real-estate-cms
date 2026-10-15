import Link from "next/link";
import { Plus } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Button } from "@/components/ui/button";
import { getStaffRole, requireRole } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/schemas/staff";
import { isSupabaseConfigured } from "@/lib/env";
import {
  AUDIENCE_LABELS,
  NEWSLETTER_WRITE_ROLES,
  type Audience,
  type CampaignStatus,
} from "@/lib/newsletter/campaign";
import { createCampaign } from "./_actions";
import { subscriberCounts } from "./_data";
import { CampaignStatusPill, NewsletterTabs, formatDubai } from "./_shared";

export const dynamic = "force-dynamic";

type ListRow = {
  id: string;
  subject: string;
  status: CampaignStatus;
  audience: string;
  subject_ar: string | null;
  recipient_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  started_at: string | null;
  updated_at: string;
};

export default async function NewsletterPage() {
  const { supabase } = await requireRole(STAFF_ROLES);
  const [role, counts, { data }] = await Promise.all([
    getStaffRole(),
    subscriberCounts(),
    isSupabaseConfigured
      ? supabase
          .from("newsletter_campaigns")
          .select("id, subject, status, audience, subject_ar, recipient_count, scheduled_at, sent_at, started_at, updated_at")
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as ListRow[] }),
  ]);
  const rows = (data ?? []) as ListRow[];
  const canWrite = role !== null && (NEWSLETTER_WRITE_ROLES as readonly string[]).includes(role);

  return (
    <CmsShell
      title="Newsletter"
      breadcrumbs="Content · Newsletter"
      primary={
        canWrite ? (
          <form action={createCampaign}>
            <Button type="submit">
              <Plus size={14} strokeWidth={1.8} />
              New newsletter
            </Button>
          </form>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <NewsletterTabs active="campaigns" counts={{ campaigns: rows.length, confirmed: counts.confirmed }} />

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["Confirmed", counts.confirmed, "receive newsletters"],
            ["English", counts.confirmedEn, "confirmed, English"],
            ["Arabic", counts.confirmedAr, "confirmed, Arabic"],
            ["Pending", counts.pending, "haven't confirmed yet"],
          ].map(([label, value, note]) => (
            <div key={label as string} className="rounded-lg border border-bz-border bg-bz-surface p-4">
              <dt className="text-[11.5px] text-bz-muted">{label}</dt>
              <dd className="mt-1 serif text-[28px] leading-none">{value}</dd>
              <dd className="mt-1.5 text-[11.5px] text-bz-muted">{note}</dd>
            </div>
          ))}
        </dl>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-bz-border p-10 text-center">
            <p className="serif text-[22px]">No newsletters yet</p>
            <p className="mt-2 text-[13px] text-bz-muted max-w-[52ch] mx-auto">
              Write one in the same editor as the site&apos;s emails, preview it on desktop and phone, send yourself a
              test, then send it to your {counts.confirmed} confirmed subscriber{counts.confirmed === 1 ? "" : "s"} — now
              or at a time you choose.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-bz-border bg-bz-surface overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-start text-[11.5px] text-bz-muted border-b border-bz-border">
                  <th className="text-start font-normal px-4 py-2.5">Subject</th>
                  <th className="text-start font-normal px-4 py-2.5">Status</th>
                  <th className="text-start font-normal px-4 py-2.5">Audience</th>
                  <th className="text-end font-normal px-4 py-2.5">Recipients</th>
                  <th className="text-start font-normal px-4 py-2.5">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-bz-border last:border-0 hover:bg-bz-surface-2/60">
                    <td className="px-4 py-3 max-w-[420px]">
                      <Link href={`/admin/newsletter/${r.id}`} className="font-medium hover:underline">
                        {r.subject.trim() || <span className="text-bz-muted italic">Untitled draft</span>}
                      </Link>
                      {r.subject_ar?.trim() ? (
                        <span className="ms-2 text-[11px] text-bz-muted">+ Arabic</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <CampaignStatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-bz-ink-2">{AUDIENCE_LABELS[r.audience as Audience] ?? r.audience}</td>
                    <td className="px-4 py-3 text-end mono">{r.status === "sending" || r.status === "sent" ? r.recipient_count : "—"}</td>
                    <td className="px-4 py-3 text-bz-ink-2 whitespace-nowrap">
                      {r.status === "sent"
                        ? `Sent ${formatDubai(r.sent_at)}`
                        : r.status === "sending"
                          ? `Started ${formatDubai(r.started_at)}`
                          : r.status === "scheduled"
                            ? `Sends ${formatDubai(r.scheduled_at)}`
                            : `Edited ${formatDubai(r.updated_at)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CmsShell>
  );
}
