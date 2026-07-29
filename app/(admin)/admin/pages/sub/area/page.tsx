import Link from "next/link";
import {
  ChevronRight,
  Database,
  ExternalLink,
  LayoutList,
  Plus,
} from "lucide-react";
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
import { AREA_KIND_LABELS, type AreaKind } from "@/lib/schemas/area";
import { listAreaSubPages } from "@/lib/queries/subpages";

export const dynamic = "force-dynamic";

const KIND_STYLES: Record<string, string> = {
  emirate: "bg-bz-accent-soft text-bz-accent",
  area: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  sub_community: "bg-bz-surface-2 text-bz-ink-2",
  building: "bg-bz-surface-3 text-bz-muted",
};

/**
 * The one place areas are worked on.
 *
 * Mirrors the developments hub: an area has two editable halves — its
 * **record** (name, slug, hierarchy, map position, SEO) and its **guide page**
 * (section order, copy, imagery) — and each row opens either.
 */
export default async function AreaSubPagesIndex() {
  const rows = await listAreaSubPages();
  const edited = rows.filter((r) => r.edited).length;
  const withCover = rows.filter((r) => r.hero_image_id !== null).length;
  const byId = new Map(rows.map((r) => [r.id, r.name]));

  return (
    <CmsShell
      title="Areas"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <Link href="/admin/pages/sub" className="hover:text-bz-ink">
            Sub-pages
          </Link>
          <ChevronRight size={11} />
          <span>Areas</span>
        </span>
      }
      primary={
        <Button asChild>
          <Link href="/admin/pages/sub/area/new">
            <Plus size={14} strokeWidth={1.8} />
            Add area
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed max-w-[80ch]">
          Every community, with both halves in one place.{" "}
          <span className="text-bz-ink">Page</span> opens the guide editor —
          section order, copy and imagery for{" "}
          <span className="mono">/areas/&lt;slug&gt;</span>.{" "}
          <span className="text-bz-ink">Record</span> opens the area&apos;s
          facts — name, hierarchy, map position and search listing.
        </p>

        <div className="text-[12.5px] text-bz-muted">
          {rows.length} {rows.length === 1 ? "area" : "areas"} · {withCover}{" "}
          with a cover image
          {edited > 0 ? ` · ${edited} with page edits` : ""}
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[34%]">Area</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Sits inside</TableHead>
                <TableHead>Cover</TableHead>
                <TableHead>Page</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-16 text-bz-muted"
                  >
                    No areas yet — start one with{" "}
                    <Link
                      href="/admin/pages/sub/area/new"
                      className="text-bz-ink underline"
                    >
                      Add area
                    </Link>
                    .
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/admin/pages/sub/area/${row.slug}`}
                        className="block hover:text-bz-accent transition-colors"
                      >
                        <div className="font-medium truncate max-w-[36ch]">
                          {row.name}
                        </div>
                        <div className="mono text-[11px] text-bz-muted mt-0.5 truncate">
                          /areas/{row.slug}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                          KIND_STYLES[row.kind] ??
                            "bg-bz-surface-2 text-bz-ink-2",
                        )}
                      >
                        {AREA_KIND_LABELS[row.kind as AreaKind] ?? row.kind}
                      </span>
                    </TableCell>
                    <TableCell className="text-bz-ink-2 text-[12.5px]">
                      {row.parent_id
                        ? (byId.get(row.parent_id) ?? "—")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-[12.5px]">
                      {row.hero_image_id ? (
                        <span className="text-bz-ink-2">Set</span>
                      ) : (
                        <span className="text-bz-muted-2">Placeholder</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[12.5px]">
                      {row.edited ? (
                        <span className="text-bz-ink-2">Edited</span>
                      ) : (
                        <span className="text-bz-muted-2">Default</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/pages/sub/area/${row.slug}`}
                          className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                          title="Section order, copy and imagery"
                        >
                          <LayoutList size={12} /> Page
                        </Link>
                        <Link
                          href={`/admin/areas/${row.id}`}
                          className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                          title="Name, hierarchy, map position, search listing"
                        >
                          <Database size={12} /> Record
                        </Link>
                        <Link
                          href={`/areas/${row.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                        >
                          View <ExternalLink size={12} />
                        </Link>
                      </span>
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
