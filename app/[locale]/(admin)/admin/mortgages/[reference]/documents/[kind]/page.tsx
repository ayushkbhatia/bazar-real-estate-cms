import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Button } from "@/components/ui/button";
import { DOC_LABEL_KEY } from "@/lib/mortgage-requests/activity";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { getMortgageRole, requireMortgageRole } from "@/lib/mortgage-requests/server/cms-auth";
import { getViewer, isDocKind } from "@/lib/mortgage-requests/server/review";
import { DocumentReview } from "../../../_components/document-review";

export const dynamic = "force-dynamic";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

type Params = { params: Promise<{ reference: string; kind: string }> };

export async function generateMetadata({ params }: Params) {
  if (!(await getMortgageRole())) return {};
  const { reference, kind } = await params;
  return { title: isDocKind(kind) ? `${t(DOC_LABEL_KEY[kind])} · ${decodeURIComponent(reference)}` : decodeURIComponent(reference) };
}

/**
 * C3 · Document viewer (accept) and C4 · request re-upload: one document of a
 * Fast Pre-Approval next to its checklist. `?file=` opens a file, `?reupload=1`
 * opens the panel on the re-upload form (C2's "Request documents").
 */
export default async function DocumentViewerPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { reference, kind } = await params;
  if (!isDocKind(kind)) notFound();
  const { user, staff, role, supabase } = await requireMortgageRole();
  const data = await getViewer(supabase, decodeURIComponent(reference), kind, { id: user.id, role });
  if (!data) notFound();
  const sp = await searchParams;
  const file = typeof sp.file === "string" ? sp.file : null;

  return (
    <CmsShell
      title={t(DOC_LABEL_KEY[kind])}
      breadcrumbs={
        <>
          <Link href="/admin/mortgages">{t("nav.mortgages")}</Link> ›{" "}
          <Link href={`/admin/mortgages/${data.request.reference}`}>
            {data.request.reference} · {data.request.fullName}
          </Link>{" "}
          › Documents
        </>
      }
      secondary={
        <Button asChild variant="ghost" className="text-[13px]">
          <Link href={`/admin/mortgages/${data.request.reference}`}>
            <ArrowLeft strokeWidth={1.6} />
            {t("common.backToFile")}
          </Link>
        </Button>
      }
    >
      <DocumentReview
        key={data.doc.id}
        data={data}
        myFirstName={staff.display_name.trim().split(/\s+/)[0] ?? staff.display_name}
        startInReupload={sp.reupload === "1"}
        initialFileId={file}
      />
    </CmsShell>
  );
}
