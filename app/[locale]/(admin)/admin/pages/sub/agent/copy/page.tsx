import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { AGENT_TOKENS } from "@/lib/master-pages/agent-page";
import { getAgentPageCopyContent } from "@/lib/queries/agent-page";
import {
  MasterPageEditor,
  type SectionActions,
} from "../../../master/[key]/_editor";
import { saveAgentPageCopy, resetAgentPageCopy } from "./_actions";

export const dynamic = "force-dynamic";

// Handed to the client editor by reference. Wrapping them in arrows here would
// make them plain functions, which cannot cross the server/client boundary —
// the same constraint the area, development, developer, library and search
// editors document.
const ACTIONS: SectionActions = {
  save: saveAgentPageCopy,
  reset: resetAgentPageCopy,
};

export default async function AgentPageCopyEditor() {
  // "bilingual" keeps the `_ar` twins in `values`. Without it the fold strips
  // them, the Arabic inputs render blank over stored content, and the next
  // save writes that blank back.
  const content = await getAgentPageCopyContent("bilingual");

  return (
    <CmsShell
      title="Advisor profiles · page copy"
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
          <span>Page copy</span>
        </span>
      }
      secondary={
        <Link
          href="/agents"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          View the team
          <ExternalLink size={12} />
        </Link>
      }
    >
      <div className="flex flex-col gap-5 max-w-[860px]">
        {/*
          What this edit reaches, stated before the form. Every profile shares
          this one document, so an editor who arrives from one advisor's page
          and assumes it belongs to that advisor would change all of them
          without meaning to.
        */}
        <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
          <h2 className="text-[13.5px] font-medium">Every advisor profile</h2>
          <p className="mt-1 text-[12.5px] text-bz-ink-2 leading-relaxed">
            One set of words, shared by every{" "}
            <span className="mono">/agents/&lt;slug&gt;</span> page — the link
            back to the team, the pull quote, the contact buttons and the
            WhatsApp message behind one of them, and the eyebrow and heading
            above each band. Editing them here changes every profile at once.
            One advisor&apos;s page can still say something different: open it
            from{" "}
            <Link
              href="/admin/pages/sub/agent"
              className="text-bz-ink underline"
            >
              Agents
            </Link>{" "}
            and type over the greyed wording there. An advisor&apos;s own name,
            title, portrait, bio and contact details are their team record, in{" "}
            <Link href="/admin/agents" className="text-bz-ink underline">
              Agents &amp; team
            </Link>
            .
          </p>
          <p className="mt-2 text-[12.5px] text-bz-ink-2 leading-relaxed">
            Write <span className="mono">{AGENT_TOKENS.first_name}</span> or{" "}
            <span className="mono">{AGENT_TOKENS.name}</span> where the
            advisor&apos;s first name or full name belongs, and it is filled in
            per page — in any field, English or Arabic. Type the Arabic under
            each English field: an Arabic box left blank shows the Arabic the
            site shipped with, not a translation of your new English.
          </p>
        </div>

        <MasterPageEditor
          pageKey="copy"
          pageLabel="Advisor profiles"
          path="/agents"
          usingDefaults={content.usingDefaults}
          media={[]}
          seeds={{}}
          actions={ACTIONS}
          // The order is each advisor's own business, set on their page; this
          // document only holds the words.
          allowReorder={false}
          resetLabel="Reset to the shipped wording"
          initial={content.sections.map((s) => ({
            key: s.key,
            def: s.def,
            enabled: s.enabled,
            values: s.values,
          }))}
        />
      </div>
    </CmsShell>
  );
}
