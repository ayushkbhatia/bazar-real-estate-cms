import Link from "next/link";
import { Plus, Trash2, Mail, MessageCircle, ArrowRight, Zap } from "lucide-react";
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
import { SYSTEM_ASSETS } from "@/lib/content-assets/system";
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

type View = "outreach" | "system" | "trash";

const TABS: { view: View; label: string; href: string }[] = [
  { view: "outreach", label: "Outreach", href: "/admin/content-assets" },
  {
    view: "system",
    label: "System emails",
    href: "/admin/content-assets?view=system",
  },
  { view: "trash", label: "Trash", href: "/admin/content-assets?view=trash" },
];

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ContentAssetsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const raw = (Array.isArray(sp.view) ? sp.view[0] : sp.view) ?? "";
  const view: View =
    raw === "trash" ? "trash" : raw === "system" ? "system" : "outreach";

  const [rows, system, trash] = await Promise.all([
    view === "trash"
      ? listContentAssets({ trashed: true })
      : listContentAssets({ scope: view }),
    listContentAssets({ scope: "system" }),
    listContentAssets({ trashed: true }),
  ]);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const publishedSystem = system.filter((r) => r.status === "published").length;

  return (
    <CmsShell
      title="Content assets"
      breadcrumbs="Content · Assets"
      primary={
        view === "system" ? undefined : (
          <Button asChild>
            <Link href="/admin/content-assets/new">
              <Plus size={14} strokeWidth={1.8} />
              New asset
            </Link>
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-[13px] text-bz-muted max-w-[70ch]">
          {view === "system" ? (
            <>
              The four emails Bazar sends on its own, with no advisor
              involved. Each has a built-in version that sends today; a
              published row here replaces it, and setting one back to draft
              puts the built-in wording back. They cannot be deleted.
            </>
          ) : (
            <>
              The outreach library. Email and WhatsApp copy an advisor sends
              by hand, written once and reused from the enquiry composer.
              Automatic mail — the acknowledgements and confirmations the site
              sends by itself — lives under{" "}
              <Link
                href="/admin/content-assets?view=system"
                className="text-bz-ink underline"
              >
                System emails
              </Link>
              .
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
            {TABS.map((tab) => {
              const active = view === tab.view;
              const count =
                tab.view === "system"
                  ? system.length
                  : tab.view === "trash"
                    ? trash.length
                    : null;
              return (
                <Link
                  key={tab.view}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] transition-colors",
                    active
                      ? "bg-bz-navy text-bz-bg font-medium"
                      : "text-bz-ink-2 hover:text-bz-ink",
                  )}
                >
                  {tab.view === "trash" ? (
                    <Trash2 size={12} strokeWidth={1.8} />
                  ) : tab.view === "system" ? (
                    <Zap size={12} strokeWidth={1.8} />
                  ) : null}
                  {tab.label}
                  {count === null ? null : (
                    <span
                      className={cn(
                        "mono text-[10.5px]",
                        active ? "text-bz-bg/80" : "text-bz-muted",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <div className="text-[13px] text-bz-muted">
            {view === "system" ? (
              publishedSystem === 0 ? (
                "All four sending Bazar's built-in wording"
              ) : (
                `${publishedSystem} of ${system.length} sending your wording`
              )
            ) : (
              <>
                {rows.length} {rows.length === 1 ? "asset" : "assets"}
                {view === "trash" ? " in trash" : ""}
              </>
            )}
          </div>
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[42%]">
                  {view === "system" ? "Email" : "Asset"}
                </TableHead>
                <TableHead>
                  {view === "system" ? "Sends when" : "Channel"}
                </TableHead>
                {view === "system" ? null : <TableHead>Category</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>
                  {view === "system" ? "Currently sending" : "Follows with"}
                </TableHead>
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={view === "system" ? 5 : 6}
                    className="text-center py-16 text-bz-muted"
                  >
                    {view === "trash" ? (
                      "Trash is empty. Assets you delete land here first."
                    ) : view === "system" ? (
                      "No system emails found — migration 0117 seeds them."
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
                  const def = row.system_key
                    ? SYSTEM_ASSETS[row.system_key]
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
                        {def ? (
                          <span className="text-[12px] text-bz-ink-2 block max-w-[40ch]">
                            {def.trigger}
                          </span>
                        ) : (
                          <KindPill kind={row.kind} />
                        )}
                      </TableCell>
                      {view === "system" ? null : (
                        <TableCell className="text-bz-ink-2 text-[12.5px] capitalize">
                          {row.category}
                        </TableCell>
                      )}
                      <TableCell>
                        <StatusPill status={row.status} />
                      </TableCell>
                      <TableCell className="text-[12px] text-bz-muted">
                        {def ? (
                          row.status === "published" ? (
                            <span className="text-bz-ink-2">Your wording</span>
                          ) : (
                            "Bazar's built-in wording"
                          )
                        ) : next ? (
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
                          trashed={view === "trash"}
                          system={row.system_key !== null}
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
