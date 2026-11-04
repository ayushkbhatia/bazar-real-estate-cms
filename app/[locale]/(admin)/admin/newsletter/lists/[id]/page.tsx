import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { getStaffRole, requireRole } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/schemas/staff";
import { cn } from "@/lib/utils";
import { NEWSLETTER_SEND_ROLES } from "@/lib/newsletter/campaign";
import { formatDubai } from "../../_shared";
import { ListTools } from "./_tools";
import { ContactRowActions } from "./_row-actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const STATUSES = ["active", "unsubscribed", "bounced"] as const;
const STATUS_STYLE: Record<string, string> = {
  active: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  unsubscribed: "bg-bz-surface-2 text-bz-muted",
  bounced: "bg-[oklch(0.95_0.04_28)] text-[oklch(0.45_0.12_28)]",
};

type SP = { status?: string; q?: string; page?: string };

export default async function ListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireRole(STAFF_ROLES);
  const role = await getStaffRole();
  if (role === null || !(NEWSLETTER_SEND_ROLES as readonly string[]).includes(role)) notFound();
  const { data: list } = await supabase.from("newsletter_lists").select("id, name, description, created_at").eq("id", id).maybeSingle();
  if (!list) notFound();

  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status! : "";
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  let query = supabase
    .from("newsletter_list_contacts")
    .select("id, email, name, locale, status, source, created_at, unsubscribed_at", { count: "exact" })
    .eq("list_id", id)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`email.ilike.%${q.replace(/[%_,()]/g, "")}%,name.ilike.%${q.replace(/[%_,()]/g, "")}%`);
  const [{ data: rows, count }, ...tallies] = await Promise.all([
    query,
    ...STATUSES.map((s) => supabase.from("newsletter_list_contacts").select("id", { count: "exact", head: true }).eq("list_id", id).eq("status", s)),
  ]);
  const tally = Object.fromEntries(STATUSES.map((s, i) => [s, tallies[i]?.count ?? 0])) as Record<(typeof STATUSES)[number], number>;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, q, page: "", ...patch })) if (v) next.set(k, String(v));
    const qs = next.toString();
    return `/admin/newsletter/lists/${id}${qs ? `?${qs}` : ""}`;
  };

  const crumbs = (
    <span className="inline-flex items-center gap-1">
      <Link href="/admin/newsletter/lists" className="hover:text-bz-ink">
        Content · Newsletter · Lists
      </Link>
      <ChevronRight size={11} />
      <span className="truncate max-w-[40ch]">{list.name}</span>
    </span>
  );

  return (
    <CmsShell title={list.name} breadcrumbs={crumbs}>
      <div className="flex flex-col gap-6">
        <ListTools id={id} name={list.name} description={list.description} />

        <dl className="grid grid-cols-3 gap-3 max-w-[560px]">
          {[
            ["Active", tally.active, "receive campaigns"],
            ["Unsubscribed", tally.unsubscribed, "never mailed again"],
            ["Bounced", tally.bounced, "address doesn't exist"],
          ].map(([label, value, note]) => (
            <div key={label as string} className="rounded-lg border border-bz-border bg-bz-surface p-4">
              <dt className="text-[11.5px] text-bz-muted">{label}</dt>
              <dd className="mt-1 serif text-[28px] leading-none">{value}</dd>
              <dd className="mt-1.5 text-[11.5px] text-bz-muted">{note}</dd>
            </div>
          ))}
        </dl>

        <form className="flex flex-wrap items-center gap-2" action={`/admin/newsletter/lists/${id}`}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or email"
            className="h-8 w-[240px] border border-bz-border rounded px-2 text-[12.5px] bg-bz-bg"
          />
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <nav className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5" aria-label="Status">
            {(["", ...STATUSES] as const).map((s) => (
              <Link
                key={s || "all"}
                href={href({ status: s })}
                className={cn("h-7 px-2.5 inline-flex items-center rounded text-[12px]", status === s ? "bg-bz-navy text-bz-bg" : "text-bz-ink-2")}
              >
                {s ? s[0]!.toUpperCase() + s.slice(1) : "All"}
              </Link>
            ))}
          </nav>
        </form>

        {total === 0 ? (
          <div className="rounded-lg border border-dashed border-bz-border p-10 text-center text-[13px] text-bz-muted">
            {q || status ? "Nobody matches." : "No one on this list yet — upload a CSV or add someone."}
          </div>
        ) : (
          <div className="rounded-lg border border-bz-border bg-bz-surface overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11.5px] text-bz-muted border-b border-bz-border">
                  <th className="text-start font-normal px-4 py-2.5">Name</th>
                  <th className="text-start font-normal px-4 py-2.5">Email</th>
                  <th className="text-start font-normal px-4 py-2.5">Language</th>
                  <th className="text-start font-normal px-4 py-2.5">Status</th>
                  <th className="text-start font-normal px-4 py-2.5">Added</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-bz-border last:border-0">
                    <td className="px-4 py-2.5">{r.name || <span className="text-bz-muted">—</span>}</td>
                    <td className="px-4 py-2.5 mono text-[12.5px]">{r.email}</td>
                    <td className="px-4 py-2.5 text-bz-ink-2">{r.locale === "ar" ? "Arabic" : "English"}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex h-[22px] items-center px-2 rounded-full text-[11px] font-medium", STATUS_STYLE[r.status])}>{r.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-bz-ink-2 whitespace-nowrap">
                      {formatDubai(r.created_at)}
                      <span className="text-bz-muted"> · {r.source === "manual" ? "by hand" : "upload"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-end">
                      <ContactRowActions listId={id} contactId={r.id} active={r.status === "active"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 ? (
          <div className="flex items-center gap-3 text-[12.5px]">
            {page > 1 ? <Link href={href({ page: String(page - 1) })} className="underline">Previous</Link> : null}
            <span className="text-bz-muted">
              Page {page} of {pages} · {total} people
            </span>
            {page < pages ? <Link href={href({ page: String(page + 1) })} className="underline">Next</Link> : null}
          </div>
        ) : null}
      </div>
    </CmsShell>
  );
}
