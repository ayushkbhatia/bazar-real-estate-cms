import Link from "next/link";
import { notFound } from "next/navigation";
import { CmsShell } from "@/components/brand/cms-shell";
import { requireRole } from "@/lib/auth";
import { getFormForAdmin, listSubmissions } from "@/lib/queries/forms";
import { FormEditor } from "./_editor";

export const dynamic = "force-dynamic";

const FORM_ROLES = ["admin", "editor", "marketing"] as const;

type PageProps = { params: Promise<{ key: string }> };

export default async function AdminFormPage({ params }: PageProps) {
  const { key } = await params;
  const { supabase } = await requireRole(FORM_ROLES);

  const detail = await getFormForAdmin(supabase, key);
  if (!detail) notFound();

  const submissions = await listSubmissions(supabase, key, { limit: 300 });

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
