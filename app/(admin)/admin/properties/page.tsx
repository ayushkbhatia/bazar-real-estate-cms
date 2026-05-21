import Link from "next/link";
import { Plus } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { LiveDot } from "@/lib/realtime/live-dot";
import { Button } from "@/components/ui/button";
import { listAllPropertiesForAdmin } from "@/lib/queries/properties";
import { PropertiesTable } from "./_table";
import { BulkToolbar } from "./_toolbar";

export const dynamic = "force-dynamic"; // auth-aware fetch

export default async function AdminPropertiesPage() {
  const { rows, total } = await listAllPropertiesForAdmin({ limit: 100 });

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
        <BulkToolbar />
        <div className="flex items-baseline justify-between">
          <div className="text-[13px] text-bz-muted">
            {total} {total === 1 ? "property" : "properties"}
          </div>
          <div className="text-[12px] text-bz-muted">
            Editing arrives next sprint — this is read-only.
          </div>
        </div>

        <PropertiesTable rows={rows} />
      </div>
    </CmsShell>
  );
}
