import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Database, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffRole } from "@/lib/auth";
import { getAgentPageContent } from "@/lib/queries/subpages";
import { AGENT_PAGE_ADMIN_PATH } from "@/lib/master-pages/agent-page";
import { notPublishedReason } from "@/lib/staff-publishing";
import { cn } from "@/lib/utils";
import {
  MasterPageEditor,
  type SectionActions,
} from "../../../master/[key]/_editor";
import { saveAgentPage, resetAgentPage } from "../_actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

// Server actions are handed to the client editor by reference. Wrapping them
// in arrows here would make them plain functions, which can't cross the
// server/client boundary.
const ACTIONS: SectionActions = { save: saveAgentPage, reset: resetAgentPage };

async function fetchAdvisor(slug: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("staff")
    .select(
      "user_id, display_name, slug, title, role, status, photo_url, brn, public_email, public_phone, whatsapp",
    )
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

/** One line of the record summary: what the profile shows, or that it won't. */
function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline gap-2 text-[12.5px]">
      <span className="text-bz-muted w-[92px] shrink-0">{label}</span>
      {value ? (
        <span className="text-bz-ink truncate">{value}</span>
      ) : (
        <span className="text-bz-muted-2">Not set — hidden on the page</span>
      )}
    </div>
  );
}

/**
 * One advisor's page.
 *
 * Two kinds of content meet on `/agents/<slug>`, and this screen is honest
 * about which is which. The advisor — name, title, portrait, bio, BRN and
 * contact details — is their team record, summarised at the top and edited in
 * Agents & team. The page around them — which bands show, in what order, and
 * any wording that should differ for this advisor alone — is edited here.
 */
export default async function AgentSubPage({ params }: PageProps) {
  const { slug } = await params;
  const advisor = await fetchAdvisor(slug);
  if (!advisor) notFound();

  const [content, role] = await Promise.all([
    // "bilingual" keeps the `_ar` twins in `values`. Without it the fold
    // strips them, the Arabic inputs render blank, and the save writes that
    // blank back over whatever the client typed.
    getAgentPageContent(
      {
        user_id: advisor.user_id,
        name: advisor.display_name,
        slug: advisor.slug,
      },
      "bilingual",
    ),
    getStaffRole(),
  ]);

  const hidden = notPublishedReason(advisor);
  // The team record is admin-only (/admin/agents redirects anyone else), so
  // the link is only offered to someone it will open for.
  const canEditRecord = role === "admin";
  const recordHref = `/admin/agents/${advisor.user_id}`;
  const whatsapp = advisor.whatsapp || advisor.public_phone;

  return (
    <CmsShell
      title={advisor.display_name}
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
          <Link href="/admin/pages/sub/agent" className="hover:text-bz-ink">
            Agents
          </Link>
          <ChevronRight size={11} />
          <span className="mono">/agents/{advisor.slug}</span>
        </span>
      }
      secondary={
        <span className="inline-flex items-center gap-4">
          {canEditRecord ? (
            <Link
              href={recordHref}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
            >
              <Database size={12} />
              Edit team record
            </Link>
          ) : null}
          {hidden ? null : (
            <Link
              href={`/agents/${advisor.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
            >
              View page
              <ExternalLink size={12} />
            </Link>
          )}
        </span>
      }
    >
      <div className="flex flex-col gap-5 max-w-[860px]">
        {/* The record, read-only. It is most of what the page shows, and an
            editor who came here to change a phone number should find out in
            one glance that it lives somewhere else. */}
        <div className="rounded-lg border border-bz-border bg-bz-surface p-4 flex gap-4">
          <div className="relative h-[88px] w-[70px] shrink-0 overflow-hidden rounded bg-bz-surface-2">
            {advisor.photo_url ? (
              <Image
                src={advisor.photo_url}
                alt=""
                fill
                sizes="70px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[13.5px] font-medium">Team record</h2>
              <span
                className={cn(
                  "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                  hidden
                    ? "bg-bz-surface-2 text-bz-muted"
                    : "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
                )}
              >
                {hidden ? `Not public · ${hidden}` : "Live"}
              </span>
            </div>
            <Fact label="Title" value={advisor.title} />
            <Fact label="BRN" value={advisor.brn} />
            <Fact label="Phone" value={advisor.public_phone} />
            <Fact label="WhatsApp" value={whatsapp} />
            <Fact label="Email" value={advisor.public_email} />
            <p className="mt-1 text-[12px] text-bz-muted leading-relaxed">
              Name, title, portrait, bio, specialties, languages, BRN and
              contact details are this advisor&apos;s team record
              {canEditRecord ? (
                <>
                  {" "}
                  —{" "}
                  <Link href={recordHref} className="text-bz-ink underline">
                    edit it in Agents &amp; team
                  </Link>
                  .
                </>
              ) : (
                ", which only an admin can edit, in Agents & team."
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-[13.5px] font-medium">Sections</h2>
            <p className="text-[12.5px] text-bz-muted mt-1 leading-relaxed">
              Drag to reorder, and switch a band off to hide it on this
              advisor&apos;s page only. A band with nothing in it — no BRN, no
              approved reviews — stays off the page whatever its switch says.
            </p>
            {/* Said here because the boxes below are empty and an empty box
                reads as work outstanding. The greyed wording in each one is
                what the page actually publishes. */}
            <p className="text-[12.5px] text-bz-muted mt-1 leading-relaxed">
              Every heading, label and message is already filled in — the
              greyed text in a blank field is what this page publishes, and it
              is shared with every other advisor. Type here only to change{" "}
              <span className="text-bz-ink">this</span> advisor&apos;s page. To
              change the wording for all of them, edit{" "}
              <Link
                href={AGENT_PAGE_ADMIN_PATH}
                className="text-bz-ink underline"
              >
                Page copy
              </Link>
              . Clearing a field here is safe: it falls back to the shared
              wording rather than leaving a gap.
            </p>
          </div>
          <MasterPageEditor
            pageKey={advisor.slug}
            pageLabel={advisor.display_name}
            path={`/agents/${advisor.slug}`}
            usingDefaults={content.usingDefaults}
            media={[]}
            seeds={{}}
            actions={ACTIONS}
            allowReorder
            resetLabel="Reset this page"
            initial={content.sections.map((s) => ({
              key: s.key,
              def: s.def,
              enabled: s.enabled,
              values: s.values,
            }))}
          />
        </div>
      </div>
    </CmsShell>
  );
}
