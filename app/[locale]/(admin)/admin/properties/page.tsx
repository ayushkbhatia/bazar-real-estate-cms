import Link from "next/link";
import { Plus } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { LiveDot } from "@/lib/realtime/live-dot";
import { Button } from "@/components/ui/button";
import {
  countAdminPropertiesByStatus,
  listAllPropertiesForAdmin,
} from "@/lib/queries/properties";
import { listActiveAgents } from "@/lib/queries/staff-agents";
import { PropertiesTable } from "./_table";
import { BulkToolbar } from "./_toolbar";
import { StatusTabs } from "./_status-tabs";
import type { Database } from "@/db/types";

export const dynamic = "force-dynamic"; // auth-aware fetch

type Status = Database["public"]["Enums"]["property_status"];
const VALID_STATUSES: readonly (Status | "all")[] = [
  "all",
  "draft",
  "in_review",
  "published",
  "off_market",
  "archived",
];

export default async function AdminPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = VALID_STATUSES.includes(
    (params.status ?? "all") as Status | "all",
  )
    ? ((params.status ?? "all") as Status | "all")
    : "all";

  const [{ rows, total }, agents, counts] = await Promise.all([
    listAllPropertiesForAdmin({
      limit: 100,
      status: status === "all" ? undefined : status,
    }),
    listActiveAgents(),
    countAdminPropertiesByStatus(),
  ]);

  return (
    <CmsShell
      title="Properties"
      breadcrumbs="Catalogue"
      primary={
        <Button asChild>
          <Link href="/admin/properties/new">
            <Plus size={14} strokeWidth={1.8} />
            New property
          </Link>
        </Button>
      }
      live={
        <LiveDot
          channel="public:properties:list"
          table="properties"
          event="UPDATE"
        />
      }
    >
      <div className="flex flex-col gap-6">
        <StatusTabs active={status} counts={counts} />
        <BulkToolbar
          rows={rows.map((r) => ({ id: r.id, reference: r.reference }))}
          agents={agents.map((a) => ({
            user_id: a.user_id,
            display_name: a.display_name,
            title: a.title,
          }))}
        />
        <div className="flex items-baseline justify-between">
          <div className="text-[13px] text-bz-muted">
            {total} {total === 1 ? "property" : "properties"}
          </div>
          <div className="text-[12px] text-bz-muted">
            Click a row to open the editor.
          </div>
        </div>

        <PropertiesTable rows={rows} />
      </div>
    </CmsShell>
  );
}
