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
import { PropertyTypeFilter } from "./_filter-dropdowns";
import { propertyTypeLabel } from "./_type-label";
import { PROPERTY_TYPES } from "@/lib/schemas/property";
import type { Database } from "@/db/types";

export const dynamic = "force-dynamic"; // auth-aware fetch

type Status = Database["public"]["Enums"]["property_status"];
type PropertyType = Database["public"]["Enums"]["property_type"];
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
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const params = await searchParams;
  // An unknown `?type=` reads as "all types" rather than an empty grid.
  const type = (PROPERTY_TYPES as readonly string[]).includes(params.type ?? "")
    ? (params.type as PropertyType)
    : undefined;
  const status = VALID_STATUSES.includes(
    (params.status ?? "all") as Status | "all",
  )
    ? ((params.status ?? "all") as Status | "all")
    : "all";

  const [{ rows, total }, agents, counts] = await Promise.all([
    listAllPropertiesForAdmin({
      limit: 100,
      status: status === "all" ? undefined : status,
      type,
    }),
    listActiveAgents(),
    countAdminPropertiesByStatus({ type }),
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
      secondary={
        <Link
          href="/admin/properties/salesforce"
          className="text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          From Salesforce
        </Link>
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
        <StatusTabs active={status} counts={counts} type={type} />
        <BulkToolbar
          rows={rows.map((r) => ({ id: r.id, reference: r.reference }))}
          agents={agents.map((a) => ({
            user_id: a.user_id,
            display_name: a.display_name,
            title: a.title,
          }))}
        />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <PropertyTypeFilter />
            <div className="text-[13px] text-bz-muted">
              {total} {total === 1 ? "property" : "properties"}
              {type ? ` · ${propertyTypeLabel(type).toLowerCase()}` : null}
            </div>
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
