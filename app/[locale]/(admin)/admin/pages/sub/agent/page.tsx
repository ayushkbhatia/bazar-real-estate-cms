import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight,
  Database,
  ExternalLink,
  FileText,
  Type,
  Users,
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
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffRole } from "@/lib/auth";
import { AGENT_PAGE_ADMIN_PATH } from "@/lib/master-pages/agent-page";
import { subPageSlug } from "@/lib/master-pages/subpages";
import { notPublishedReason } from "@/lib/staff-publishing";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type AdvisorRow = {
  user_id: string;
  display_name: string;
  slug: string;
  title: string | null;
  role: string;
  status: string;
  photo_url: string | null;
  /** Whether this advisor's own page document has been saved. */
  edited: boolean;
};

/**
 * Every advisor who has — or could have — a profile at `/agents/<slug>`.
 *
 * Advisors only: `staff_public_agents` (0036) publishes a row while
 * `role = 'agent'` and `status = 'active'`, so staff in any other role never
 * get a page to edit. Suspended and invited advisors are listed, marked, so an
 * editor can prepare a page before it goes live.
 *
 * Read with the session client — `authenticated` may read every staff row,
 * where `anon` sees only the live ones.
 */
async function listAdvisorPages(): Promise<AdvisorRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const [{ data: rows, error }, { data: pages }] = await Promise.all([
    supabase
      .from("staff")
      .select("user_id, display_name, slug, title, role, status, photo_url")
      .eq("role", "agent")
      .order("display_name", { ascending: true }),
    supabase
      .from("pages")
      .select("slug")
      .like("slug", `${subPageSlug("agent", "")}%`),
  ]);
  if (error) console.error("[admin/pages/sub/agent]", error);

  // Documents are filed by user id — see `getAgentPageContent`.
  const edited = new Set(
    (pages ?? []).map((p) => p.slug.split("/").slice(2).join("/")),
  );
  return ((rows ?? []) as Omit<AdvisorRow, "edited">[]).map((r) => ({
    ...r,
    edited: edited.has(r.user_id),
  }));
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function AgentSubPagesIndex() {
  const [rows, role] = await Promise.all([listAdvisorPages(), getStaffRole()]);
  const live = rows.filter((r) => !notPublishedReason(r)).length;
  const canEditRecords = role === "admin";

  return (
    <CmsShell
      title="Agents"
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
          <span>Agents</span>
        </span>
      }
      primary={
        <div className="flex items-center gap-2">
          {/* The team index has a document of its own, like /developers. */}
          <Button asChild variant="outline">
            <Link href="/admin/pages/master/agents">
              <Users size={14} strokeWidth={1.8} />
              Team page
            </Link>
          </Button>
          {/* The shared wording sits beside the advisors rather than inside
              one, because it belongs to every profile and to none of them. */}
          <Button asChild>
            <Link href={AGENT_PAGE_ADMIN_PATH}>
              <Type size={14} strokeWidth={1.8} />
              Page copy
            </Link>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed max-w-[80ch]">
          One profile per advisor at{" "}
          <span className="mono">/agents/&lt;slug&gt;</span>.{" "}
          <span className="text-bz-ink">Page</span> opens an advisor&apos;s own
          page — which bands show, in what order, and any wording that should
          differ for them.{" "}
          <Link href={AGENT_PAGE_ADMIN_PATH} className="text-bz-ink underline">
            Page copy
          </Link>{" "}
          holds the wording every profile shares, in English and Arabic, and{" "}
          <Link
            href="/admin/pages/master/agents"
            className="text-bz-ink underline"
          >
            Team page
          </Link>{" "}
          the words on <span className="mono">/agents</span> itself. An
          advisor&apos;s name, title, portrait and contact details are their
          team record
          {canEditRecords ? (
            <>
              {" "}
              — <span className="text-bz-ink">Record</span>, or{" "}
              <Link href="/admin/agents" className="text-bz-ink underline">
                Agents &amp; team
              </Link>{" "}
              to add one
            </>
          ) : (
            ", edited by an admin in Agents & team"
          )}
          .
        </p>

        <div className="text-[12.5px] text-bz-muted">
          {rows.length} {rows.length === 1 ? "advisor" : "advisors"} · {live}{" "}
          live
          {rows.length - live > 0 ? ` · ${rows.length - live} not public` : ""}
        </div>

        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Advisor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Page</TableHead>
                <TableHead className="text-end">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-16 text-bz-muted"
                  >
                    No advisors yet. An advisor is a staff member with the
                    Advisor role — invite one from Agents &amp; team.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const hidden = notPublishedReason(row);
                  return (
                    <TableRow key={row.user_id}>
                      <TableCell>
                        <Link
                          href={`/admin/pages/sub/agent/${row.slug}`}
                          className="flex items-center gap-3 hover:text-bz-accent transition-colors"
                        >
                          <span className="relative flex h-10 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-bz-surface-2">
                            {row.photo_url ? (
                              <Image
                                src={row.photo_url}
                                alt=""
                                fill
                                sizes="32px"
                                className="object-cover"
                              />
                            ) : (
                              <span className="text-[10px] text-bz-muted">
                                {initials(row.display_name)}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium truncate max-w-[32ch]">
                              {row.display_name}
                            </span>
                            <span className="mono block text-[11px] text-bz-muted mt-0.5 truncate">
                              /agents/{row.slug}
                            </span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                            hidden
                              ? "bg-bz-surface-2 text-bz-muted"
                              : "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
                          )}
                          title={hidden ?? undefined}
                        >
                          {hidden ? "Not public" : "Live"}
                        </span>
                      </TableCell>
                      <TableCell className="text-[12.5px] text-bz-ink-2">
                        {row.edited ? "Customised" : "Shared wording"}
                      </TableCell>
                      <TableCell className="text-end">
                        <span className="inline-flex items-center justify-end gap-3">
                          <Link
                            href={`/admin/pages/sub/agent/${row.slug}`}
                            className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                            title="Bands, order and wording on this advisor's page"
                          >
                            <FileText size={12} /> Page
                          </Link>
                          {canEditRecords ? (
                            <Link
                              href={`/admin/agents/${row.user_id}`}
                              className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                              title="Name, title, portrait, bio, BRN and contact details"
                            >
                              <Database size={12} /> Record
                            </Link>
                          ) : null}
                          {hidden ? (
                            // The profile 404s while the advisor is not
                            // public, so a "View" link would be a broken
                            // promise.
                            <span className="text-[12px] text-bz-muted-2">
                              {hidden}
                            </span>
                          ) : (
                            <Link
                              href={`/agents/${row.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                            >
                              View <ExternalLink size={12} />
                            </Link>
                          )}
                        </span>
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
