import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { SUBPAGE_KINDS } from "@/lib/master-pages/subpages";
import { countSubPagesByKind } from "@/lib/queries/subpages";

export const dynamic = "force-dynamic";

/**
 * Index of sub-page kinds. One kind today (developments); it exists as its own
 * route so the blocks on the Pages index have somewhere to land when a second
 * kind arrives, and so deep links to /admin/pages/sub keep working.
 */
export default async function SubPageKindsIndex() {
  const counts = await countSubPagesByKind();

  return (
    <CmsShell
      title="Sub-pages"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <span>Sub-pages</span>
        </span>
      }
    >
      <div className="flex flex-col gap-5 max-w-[900px]">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed">
          Pages that exist once per record, built from a shared template.
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SUBPAGE_KINDS.map((k) => (
            <li key={k.kind}>
              <Link
                href={k.adminPath}
                className="flex h-full flex-col gap-1 rounded-lg border border-bz-border bg-bz-surface p-4 hover:border-bz-accent transition-colors"
              >
                <span className="text-[13.5px] font-medium">{k.label}</span>
                <span className="mono text-[11px] text-bz-muted">
                  {k.publicPath}/…
                </span>
                <span className="mt-1 text-[12px] text-bz-muted">
                  {k.description}
                </span>
                <span className="mt-1 text-[11.5px] text-bz-muted-2">
                  {counts[k.kind] ?? 0}{" "}
                  {counts[k.kind] === 1 ? k.itemLabel : `${k.itemLabel}s`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </CmsShell>
  );
}
