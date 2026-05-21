import Link from "next/link";
import { CmsShell } from "@/components/brand/cms-shell";
import { countDealsByStage, listDeals } from "@/lib/queries/deals";
import { DEAL_STAGES, DEAL_STAGE_LABELS, type DealStage } from "@/lib/deals";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ stage?: string; q?: string }>;
};

function isStage(v: string | undefined): v is DealStage {
  return !!v && (DEAL_STAGES as readonly string[]).includes(v);
}

function formatAed(n: number | null): string {
  if (n == null) return "—";
  return `AED ${Math.round(n).toLocaleString()}`;
}

function formatPercent(price: number, fee: number): string {
  if (!price) return "—";
  const pct = (fee / price) * 100;
  if (!Number.isFinite(pct)) return "—";
  return `${pct.toFixed(2)}%`;
}

function stageEnteredAt(deal: {
  stage: DealStage;
  mou_signed_at: string | null;
  noc_obtained_at: string | null;
  transferred_at: string | null;
  updated_at: string;
  created_at: string;
}): string {
  if (deal.stage === "transferred" && deal.transferred_at)
    return deal.transferred_at;
  if (deal.stage === "noc_pending" && deal.noc_obtained_at)
    return deal.noc_obtained_at;
  if (deal.stage === "mou" && deal.mou_signed_at) return deal.mou_signed_at;
  return deal.updated_at ?? deal.created_at;
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

export default async function DealsListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const stage = isStage(params.stage) ? params.stage : null;
  const search = params.q ?? null;

  const [{ rows }, counts] = await Promise.all([
    listDeals({ stage, search, limit: 200 }),
    countDealsByStage(),
  ]);

  const tabs: { value: DealStage | "all"; label: string }[] = [
    { value: "all", label: "All" },
    ...DEAL_STAGES.map((s) => ({ value: s, label: DEAL_STAGE_LABELS[s] })),
  ];
  const activeTab: DealStage | "all" = stage ?? "all";

  return (
    <CmsShell title="Deals">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <nav className="flex flex-wrap gap-1">
            {tabs.map((t) => {
              const href =
                t.value === "all"
                  ? "/admin/deals"
                  : `/admin/deals?stage=${t.value}`;
              const active = activeTab === t.value;
              const count = counts[t.value] ?? 0;
              return (
                <Link
                  key={t.value}
                  href={href}
                  className={cn(
                    "px-3 h-8 inline-flex items-center gap-2 rounded text-[13px] transition-colors",
                    active
                      ? "bg-bz-ink text-bz-bg"
                      : "text-bz-ink-2 hover:bg-bz-surface-2",
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "mono text-[11px] tabular-nums px-1.5 rounded",
                      active ? "bg-bz-bg/15" : "bg-bz-surface-3 text-bz-muted",
                    )}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </nav>
          <form className="flex items-center gap-2" method="GET" action="/admin/deals">
            {stage ? <input type="hidden" name="stage" value={stage} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={search ?? ""}
              placeholder="Search ref or buyer name"
              className="h-8 w-[260px] px-3 rounded border border-bz-border bg-bz-surface text-[13px] placeholder:text-bz-muted focus:outline-none focus:border-bz-border-strong"
              aria-label="Search deals"
            />
          </form>
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="border-b border-bz-border bg-bz-surface-2">
              <tr className="text-left text-[11px] uppercase tracking-wider text-bz-muted">
                <th className="px-4 py-2.5 font-medium">Ref / Property</th>
                <th className="px-4 py-2.5 font-medium">Buyer</th>
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 font-medium">Stage</th>
                <th className="px-4 py-2.5 font-medium text-right">Price</th>
                <th className="px-4 py-2.5 font-medium text-right">
                  Advisory fee
                </th>
                <th className="px-4 py-2.5 font-medium text-right">
                  In stage
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-bz-muted"
                  >
                    No deals yet
                    {stage
                      ? ` at ${DEAL_STAGE_LABELS[stage]} stage`
                      : ""}
                    .
                  </td>
                </tr>
              ) : (
                rows.map((d) => {
                  const buyerName =
                    [d.buyer?.first_name, d.buyer?.last_name]
                      .filter(Boolean)
                      .join(" ") || "—";
                  return (
                    <tr
                      key={d.id}
                      className="border-t border-bz-border hover:bg-bz-surface-2/60"
                    >
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/admin/deals/${d.id}`}
                          className="font-medium text-bz-ink hover:text-bz-accent"
                        >
                          {d.properties?.reference ?? "—"}
                        </Link>
                        <div className="text-[11.5px] text-bz-muted line-clamp-1">
                          {d.properties?.title ?? ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">{buyerName}</td>
                      <td className="px-4 py-3 align-top">
                        {d.agent?.display_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="inline-flex px-2 py-0.5 rounded text-[11.5px] font-medium bg-bz-surface-3 text-bz-ink-2">
                          {DEAL_STAGE_LABELS[d.stage]}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-right mono tabular-nums">
                        {formatAed(d.price_aed)}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="mono tabular-nums">
                          {formatAed(d.advisory_fee_aed)}
                        </div>
                        <div className="text-[11px] text-bz-muted">
                          {formatPercent(d.price_aed, d.advisory_fee_aed)}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-right text-bz-muted text-[12px]">
                        {relative(stageEnteredAt(d))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </CmsShell>
  );
}
