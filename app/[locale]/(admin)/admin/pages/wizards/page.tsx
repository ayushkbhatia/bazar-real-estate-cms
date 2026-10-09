import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { requireRole } from "@/lib/auth";
import { WIZARD_ADMIN_PATH, WIZARDS } from "@/lib/master-pages/wizards";

export const dynamic = "force-dynamic";

/** Pages & blocks → Wizards: the multi-step forms, each edited screen by screen. */
export default async function WizardsIndexPage() {
  await requireRole(["admin", "editor", "marketing"]);
  return (
    <CmsShell
      title="Wizards"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <span>Wizards</span>
        </span>
      }
    >
      <div className="grid max-w-[860px] gap-3 sm:grid-cols-2">
        {WIZARDS.map((w) => (
          <Link
            key={w.key}
            href={WIZARD_ADMIN_PATH(w.key)}
            className="rounded-[10px] border border-bz-border bg-bz-surface p-4 transition-colors hover:border-bz-border-strong"
          >
            <div className="text-[14px] font-medium text-bz-ink">{w.label}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-bz-ink-2">{w.description}</p>
            <p className="mono mt-2 text-[11.5px] text-bz-muted">{w.path}</p>
          </Link>
        ))}
      </div>
    </CmsShell>
  );
}
