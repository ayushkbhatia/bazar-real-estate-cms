import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { NewDeveloperForm } from "./_form";

export const dynamic = "force-dynamic";

export default function NewDeveloperPage() {
  return (
    <CmsShell
      title="Add developer"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <Link href="/admin/pages/sub" className="hover:text-bz-ink">
            Sub-pages
          </Link>
          <ChevronRight size={11} />
          <Link href="/admin/pages/sub/developer" className="hover:text-bz-ink">
            Developers
          </Link>
          <ChevronRight size={11} />
          <span>New</span>
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-bz-ink-2 max-w-[70ch] leading-relaxed">
          Creates a profile at{" "}
          <span className="mono">/developers/&lt;link&gt;</span> and makes the
          developer pickable on every property and project. Its projects appear
          on the profile as they are published.
        </p>
        <NewDeveloperForm />
      </div>
    </CmsShell>
  );
}
