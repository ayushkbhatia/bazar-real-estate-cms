import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Eyebrow } from "@/components/brand/eyebrow";
import { getDealById } from "@/lib/queries/deals";
import { listDocumentsForDeal } from "@/lib/queries/documents";
import { previewStageAdvance } from "@/lib/queries/deal-gate";
import { propertyUrl } from "@/lib/queries/property-utils";
import {
  DEAL_STAGE_LABELS,
  isKycKind,
  type DocumentKind,
  type DocumentStatus,
} from "@/lib/deals";
import { StageTimeline } from "./_timeline";
import { DocumentsPane } from "./_documents";
import { CommissionEditor } from "./_commission";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function formatAed(n: number | null): string {
  if (n == null) return "—";
  return `AED ${Math.round(n).toLocaleString()}`;
}

type DocItemShape = {
  id: string;
  kind: DocumentKind;
  status: DocumentStatus;
  filename: string | null;
  storage_key: string | null;
  size_bytes: number | null;
  rejected_reason: string | null;
  uploaded_at: string;
  owner_kind: "account" | "deal";
};

export default async function DealDetailPage({ params }: PageProps) {
  const { id } = await params;
  const deal = await getDealById(id);
  if (!deal) notFound();

  const [{ dealDocs, buyerDocs }, gatePreview] = await Promise.all([
    listDocumentsForDeal({
      dealId: deal.id,
      buyerAccountId: deal.buyer_account_id,
    }),
    previewStageAdvance({
      dealId: deal.id,
      stage: deal.stage,
      buyerAccountId: deal.buyer_account_id,
    }),
  ]);

  const buyerKycDocs = buyerDocs.filter((d) => isKycKind(d.kind));

  const reshape = (d: (typeof dealDocs)[number]): DocItemShape => ({
    id: d.id,
    kind: d.kind,
    status: d.status,
    filename: d.filename,
    storage_key: d.storage_key,
    size_bytes: d.size_bytes,
    rejected_reason: d.rejected_reason,
    uploaded_at: d.created_at,
    owner_kind: d.owner_kind as "account" | "deal",
  });

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
          <ChevronRight size={11} />
          <span>{DEAL_STAGE_LABELS[deal.stage]}</span>
        </span>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] gap-6 items-start">
        <aside className="bg-bz-surface border border-bz-border rounded-lg p-5 sticky top-6 self-start">
          <Eyebrow>Timeline</Eyebrow>
          <div className="mt-3">
            <StageTimeline
              dealId={deal.id}
              stage={deal.stage}
              stamps={{
                deposit: deal.mou_signed_at,
                dld_pending: deal.noc_obtained_at,
                transferred: deal.transferred_at,
              }}
              gatePreview={gatePreview}
            />
          </div>
        </aside>

        <section className="flex flex-col gap-5 min-w-0">
          <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
            <Eyebrow>Documents</Eyebrow>
            <div className="mt-4">
              <DocumentsPane
                dealId={deal.id}
                dealDocs={dealDocs.map(reshape)}
                buyerKycDocs={buyerKycDocs.map(reshape)}
              />
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-4 sticky top-6 self-start">
          {deal.properties ? (
            <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
              <Eyebrow>Property</Eyebrow>
              <div className="mt-3 text-[13px]">
                <div className="mono text-[11.5px] text-bz-muted">
                  {deal.properties.reference}
                </div>
                <div className="text-bz-ink mt-0.5 line-clamp-2">
                  {deal.properties.title}
                </div>
                <Link
                  href={propertyUrl({
                    slug: deal.properties.slug,
                    reference: deal.properties.reference,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-bz-muted hover:text-bz-ink"
                >
                  View on site <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          ) : null}

          <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
            <Eyebrow>Buyer</Eyebrow>
            <div className="mt-3 text-[13px]">
              <div className="font-medium">{buyerName}</div>
              <div className="text-[11.5px] text-bz-muted mono mt-0.5">
                {deal.buyer_account_id.slice(0, 8)}…
              </div>
            </div>
          </div>

          {deal.enquiry ? (
            <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
              <Eyebrow>Source enquiry</Eyebrow>
              <div className="mt-3 text-[13px]">
                <div>{deal.enquiry.name}</div>
                <Link
                  href={`/admin/enquiries/${deal.enquiry.id}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-bz-muted hover:text-bz-ink"
                >
                  View enquiry <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          ) : null}

          <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
            <Eyebrow>Lead agent</Eyebrow>
            <div className="mt-3 text-[13px]">
              {deal.agent?.display_name ?? "Unassigned"}
            </div>
          </div>

          <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
            <Eyebrow>Money</Eyebrow>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[12.5px]">
              <dt className="text-bz-muted">Price</dt>
              <dd className="text-right mono">{formatAed(deal.price_aed)}</dd>
              <dt className="text-bz-muted">Advisory fee</dt>
              <dd className="text-right mono">
                {formatAed(deal.advisory_fee_aed)}
              </dd>
              <dt className="text-bz-muted">Commission</dt>
              <dd className="text-right mono">
                {formatAed(deal.commission_aed)}
              </dd>
            </dl>
            <div className="mt-4 pt-4 border-t border-bz-border">
              <CommissionEditor
                dealId={deal.id}
                initialCommissionAed={deal.commission_aed}
                initialNotes={deal.notes}
              />
            </div>
          </div>
        </aside>
      </div>
    </CmsShell>
  );
}
