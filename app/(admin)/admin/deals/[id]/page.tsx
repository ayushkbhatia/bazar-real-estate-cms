import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Eyebrow } from "@/components/brand/eyebrow";
import { getDealById } from "@/lib/queries/deals";
import { DEAL_STAGE_LABELS } from "@/lib/deals";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function formatAed(n: number | null): string {
  if (n == null) return "—";
  return `AED ${Math.round(n).toLocaleString()}`;
}

export default async function DealDetailPage({ params }: PageProps) {
  const { id } = await params;
  const deal = await getDealById(id);
  if (!deal) notFound();

  const buyerName =
    [deal.buyer?.first_name, deal.buyer?.last_name].filter(Boolean).join(" ") ||
    "—";

  return (
    <CmsShell
      title={`Deal · ${deal.properties?.reference ?? "—"}`}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/deals" className="hover:text-bz-ink">
            Deals
          </Link>
          <ChevronRight size={11} />
          <span className="mono">{deal.id.slice(0, 8)}</span>
        </span>
      }
    >
      <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
        <Eyebrow>Stage</Eyebrow>
        <div className="mt-2 text-bz-ink serif text-2xl">
          {DEAL_STAGE_LABELS[deal.stage]}
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-[13px]">
          <div>
            <dt className="text-bz-muted text-[11px] uppercase tracking-wide">
              Buyer
            </dt>
            <dd className="text-bz-ink mt-1">{buyerName}</dd>
          </div>
          <div>
            <dt className="text-bz-muted text-[11px] uppercase tracking-wide">
              Lead agent
            </dt>
            <dd className="text-bz-ink mt-1">
              {deal.agent?.display_name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-bz-muted text-[11px] uppercase tracking-wide">
              Price
            </dt>
            <dd className="text-bz-ink mt-1 mono">
              {formatAed(deal.price_aed)}
            </dd>
          </div>
          <div>
            <dt className="text-bz-muted text-[11px] uppercase tracking-wide">
              Advisory fee
            </dt>
            <dd className="text-bz-ink mt-1 mono">
              {formatAed(deal.advisory_fee_aed)}
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-[12px] text-bz-muted">
          Full transaction file (timeline, documents, context) lands in G5.
        </p>
      </div>
    </CmsShell>
  );
}
