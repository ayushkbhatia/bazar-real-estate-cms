import Link from "next/link";
import { Plus, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  developmentUrl,
  listAllDevelopmentsForAdmin,
  type DevelopmentIndexRow,
} from "@/lib/queries/developments";
import { formatStartingPrice, quarterLabel } from "@/lib/schemas/development";

export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: DevelopmentIndexRow["status"] }) {
  const styles: Record<DevelopmentIndexRow["status"], string> = {
    pre_launch: "bg-bz-accent-soft text-bz-accent",
    on_sale: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
    sold_out: "bg-bz-surface-3 text-bz-muted",
    handed_over: "bg-bz-surface-2 text-bz-ink-2",
  };
  const label: Record<DevelopmentIndexRow["status"], string> = {
    pre_launch: "Pre-launch",
    on_sale: "On sale",
    sold_out: "Sold out",
    handed_over: "Handed over",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
        styles[status],
      )}
    >
      {label[status]}
    </span>
  );
}

export default async function AdminDevelopmentsPage() {
  const rows = await listAllDevelopmentsForAdmin();

  return (
    <CmsShell
      title="Developments"
      breadcrumbs="Catalogue"
      primary={
        <Button asChild>
          <Link href="/admin/developments/new">
            <Plus size={14} strokeWidth={1.8} />
            New development
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between">
          <div className="text-[13px] text-bz-muted">
            {rows.length} {rows.length === 1 ? "development" : "developments"}
          </div>
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[36%]">Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Developer</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Handover</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>From</TableHead>
                <TableHead className="text-right">Public</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-16 text-bz-muted"
                  >
                    No developments yet. Create one to seed the catalogue.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/admin/developments/${row.id}`}
                        className="block hover:text-bz-accent transition-colors"
                      >
                        <div className="font-medium truncate max-w-[44ch]">
                          {row.name}
                        </div>
                        {row.tagline ? (
                          <div className="text-[11.5px] text-bz-muted mt-0.5 truncate">
                            {row.tagline}
                          </div>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={row.status} />
                    </TableCell>
                    <TableCell className="text-bz-ink-2">
                      {row.developer?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-bz-ink-2">
                      {row.area?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-bz-ink-2">
                      {quarterLabel(row.handover_date)}
                    </TableCell>
                    <TableCell className="mono">
                      {row.total_units ?? "—"}
                    </TableCell>
                    <TableCell className="mono font-medium">
                      {formatStartingPrice(row.starting_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={developmentUrl(row)}
                        className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View <ExternalLink size={12} />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </CmsShell>
  );
}
