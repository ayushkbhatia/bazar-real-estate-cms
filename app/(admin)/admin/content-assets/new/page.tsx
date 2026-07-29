import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { listSequenceCandidates } from "@/lib/queries/content-assets";
import { ContentAssetEditor, EMPTY_DRAFT } from "../_editor";
import { createContentAsset } from "../_actions";

export const dynamic = "force-dynamic";

export default async function NewContentAssetPage() {
  const candidates = await listSequenceCandidates(null);

  return (
    <CmsShell
      title="New asset"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/content-assets" className="hover:text-bz-ink">
            Content assets
          </Link>
          <ChevronRight size={11} />
          <span>New</span>
        </span>
      }
    >
      <ContentAssetEditor
        initial={EMPTY_DRAFT}
        candidates={candidates}
        // Handed over by reference. An arrow wrapper here would be a plain
        // function and can't cross the server/client boundary.
        save={createContentAsset}
        isNew
      />
    </CmsShell>
  );
}
