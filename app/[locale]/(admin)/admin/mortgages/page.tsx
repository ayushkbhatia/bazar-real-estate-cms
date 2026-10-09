import Link from "next/link";
import { Landmark, Settings } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/observability";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { parseQueueParams } from "@/lib/mortgage-requests/queue";
import { getMortgageRole, requireMortgageRole } from "@/lib/mortgage-requests/server/cms-auth";
import { listBoard, listQueue, loadTeam, type BoardResult, type QueueResult, type TeamMember } from "@/lib/mortgage-requests/server/cms-queries";
import { loadMortgageSettings } from "@/lib/mortgage-requests/server/settings";
import { QueueView } from "./_components/queue-view";

export const dynamic = "force-dynamic";

/** Titled for the team only: anyone else gets a 404 that doesn't name the page. */
export async function generateMetadata() {
  return (await getMortgageRole()) ? { title: cmsT("c1.title") } : {};
}

/** C1 · Requests queue (docs/mortgage/cms/C1-requests-queue). */
export default async function MortgageQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, role, staff, supabase } = await requireMortgageRole();
  const params = parseQueueParams(await searchParams);

  let result: QueueResult | null = null;
  let board: BoardResult | null = null;
  let team: TeamMember[] = [];
  try {
    const [{ policy }, members] = await Promise.all([loadMortgageSettings(supabase), loadTeam(supabase)]);
    team = members;
    if (params.view === "board") {
      board = await listBoard(
        supabase,
        { service: params.service, owner: params.owner, risk: params.risk, q: "" },
        { now: new Date(), meId: user.id, role, myName: staff.display_name ?? "", policy },
      );
    } else {
      result = await listQueue(supabase, { ...params, q: "" }, { now: new Date(), meId: user.id, policy });
    }
  } catch (error) {
    await reportError(error, { source: "mortgage.cms.queue" });
  }

  return (
    <CmsShell
      title={cmsT("c1.title")}
      breadcrumbs={
        (result ?? board)
          ? cmsT("c1.breadcrumbs", { open: String((result ?? board)!.counts.open), new: String((result ?? board)!.counts.new) })
          : cmsT("nav.group")
      }
      secondary={
        <>
          {role === "head" || staff.role === "admin" ? (
            <Button asChild variant="outline" size="default" className="text-[13px]">
              <Link href="/admin/mortgages/banks">
                <Landmark strokeWidth={1.6} />
                {cmsT("banks.link")}
              </Link>
            </Button>
          ) : null}
          {role === "head" ? (
            <Button asChild variant="outline" size="default" className="text-[13px]">
              <Link href="/admin/mortgages/settings">
                <Settings strokeWidth={1.6} />
                {cmsT("settings.link")}
              </Link>
            </Button>
          ) : null}
        </>
      }
    >
      <QueueView initial={result} initialBoard={board} params={params} team={team} />
    </CmsShell>
  );
}
