import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { NewPageForm } from "./_form";

export const dynamic = "force-dynamic";

export default function NewCmsPagePage() {
  return (
    <CmsShell
      title="New page"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <span>New</span>
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-bz-muted max-w-[60ch]">
          Pages are block-based. Create a slug first, then assemble hero,
          strip, split, grid, and banner blocks on the editor screen.
        </p>
        <NewPageForm />
      </div>
    </CmsShell>
  );
}
