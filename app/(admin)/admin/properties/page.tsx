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
  formatPriceAED,
  listAllPropertiesForAdmin,
  propertyUrl,
  type ListingRow,
} from "@/lib/queries/properties";

export const dynamic = "force-dynamic"; // auth-aware fetch

function StatusPill({ status }: { status: ListingRow["status"] }) {
  const styles: Record<ListingRow["status"], string> = {
    draft: "bg-bz-surface-2 text-bz-ink-2",
    in_review: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
    published: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
    off_market: "bg-bz-surface-3 text-bz-muted",
    archived: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
  };
  const label: Record<ListingRow["status"], string> = {
    draft: "Draft",
    in_review: "In review",
    published: "Published",
    off_market: "Off-market",
    archived: "Archived",
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

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  const days = Math.floor(diff / day);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default async function AdminPropertiesPage() {
  const { rows, total } = await listAllPropertiesForAdmin({ limit: 100 });

  return (
    <CmsShell
      title="Properties"
      breadcrumbs="Catalogue"
      primary={
        <Button disabled title="New property arrives in Phase 1.1c">
          <Plus size={14} strokeWidth={1.8} />
          New property
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between">
          <div className="text-[13px] text-bz-muted">
            {total} {total === 1 ? "property" : "properties"}
          </div>
          <div className="text-[12px] text-bz-muted">
            Editing arrives next sprint — this is read-only.
          </div>
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[34%]">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Beds</TableHead>
                <TableHead>Built-up</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Listed</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16 text-bz-muted">
                    No properties yet — sign in as a staff user and run the
                    seed to populate.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/admin/properties/${row.id}`}
                        className="block hover:text-bz-accent transition-colors"
                      >
                        <div className="font-medium truncate max-w-[42ch]">
                          {row.title}
                        </div>
                        <div className="mono text-[11px] text-bz-muted mt-0.5">
                          {row.reference}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={row.status} />
                    </TableCell>
                    <TableCell className="text-bz-ink-2 capitalize">
                      {row.mode.replace("_", "-")}
                    </TableCell>
                    <TableCell>{row.beds}</TableCell>
                    <TableCell className="mono">
                      {row.built_up_ft2 ? `${row.built_up_ft2}` : "—"}
                    </TableCell>
                    <TableCell className="mono font-medium">
                      {formatPriceAED(row.price_aed)}
                    </TableCell>
                    <TableCell className="text-bz-ink-2">
                      {row.areas?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-bz-muted text-[12px]">
                      {relativeDate(row.published_at ?? row.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status === "published" ? (
                        <Link
                          href={propertyUrl(row)}
                          className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View <ExternalLink size={12} />
                        </Link>
                      ) : (
                        <span className="text-[12px] text-bz-muted-2">—</span>
                      )}
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
