import Link from "next/link";
import { notFound } from "next/navigation";
import { CmsShell } from "@/components/brand/cms-shell";
import { requireRole } from "@/lib/auth";
import { getFormForAdmin, listSubmissions } from "@/lib/queries/forms";
import { listFormAssignments } from "@/lib/queries/content-assets";
import { SYSTEM_ASSETS } from "@/lib/content-assets/system";
import { formEmailRouting } from "@/lib/content-assets/usage";
import { FormEditor } from "./_editor";
import { FormReplyBanner } from "./_reply-banner";

export const dynamic = "force-dynamic";

const FORM_ROLES = ["admin", "editor", "marketing"] as const;

type PageProps = { params: Promise<{ key: string }> };

export default async function AdminFormPage({ params }: PageProps) {
  const { key } = await params;
  const { supabase } = await requireRole(FORM_ROLES);

  const detail = await getFormForAdmin(supabase, key);
  if (!detail) notFound();

  const [submissions, assignments] = await Promise.all([
    listSubmissions(supabase, key, { limit: 300 }),
    listFormAssignments(),
  ]);

  // What this form emails the visitor. The assignment is edited in Content
  // assets; this is the answer to "does this form even reply?".
  const routing = formEmailRouting(detail.form.def);
  const assigned = assignments[key] ?? null;
  const live =
    assigned && assigned.status === "published" && !assigned.trashed
      ? {
          label: assigned.assetName,
          detail: "A form reply you wrote.",
          href: `/admin/content-assets/replies/${assigned.assetId}`,
          tone: "default" as const,
        }
      : assigned
        ? {
            label: SYSTEM_ASSETS[routing.defaultEmail].label,
            detail: `“${assigned.assetName}” is assigned but ${assigned.trashed ? "in the trash" : "still a draft"}, so this sends instead.`,
            href: `/admin/content-assets/replies/${assigned.assetId}`,
            tone: "warn" as const,
          }
        : {
            label: SYSTEM_ASSETS[routing.defaultEmail].label,
            detail: routing.assignable
              ? "Bazar's built-in wording."
              : routing.why,
            href: routing.assignable
              ? "/admin/content-assets/replies"
              : `/admin/content-assets/emails/${routing.defaultEmail}`,
            tone: "default" as const,
          };

  return (
    <CmsShell
      title={detail.form.def.name}
      breadcrumbs={
        <>
          <Link href="/admin/forms" className="hover:text-bz-ink">
            Forms
          </Link>
          {" · "}
          {detail.form.def.surface}
        </>
      }
    >
      {detail.missingTable ? (
        <p className="mb-5 text-[13px] rounded border border-bz-border bg-bz-surface p-3">
          The forms tables aren&apos;t there yet. Apply migration{" "}
          <code className="mono">0094_forms_manager.sql</code> and reload —
          everything below is the form&apos;s built-in setup, which is exactly
          what the public site is rendering, and saving won&apos;t work until
          the migration lands.
        </p>
      ) : detail.error ? (
        <p className="mb-5 text-[13px] rounded border border-bz-border bg-bz-surface p-3">
          Couldn&apos;t load saved settings — {detail.error}. Editing below
          would overwrite whatever is stored, so reload before changing
          anything.
        </p>
      ) : null}

      <FormReplyBanner
        label={live.label}
        detail={live.detail}
        href={live.href}
        tone={live.tone}
      />

      <FormEditor
        form={detail.form}
        submissions={submissions.rows}
        submissionsError={
          submissions.missingTable ? null : submissions.error
        }
      />
    </CmsShell>
  );
}
