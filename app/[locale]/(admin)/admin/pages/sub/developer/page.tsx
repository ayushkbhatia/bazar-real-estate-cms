import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight,
  Database,
  ExternalLink,
  Plus,
  Type,
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
import { listDeveloperRecords } from "@/lib/queries/developers-extras";
import { cn } from "@/lib/utils";
import { DeveloperPublishToggle } from "./_publish-toggle";

export const dynamic = "force-dynamic";

/** Mark for a developer with no uploaded logo. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * The developer catalogue.
 *
 * Mirrors the areas hub. A developer is picked on every property and every
 * development, so this screen leads with what each row carries and how much
 * is filed under it — a developer with listings behind it is not one to
 * rename casually.
 */
export default async function DeveloperSubPagesIndex() {
  const rows = await listDeveloperRecords();
  const live = rows.filter((r) => r.published).length;
  const inUse = rows.filter(
    (r) => r.property_count > 0 || r.development_count > 0,
  ).length;

  return (
    <CmsShell
      title="Developers"
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
          <span>Developers</span>
        </span>
      }
      primary={
        <div className="flex items-center gap-2">
          {/* The shared wording sits beside the records rather than inside one,
              because it belongs to all 32 pages and to none of them. */}
          <Button asChild variant="outline">
            <Link href="/admin/pages/sub/developer/copy">
              <Type size={14} strokeWidth={1.8} />
              Page copy
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/pages/sub/developer/new">
              <Plus size={14} strokeWidth={1.8} />
              Add developer
            </Link>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed max-w-[80ch]">
          Every developer partner, and everything filed under it.{" "}
          <span className="text-bz-ink">Record</span> opens the name, link,
          logo, founding year and description behind{" "}
          <span className="mono">/developers/&lt;slug&gt;</span>. Adding one
          here makes it pickable on every property and project.{" "}
          <Link
            href="/admin/pages/sub/developer/copy"
            className="text-bz-ink underline"
          >
            Page copy
          </Link>{" "}
          holds the headings and buttons every one of those pages shares, in
          English and Arabic.
        </p>

        <div className="text-[12.5px] text-bz-muted">
          {rows.length} {rows.length === 1 ? "developer" : "developers"} ·{" "}
          {live} live
          {rows.length - live > 0 ? ` · ${rows.length - live} draft` : ""}
          {inUse > 0 ? ` · ${inUse} with listings or projects` : ""}
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[38%]">Developer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Founded</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Listings</TableHead>
                <TableHead className="text-end">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-16 text-bz-muted"
                  >
                    No developers yet — start one with{" "}
                    <Link
                      href="/admin/pages/sub/developer/new"
                      className="text-bz-ink underline"
                    >
                      Add developer
                    </Link>
                    .
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/admin/developers/${row.slug}`}
                        className="flex items-center gap-3 hover:text-bz-accent transition-colors"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-bz-border bg-white">
                          {row.logo_url ? (
                            <Image
                              src={row.logo_url}
                              alt=""
                              width={36}
                              height={36}
                              className="h-full w-full object-contain p-1"
                            />
                          ) : (
                            <span className="text-[10px] text-bz-muted">
                              {initials(row.name)}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium truncate max-w-[32ch]">
                            {row.name}
                          </span>
                          <span className="mono block text-[11px] text-bz-muted mt-0.5 truncate">
                            /developers/{row.slug}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                          row.published
                            ? "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]"
                            : "bg-bz-surface-2 text-bz-muted",
                        )}
                      >
                        {row.published ? "Live" : "Draft"}
                      </span>
                    </TableCell>
                    <TableCell className="mono text-[12.5px] text-bz-ink-2">
                      {row.founded_year ?? "—"}
                    </TableCell>
                    <TableCell className="mono text-[12.5px] text-bz-ink-2">
                      {row.development_count > 0 ? row.development_count : "—"}
                    </TableCell>
                    <TableCell className="mono text-[12.5px] text-bz-ink-2">
                      {row.property_count > 0 ? row.property_count : "—"}
                    </TableCell>
                    <TableCell className="text-end">
                      <span className="inline-flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/developers/${row.slug}`}
                          className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                          title="Name, link, logo, founding year, description"
                        >
                          <Database size={12} /> Record
                        </Link>
                        <DeveloperPublishToggle
                          id={row.id}
                          name={row.name}
                          published={row.published}
                          developmentCount={row.development_count}
                          propertyCount={row.property_count}
                        />
                        {row.published ? (
                          <Link
                            href={`/developers/${row.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                          >
                            View <ExternalLink size={12} />
                          </Link>
                        ) : (
                          // The page 404s while it is draft, so a "View" link
                          // here would just be a broken promise.
                          <span className="text-[12px] text-bz-muted-2">
                            Not public
                          </span>
                        )}
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
