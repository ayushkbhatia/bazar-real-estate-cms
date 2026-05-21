import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { NewArticleForm } from "./_form";

export const dynamic = "force-dynamic";

export default function NewArticlePage() {
  return (
    <CmsShell
      title="New article"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/blog" className="hover:text-bz-ink">
            Insights
          </Link>
          <ChevronRight size={11} />
          <span>New</span>
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-bz-muted max-w-[60ch]">
          Start a draft. Body, hero image, SEO, and publish controls all live
          on the editor screen.
        </p>
        <NewArticleForm />
      </div>
    </CmsShell>
  );
}
