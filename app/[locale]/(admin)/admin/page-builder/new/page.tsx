import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { listPublishedDevelopments } from "@/lib/queries/developments";
import { developmentSeedItem } from "../../_fields/record-seeds";
import { NewLandingForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function NewLandingPage() {
  // For the Project launch preset, which asks for its project up front and
  // writes it into every project section it creates.
  const projects = (await listPublishedDevelopments())
    .map(developmentSeedItem)
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <CmsShell
      title="New landing page"
      breadcrumbs={
        <>
          <Link href="/admin/page-builder" className="hover:text-bz-ink">
            Page builder
          </Link>
          {" · New"}
        </>
      }
    >
      <div className="max-w-[720px] flex flex-col gap-5">
        <Link
          href="/admin/page-builder"
          className="inline-flex items-center gap-1 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          <ChevronRight size={13} className="rotate-180" /> All landing pages
        </Link>
        <NewLandingForm projects={projects} />
      </div>
    </CmsShell>
  );
}
