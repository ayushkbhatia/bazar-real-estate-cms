import Link from "next/link";
import { Plus, Trash2, Mail, MessageCircle, ArrowRight } from "lucide-react";
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
  listContentAssets,
  type ContentAssetRow,
} from "@/lib/queries/content-assets";
import { CONTENT_ASSET_KIND_LABELS } from "@/lib/schemas/content-asset";
import { AssetRowActions } from "./_row-actions";

export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: ContentAssetRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
        status === "published"
          ? "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]"
          : "bg-bz-surface-2 text-bz-ink-2",
      )}
    >
      {status === "published" ? "Published" : "Draft"}
    </span>
  );
}

function KindPill({ kind }: { kind: ContentAssetRow["kind"] }) {
  const Icon = kind === "email" ? Mail : MessageCircle;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-ink-2">
      <Icon size={13} strokeWidth={1.7} className="text-bz-muted" />
      {CONTENT_ASSET_KIND_LABELS[kind]}
    </span>
  );
}

/** First line of the body, for an at-a-glance sense of the copy. */
function firstLine(body: string): string {
  const line = body.split("\n").find((l) => l.trim() !== "") ?? "";
  return line.length > 90 ? `${line.slice(0, 89)}…` : line;
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ContentAssetsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const view = (Array.isArray(sp.view) ? sp.view[0] : sp.view) ?? "";
  const trashed = view === "trash";

  const [rows, trash] = await Promise.all([
    listContentAssets({ trashed }),
    listContentAssets({ trashed: true }),
  ]);

  const byId = new Map(rows.map((r) => [r.id, r]));

  return (
    <CmsShell
      title="Content assets"
      breadcrumbs="Content · Assets"
      primary={
        <Button asChild>
          <Link href="/admin/content-assets/new">
            <Plus size={14} strokeWidth={1.8} />
            New asset
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-[13px] text-bz-muted max-w-[70ch]">
          The outreach library. Email and WhatsApp copy an advisor sends by
          hand, written once and reused from the enquiry composer. Automatic
          system mail — the enquiry acknowledgement, escalations, KYC decisions
          — is not managed here.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
            <Link
              href="/admin/content-assets"
              aria-current={trashed ? undefined : "page"}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] transition-colors",
                trashed
                  ? "text-bz-ink-2 hover:text-bz-ink"
                  : "bg-bz-navy text-bz-bg font-medium",
              )}
            >
              Assets
            </Link>
            <Link
              href="/admin/content-assets?view=trash"
              aria-current={trashed ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] transition-colors",
                trashed
                  ? "bg-bz-navy text-bz-bg font-medium"
                  : "text-bz-ink-2 hover:text-bz-ink",
              )}
            >
              <Trash2 size={12} strokeWidth={1.8} />
              Trash
              <span
                className={cn(
                  "mono text-[10.5px]",
                  trashed ? "text-bz-bg/80" : "text-bz-muted",
                )}
              >
                {trash.length}
              </span>
            </Link>
          </div>
          <div className="text-[13px] text-bz-muted">
            {rows.length} {rows.length === 1 ? "asset" : "assets"}
            {trashed ? " in trash" : ""}
          </div>
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[42%]">Asset</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Follows with</TableHead>
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-16 text-bz-muted"
                  >
                    {trashed ? (
                      "Trash is empty. Assets you delete land here first."
                    ) : (
                      <>
                        No assets yet — write the first one with{" "}
                        <Link
                          href="/admin/content-assets/new"
                          className="text-bz-ink underline"
                        >
                          New asset
                        </Link>
                        .
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const next = row.next_asset_id
                    ? byId.get(row.next_asset_id)
                    : null;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/admin/content-assets/${row.id}`}
                          className="block hover:text-bz-accent transition-colors"
                        >
                          <div className="font-medium truncate max-w-[60ch]">
                            {row.name}
                          </div>
                          <div className="text-[11.5px] text-bz-muted mt-0.5 truncate max-w-[60ch]">
                            {firstLine(row.body)}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <KindPill kind={row.kind} />
                      </TableCell>
                      <TableCell className="text-bz-ink-2 text-[12.5px] capitalize">
                        {row.category}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={row.status} />
                      </TableCell>
                      <TableCell className="text-[12px] text-bz-muted">
                        {next ? (
                          <span className="inline-flex items-center gap-1.5">
                            <ArrowRight size={11} strokeWidth={1.8} />
                            {next.name}
                            {row.follow_up_after_days
                              ? ` · ${row.follow_up_after_days}d`
                              : ""}
                          </span>
                        ) : row.follow_up_after_days ? (
                          `after ${row.follow_up_after_days}d`
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <AssetRowActions
                          id={row.id}
                          name={row.name}
                          trashed={trashed}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </CmsShell>
  );
}
