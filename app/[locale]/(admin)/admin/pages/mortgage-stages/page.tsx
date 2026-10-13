import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { requireSignedIn } from "@/lib/auth";
import { loadStages } from "@/lib/mortgage-requests/stages";
import { stageEditorSession } from "./_access";
import { StagesEditor } from "./_stages-editor";

export const dynamic = "force-dynamic";

/**
 * Pages & blocks → Mortgage stages (0158): the stages a Fast Pre-Approval
 * moves through on the mortgage board, named, ordered, added and removed by
 * the client. Open to whoever the database says may keep them; a 404 for
 * anyone else, as every gated admin screen answers.
 */
export default async function MortgageStagesPage() {
  await requireSignedIn();
  const s = await stageEditorSession();
  if (!s) notFound();
  const stages = await loadStages(s.supabase);

  return (
    <CmsShell
      title="Mortgage stages"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <span>Mortgage stages</span>
        </span>
      }
    >
      <div className="flex max-w-[860px] flex-col gap-5">
        <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
          <h2 className="text-[13.5px] font-medium">The stages a Fast Pre-Approval moves through</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-bz-ink-2">
            Each stage is a column on the mortgage board, in this order, and the team can move a file to any of them.
            New applications land on the <b>first</b> stage.
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-bz-ink-2">
            Declined isn&apos;t a stage: a file can be declined from any stage, and moving a declined file onto a stage
            reopens it. Mortgage Consultancy requests don&apos;t use stages.
          </p>
        </div>

        <StagesEditor initial={stages} />
      </div>
    </CmsShell>
  );
}
