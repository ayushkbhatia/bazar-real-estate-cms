import Link from "next/link";
import { ExternalLink, LayoutList } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { listMegamenuTabsForAdmin } from "@/lib/queries/megamenu";

export const dynamic = "force-dynamic";

/**
 * Every tab in the site's main navigation, in the order they appear.
 *
 * This used to redirect straight into the first tab's editor, which meant
 * there was no way to see the menu as a whole — how many tabs there are,
 * which are live, which open a panel rather than linking straight out.
 */
export default async function MegamenuIndex() {
  const tabs = await listMegamenuTabsForAdmin();
  const live = tabs.filter((t) => t.status === "published").length;
  const panels = tabs.filter((t) => t.has_panel).length;

  return (
    <CmsShell title="Megamenu" breadcrumbs="Content · Navigation">
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed max-w-[80ch]">
          The tabs across the top of the public site. Open one to edit its
          columns, links, and the featured tiles beside them — copy, targets
          and imagery.
        </p>

        <div className="text-[12.5px] text-bz-muted">
          {tabs.length} {tabs.length === 1 ? "tab" : "tabs"} · {live} live ·{" "}
          {panels} with a dropdown panel
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Tab</TableHead>
                <TableHead>Opens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Position</TableHead>
                <TableHead className="text-end">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tabs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-16 text-bz-muted"
                  >
                    No navigation tabs yet.
                  </TableCell>
                </TableRow>
              ) : (
                tabs.map((tab) => (
                  <TableRow key={tab.id}>
                    <TableCell>
                      <Link
                        href={`/admin/megamenu/${tab.slug}`}
                        className="block hover:text-bz-accent transition-colors"
                      >
                        <div className="font-medium">{tab.label}</div>
                        <div className="mono text-[11px] text-bz-muted mt-0.5">
                          {tab.slug}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-bz-ink-2 text-[12.5px]">
                      {tab.has_panel ? "Dropdown panel" : "Links straight out"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                          tab.status === "published"
                            ? "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]"
                            : "bg-bz-surface-2 text-bz-ink-2",
                        )}
                      >
                        {tab.status === "published" ? "Live" : "Draft"}
                      </span>
                    </TableCell>
                    <TableCell className="mono text-[12.5px] text-bz-muted">
                      {tab.position}
                    </TableCell>
                    <TableCell className="text-end">
                      <Link
                        href={`/admin/megamenu/${tab.slug}`}
                        className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                      >
                        <LayoutList size={12} /> Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Link
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          View the live menu <ExternalLink size={12} />
        </Link>
      </div>
    </CmsShell>
  );
}
