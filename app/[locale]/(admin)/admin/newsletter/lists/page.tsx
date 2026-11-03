import Link from "next/link";
import { CmsShell } from "@/components/brand/cms-shell";
import { getStaffRole, requireRole } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/schemas/staff";
import { isSupabaseConfigured } from "@/lib/env";
import { NEWSLETTER_SEND_ROLES } from "@/lib/newsletter/campaign";
import { campaignCount, subscriberCounts } from "../_data";
import { NewsletterTabs, formatDubai } from "../_shared";
import { NewListButton } from "./_new-list";

export const dynamic = "force-dynamic";

type Counts = { active: number; unsubscribed: number; bounced: number };

export default async function NewsletterListsPage() {
  const { supabase } = await requireRole(STAFF_ROLES);
  const [role, counts, campaigns] = await Promise.all([getStaffRole(), subscriberCounts(), campaignCount()]);
  const canManage = role !== null && (NEWSLETTER_SEND_ROLES as readonly string[]).includes(role);
  const { data, error } = isSupabaseConfigured
    ? await supabase.from("newsletter_lists").select("id, name, description, updated_at").order("updated_at", { ascending: false })
    : { data: [], error: null };
  const lists = data ?? [];
  const tallies = new Map<string, Counts>();
  if (canManage) {
    await Promise.all(
      lists.map(async (l) => {
        const head = (status: string) =>
          supabase.from("newsletter_list_contacts").select("id", { count: "exact", head: true }).eq("list_id", l.id).eq("status", status);
        const [a, u, b] = await Promise.all([head("active"), head("unsubscribed"), head("bounced")]);
        tallies.set(l.id, { active: a.count ?? 0, unsubscribed: u.count ?? 0, bounced: b.count ?? 0 });
      }),
    );
  }

  return (
    <CmsShell title="Newsletter" breadcrumbs="Content · Newsletter · Lists" primary={canManage ? <NewListButton /> : undefined}>
      <div className="flex flex-col gap-6">
        <NewsletterTabs active="lists" counts={{ campaigns, confirmed: counts.confirmed, lists: lists.length }} />
        <p className="text-[12.5px] text-bz-muted max-w-[80ch]">
          Lists of people to send a campaign to besides — or instead of — the subscribers: an event&apos;s guests, a
          launch&apos;s registrants. Upload a CSV of names and addresses, then pick the list in a newsletter&apos;s
          Audience step. Everyone gets an unsubscribe link; anyone who unsubscribes or bounces, here or as a subscriber,
          is never mailed by any list again.
        </p>
        {error ? (
          <p className="text-[12.5px] text-bz-muted">Lists aren&apos;t set up in this database yet (migration 0176).</p>
        ) : !canManage ? (
          <p className="text-[12.5px] text-bz-muted">Lists hold personal data, so only admins and marketing can open them.</p>
        ) : lists.length === 0 ? (
          <div className="rounded-lg border border-dashed border-bz-border p-10 text-center">
            <p className="serif text-[22px]">No lists yet</p>
            <p className="mt-2 text-[13px] text-bz-muted max-w-[52ch] mx-auto">
              Make a list, upload a CSV with a name and an email column, and it&apos;s ready to send to.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-bz-border bg-bz-surface overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11.5px] text-bz-muted border-b border-bz-border">
                  <th className="text-start font-normal px-4 py-2.5">List</th>
                  <th className="text-end font-normal px-4 py-2.5">Active</th>
                  <th className="text-end font-normal px-4 py-2.5">Unsubscribed</th>
                  <th className="text-end font-normal px-4 py-2.5">Bounced</th>
                  <th className="text-start font-normal px-4 py-2.5">Edited</th>
                </tr>
              </thead>
              <tbody>
                {lists.map((l) => {
                  const t = tallies.get(l.id);
                  return (
                    <tr key={l.id} className="border-b border-bz-border last:border-0 hover:bg-bz-surface-2/60">
                      <td className="px-4 py-3 max-w-[420px]">
                        <Link href={`/admin/newsletter/lists/${l.id}`} className="font-medium hover:underline">
                          {l.name}
                        </Link>
                        {l.description ? <span className="block text-[12px] text-bz-muted truncate">{l.description}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-end mono">{t?.active ?? "—"}</td>
                      <td className="px-4 py-3 text-end mono text-bz-muted">{t?.unsubscribed ?? "—"}</td>
                      <td className="px-4 py-3 text-end mono text-bz-muted">{t?.bounced ?? "—"}</td>
                      <td className="px-4 py-3 text-bz-ink-2 whitespace-nowrap">{formatDubai(l.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CmsShell>
  );
}
