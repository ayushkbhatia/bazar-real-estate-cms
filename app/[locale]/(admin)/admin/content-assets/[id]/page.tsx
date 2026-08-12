import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import {
  getContentAssetById,
  listSequenceCandidates,
} from "@/lib/queries/content-assets";
import { ContentAssetEditor, type AssetDraft } from "../_editor";
import { updateContentAsset } from "../_actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditContentAssetPage({ params }: PageProps) {
  const { id } = await params;
  const [asset, candidates] = await Promise.all([
    getContentAssetById(id),
    listSequenceCandidates(id),
  ]);
  if (!asset) notFound();

  const initial: AssetDraft = {
    kind: asset.kind,
    slug: asset.slug,
    name: asset.name,
    category: asset.category,
    subject: asset.subject ?? "",
    body: asset.body,
    notes: asset.notes ?? "",
    follow_up_after_days:
      asset.follow_up_after_days === null
        ? ""
        : String(asset.follow_up_after_days),
    next_asset_id: asset.next_asset_id ?? "",
    status: asset.status,
  };

  // `.bind` keeps this a server action — the id is baked in, and the editor
  // still receives a reference it can call across the boundary.
  const save = updateContentAsset.bind(null, id);

  return (
    <CmsShell
      title={asset.name}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/content-assets" className="hover:text-bz-ink">
            Content assets
          </Link>
          <ChevronRight size={11} />
          <span className="mono">{asset.slug}</span>
        </span>
      }
    >
      {asset.deleted_at ? (
        <div className="mb-5 rounded-lg border border-bz-border bg-bz-surface-2 px-4 py-3 text-[13px] text-bz-ink-2">
          This asset is in the trash, so it won&apos;t appear in the enquiry
          composer. Restore it from the{" "}
          <Link
            href="/admin/content-assets?view=trash"
            className="underline hover:text-bz-ink"
          >
            trash view
          </Link>
          .
        </div>
      ) : null}
      <ContentAssetEditor
        initial={initial}
        candidates={candidates}
        save={save}
        isNew={false}
      />
    </CmsShell>
  );
}
