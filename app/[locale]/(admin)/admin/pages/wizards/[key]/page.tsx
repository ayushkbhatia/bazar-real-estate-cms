import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { requireRole } from "@/lib/auth";
import { getWizard, isWizardKey, MORTGAGE_EDITABLE_KEYS } from "@/lib/master-pages/wizards";
import { getWizardContent } from "@/lib/queries/wizards";
import { MasterPageEditor, type SectionActions } from "../../master/[key]/_editor";
import { resetWizard, saveWizard } from "../_actions";

export const dynamic = "force-dynamic";

// By reference: wrapped in arrows here they'd be plain functions, which can't cross to the client editor.
const ACTIONS: SectionActions = { save: saveWizard, reset: resetWizard };

/** Pages & blocks → Wizards → one wizard: every screen's words, and the Flow switches. */
export default async function WizardEditorPage({ params }: { params: Promise<{ key: string }> }) {
  await requireRole(["admin", "editor", "marketing"]);
  const { key } = await params;
  if (!isWizardKey(key)) notFound();
  const wizard = getWizard(key);
  // "bilingual" keeps the Arabic twins in the values, or the next save would write them back blank.
  const content = await getWizardContent(key, "bilingual");

  return (
    <CmsShell
      title={wizard.label}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <Link href="/admin/pages/wizards" className="hover:text-bz-ink">
            Wizards
          </Link>
          <ChevronRight size={11} />
          <span>{wizard.label}</span>
        </span>
      }
      secondary={
        <Link
          href={wizard.path}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          Open the wizard
          <ExternalLink size={12} />
        </Link>
      }
    >
      <div className="flex max-w-[860px] flex-col gap-5">
        <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
          <h2 className="text-[13.5px] font-medium">Every screen, word for word</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-bz-ink-2">
            The {MORTGAGE_EDITABLE_KEYS.length} messages an applicant reads on{" "}
            <span className="mono">/mortgages/apply</span>{" "}and on the secure link the team sends, one section per screen
            in the order they meet them: headings, intros, buttons, field labels and placeholders, hints, the messages a
            mistake shows, and each document&apos;s name. A save goes live on the next screen an applicant opens. Fields
            marked <em>awaiting sign-off</em> still carry wording the design or compliance owes.
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-bz-ink-2">
            The <b>Flow</b>{" "}section switches what the wizard shows. What it asks for — which documents, the formats and
            size limits, the 24-hour clock — is the form&apos;s rules, checked when it&apos;s sent, and isn&apos;t set
            here. Phrases with a count in them (&ldquo;3 files added&rdquo;) are kept as shipped.
          </p>
        </div>

        <MasterPageEditor
          pageKey={key}
          pageLabel={wizard.label}
          path={wizard.path}
          usingDefaults={content.usingDefaults}
          media={[]}
          seeds={{}}
          actions={ACTIONS}
          // The screens' order is the flow's, which the wizard fixes.
          allowReorder={false}
          resetLabel="Reset to the shipped wording"
          initial={content.sections.map((s) => ({ key: s.key, def: s.def, enabled: s.enabled, values: s.values }))}
        />
      </div>
    </CmsShell>
  );
}
