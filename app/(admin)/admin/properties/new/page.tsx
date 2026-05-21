import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { NewPropertyForm } from "./_form";

export const dynamic = "force-dynamic";

export default function NewPropertyPage() {
  return (
    <CmsShell
      title="New property"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/properties" className="hover:text-bz-ink">
            Properties
          </Link>
          <ChevronRight size={11} />
          <span>New</span>
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-bz-muted max-w-[60ch]">
          Create a draft listing now and finish filling in details, location,
          amenities, and SEO on the edit screen.
        </p>
        <NewPropertyForm />
      </div>
    </CmsShell>
  );
}
