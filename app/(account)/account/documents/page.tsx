import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { listDocumentsForOwner, type DocumentRow } from "@/lib/queries/documents";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  isKycKind,
  requiredBuyerDocs,
  type DealStage,
  type DocumentStatus,
} from "@/lib/deals";
import { cn } from "@/lib/utils";
import { AccountDocumentUpload } from "./_upload";

export const dynamic = "force-dynamic";

function statusBadge(status: DocumentStatus): string {
  switch (status) {
    case "verified":
      return "bg-bz-accent-soft text-bz-accent";
    case "rejected":
      return "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]";
    case "pending_review":
    case "uploaded":
      return "bg-[oklch(0.96_0.05_60)] text-[oklch(0.45_0.13_60)]";
    case "expired":
      return "bg-bz-surface-2 text-bz-muted";
  }
}

function formatBytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AccountDocumentsPage() {
  if (!isSupabaseConfigured) {
    return (
      <div>
        <Eyebrow>Documents</Eyebrow>
        <h1 className="serif text-[40px] font-normal mt-2 -tracking-[0.025em]">
          Your document vault
        </h1>
        <p className="mt-4 text-bz-muted">
          The vault is unavailable while the platform is offline.
        </p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/sign-in?next=/account/documents`);
  }

  const [docs, dealsRes] = await Promise.all([
    listDocumentsForOwner({ ownerKind: "account", ownerId: user.id }),
    supabase
      .from("deals")
      .select("id, stage, properties:property_id(reference, title)")
      .eq("buyer_account_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  type DealRow = {
    id: string;
    stage: DealStage;
    properties: { reference: string; title: string } | null;
  };
  const deals = (dealsRes.data ?? []) as unknown as DealRow[];

  // Compute which doc kinds the buyer currently needs based on active deals.
  const requiredKinds = new Set(
    deals.flatMap((d) => requiredBuyerDocs(d.stage)),
  );

  const uploadedKycKinds = new Set(
    docs.filter((d) => isKycKind(d.kind)).map((d) => d.kind),
  );
  const stillMissing = [...requiredKinds].filter(
    (k) => !uploadedKycKinds.has(k),
  );

  const verified = docs.filter((d) => d.status === "verified");
  const pending = docs.filter(
    (d) => d.status === "uploaded" || d.status === "pending_review",
  );
  const rejected = docs.filter((d) => d.status === "rejected");

  return (
    <div className="max-w-[800px]">
      <Eyebrow>Documents</Eyebrow>
      <h1 className="serif text-[40px] font-normal mt-2 -tracking-[0.025em]">
        Your document vault
      </h1>
      <p className="mt-4 text-[15px] text-bz-muted max-w-[60ch]">
        Identity documents and other paperwork you&apos;ve uploaded to Bazar.
        We use these for KYC compliance and to advance any open deals.
        Only your advisor can see what you upload.
      </p>

      {deals.length === 0 ? (
        <div className="mt-8 rounded-lg border border-bz-border bg-bz-surface p-5 text-[13.5px] text-bz-muted">
          You don&apos;t have any open deals yet. You can still upload your
          identity documents in advance if you&apos;d like.
        </div>
      ) : null}

      {stillMissing.length > 0 ? (
        <div className="mt-8 rounded-lg border border-[oklch(0.85_0.12_60)] bg-[oklch(0.97_0.04_60)] p-5">
          <div className="flex items-center gap-2 text-[oklch(0.4_0.15_60)] font-medium">
            <AlertTriangle size={16} strokeWidth={1.8} />
            We still need
          </div>
          <ul className="mt-2 text-[13px] text-[oklch(0.35_0.15_60)] list-disc pl-5 space-y-1">
            {stillMissing.map((k) => (
              <li key={k}>{DOCUMENT_KIND_LABELS[k]}</li>
            ))}
          </ul>
          <div className="text-[12.5px] text-[oklch(0.35_0.15_60)] mt-2">
            Upload these so we can move the deal forward.
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <AccountDocumentUpload />
      </div>

      <Section title="Pending review" icon={Clock} docs={pending} />
      <Section title="Verified" icon={CheckCircle2} docs={verified} />
      <Section title="Rejected" icon={AlertTriangle} docs={rejected} />

      {deals.length > 0 ? (
        <div className="mt-12 rounded-lg border border-bz-border bg-bz-surface p-5">
          <Eyebrow>Linked deals</Eyebrow>
          <ul className="mt-3 flex flex-col gap-2 text-[13.5px]">
            {deals.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span>
                  <span className="mono text-[11.5px] text-bz-muted mr-2">
                    {d.properties?.reference ?? "—"}
                  </span>
                  {d.properties?.title ?? ""}
                </span>
                <span className="text-[11.5px] text-bz-muted capitalize">
                  {d.stage.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  function Section({
    title,
    icon: Icon,
    docs,
  }: {
    title: string;
    icon: typeof FileText;
    docs: DocumentRow[];
  }) {
    if (docs.length === 0) return null;
    return (
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-3">
          <Icon size={14} strokeWidth={1.8} className="text-bz-muted" />
          <Eyebrow>{title}</Eyebrow>
        </div>
        <ul className="flex flex-col gap-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 px-4 py-3 bg-bz-surface border border-bz-border rounded-md"
            >
              <FileText
                size={16}
                strokeWidth={1.6}
                className="text-bz-muted shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13.5px] font-medium text-bz-ink">
                    {DOCUMENT_KIND_LABELS[d.kind]}
                  </span>
                  <span
                    className={cn(
                      "inline-flex px-2 py-0.5 rounded text-[11.5px] font-medium",
                      statusBadge(d.status),
                    )}
                  >
                    {DOCUMENT_STATUS_LABELS[d.status]}
                  </span>
                </div>
                <div className="text-[11.5px] text-bz-muted truncate">
                  {d.filename ?? "—"} · {formatBytes(d.size_bytes)} ·
                  uploaded {formatDate(d.created_at)}
                </div>
                {d.status === "rejected" && d.rejected_reason ? (
                  <div className="mt-1 text-[12px] text-[oklch(0.45_0.13_28)]">
                    {d.rejected_reason}
                  </div>
                ) : null}
              </div>
              {d.storage_key ? (
                <Link
                  href={`/api/documents/${d.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 h-8 inline-flex items-center rounded border border-bz-border text-bz-ink-2 hover:bg-bz-surface-2 text-[12.5px]"
                >
                  View
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    );
  }
}
