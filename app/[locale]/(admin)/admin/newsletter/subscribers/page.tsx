import Link from "next/link";
import { CmsShell } from "@/components/brand/cms-shell";
import { getStaffRole, requireRole } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/schemas/staff";
import { isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";
import { NEWSLETTER_SEND_ROLES } from "@/lib/newsletter/campaign";
import { campaignCount, subscriberCounts } from "../_data";
import { NewsletterTabs, formatDubai } from "../_shared";
import { ResendAllPending, SubscriberRowActions } from "./_row-actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const STATUSES = ["confirmed", "pending", "unsubscribed", "bounced"] as const;
type Filter = (typeof STATUSES)[number] | "all";

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  pending: "bg-[oklch(0.95_0.05_85)] text-[oklch(0.42_0.09_70)]",
  unsubscribed: "bg-bz-surface-2 text-bz-muted",
  bounced: "bg-[oklch(0.95_0.04_28)] text-[oklch(0.45_0.12_28)]",
};

type Row = {
  id: string;
  email: string;
  status: string;
  locale: string;
  source: string | null;
  subscribed_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  confirmation_sent_at: string | null;
};

type SP = { status?: string; lang?: string; q?: string; page?: string };

function href(sp: SP, patch: Partial<SP>): string {
  const next = { ...sp, ...patch };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
  const query = params.toString();
  return `/admin/newsletter/subscribers${query ? `?${query}` : ""}`;
}

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { supabase } = await requireRole(STAFF_ROLES);
  const sp = await searchParams;
  const status: Filter = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as Filter) : "all";
  const lang = sp.lang === "en" || sp.lang === "ar" ? sp.lang : "";
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  let query = supabase
    .from("newsletter_subscribers")
    .select("id, email, status, locale, source, subscribed_at, confirmed_at, unsubscribed_at, confirmation_sent_at", {
      count: "exact",
    })
    .order("subscribed_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status !== "all") query = query.eq("status", status);
  if (lang) query = query.eq("locale", lang);
  // `%`, `_` and `,` are PostgREST/LIKE syntax; an address never needs them.
  if (q) query = query.ilike("email", `%${q.replace(/[%_,()]/g, "")}%`);

  const [role, counts, campaigns, result] = await Promise.all([
    getStaffRole(),
    subscriberCounts(),
    campaignCount(),
    isSupabaseConfigured ? query : Promise.resolve({ data: [] as Row[], count: 0 }),
  ]);
  const rows = (result.data ?? []) as Row[];
  const total = result.count ?? 0;
  const canAct = role !== null && (NEWSLETTER_SEND_ROLES as readonly string[]).includes(role);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const statusTabs: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "All", n: counts.total },
    { id: "confirmed", label: "Confirmed", n: counts.confirmed },
    { id: "pending", label: "Pending", n: counts.pending },
    { id: "unsubscribed", label: "Unsubscribed", n: counts.unsubscribed },
    { id: "bounced", label: "Bounced", n: counts.bounced },
  ];

  return (
    <CmsShell
      title="Subscribers"
      breadcrumbs="Content · Newsletter"
      primary={canAct ? <ResendAllPending count={counts.pending} /> : undefined}
    >
      <div className="flex flex-col gap-5">
        <NewsletterTabs active="subscribers" counts={{ campaigns, confirmed: counts.confirmed }} />

        <nav aria-label="Subscriber status" className="border-b border-bz-border flex gap-5 overflow-x-auto">
          {statusTabs.map((t) => (
            <Link
              key={t.id}
              href={href(sp, { status: t.id === "all" ? undefined : t.id, page: undefined })}
              aria-current={status === t.id ? "page" : undefined}
              className={cn(
                "py-3 inline-flex items-center gap-2 text-[13.5px] border-b-2 -mb-px whitespace-nowrap",
                status === t.id ? "border-bz-teal text-bz-teal" : "border-transparent text-bz-muted hover:text-bz-ink-2",
              )}
            >
              {t.label}
              <span className="mono text-[11px] px-1.5 rounded bg-bz-surface-2 text-bz-muted">{t.n}</span>
            </Link>
          ))}
        </nav>

        <form className="flex flex-wrap items-center gap-3" action="/admin/newsletter/subscribers">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search email…"
            className="h-8 w-[240px] px-2.5 rounded border border-bz-border bg-bz-bg text-[13px] outline-none focus:border-bz-accent"
          />
          <label className="inline-flex items-center gap-1.5 text-[11.5px] text-bz-muted">
            Language
            <select
              name="lang"
              defaultValue={lang}
              className="h-8 px-2.5 rounded border border-bz-border bg-bz-bg text-[13px] text-bz-ink outline-none focus:border-bz-accent"
            >
              <option value="">Both</option>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </label>
          <button type="submit" className="h-8 px-3 rounded border border-bz-border text-[12.5px] hover:bg-bz-surface-2">
            Filter
          </button>
          {q || lang ? (
            <Link href={href(sp, { q: undefined, lang: undefined, page: undefined })} className="text-[12px] text-bz-muted hover:text-bz-ink">
              Clear
            </Link>
          ) : null}
          <span className="ms-auto text-[12.5px] text-bz-muted">
            {total} {total === 1 ? "subscriber" : "subscribers"}
          </span>
        </form>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-bz-border p-8 text-center text-[13px] text-bz-muted">
            Nobody matches.
          </p>
        ) : (
          <div className="rounded-lg border border-bz-border bg-bz-surface overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11.5px] text-bz-muted border-b border-bz-border">
                  <th className="text-start font-normal px-4 py-2.5">Email</th>
                  <th className="text-start font-normal px-4 py-2.5">Status</th>
                  <th className="text-start font-normal px-4 py-2.5">Language</th>
                  <th className="text-start font-normal px-4 py-2.5">Signed up</th>
                  <th className="text-start font-normal px-4 py-2.5">Since</th>
                  <th className="text-start font-normal px-4 py-2.5">Source</th>
                  {canAct ? <th className="px-4 py-2.5" /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-bz-border last:border-0">
                    <td className="px-4 py-2.5 mono text-[12.5px]">{r.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium", STATUS_STYLE[r.status])}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-bz-ink-2">{r.locale === "ar" ? "Arabic" : "English"}</td>
                    <td className="px-4 py-2.5 text-bz-ink-2 whitespace-nowrap">{formatDubai(r.subscribed_at)}</td>
                    <td className="px-4 py-2.5 text-bz-ink-2 whitespace-nowrap">
                      {r.status === "confirmed"
                        ? `Confirmed ${formatDubai(r.confirmed_at)}`
                        : r.status === "unsubscribed"
                          ? `Left ${formatDubai(r.unsubscribed_at)}`
                          : r.status === "pending"
                            ? `Last emailed ${formatDubai(r.confirmation_sent_at)}`
                            : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-bz-muted text-[12px]">{r.source ?? "—"}</td>
                    {canAct ? (
                      <td className="px-4 py-2.5 text-end whitespace-nowrap">
                        <SubscriberRowActions id={r.id} email={r.email} status={r.status} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 ? (
          <div className="flex items-center justify-between text-[12.5px]">
            {page > 1 ? (
              <Link href={href(sp, { page: String(page - 1) })} className="hover:underline">
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-bz-muted">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={href(sp, { page: String(page + 1) })} className="hover:underline">
                Older →
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </div>
    </CmsShell>
  );
}
