import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { NewLandingForm } from "./_form";

export const dynamic = "force-dynamic";

export default function NewLandingPage() {
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
        <NewLandingForm />
      </div>
    </CmsShell>
  );
}
