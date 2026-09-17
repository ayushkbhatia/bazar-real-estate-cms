import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffRole } from "@/lib/auth";
import { mediaPublicUrl } from "@/lib/media";
import { emailSender } from "@/lib/email";
import {
  getContentAssetById,
  listFormAssignments,
} from "@/lib/queries/content-assets";
import { bodyAsHtml } from "@/lib/content-assets/email-html";
import { previewFormReply } from "@/lib/content-assets/system-emails";
import { assignableForms } from "@/lib/content-assets/usage";
import { langFrom, withLang } from "../../_lang-toggle";
import type { BlogMediaOption } from "../../../blog/_image-insert-dialog";
import { FormReplyEditor } from "./_reply-editor";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function fetchImages(): Promise<BlogMediaOption[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("media_assets")
    .select("id, filename, storage_key, mime_type")
    .is("deleted_at", null)
    .like("mime_type", "image/%")
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []).map((m) => ({
    id: m.id,
    filename: m.filename,
    url: mediaPublicUrl(m.storage_key),
    mime: m.mime_type,
    storage_key: m.storage_key,
  }));
}

export default async function FormReplyPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const lang = langFrom(await searchParams);
  const [asset, assignments, role, media] = await Promise.all([
    getContentAssetById(id),
    listFormAssignments(),
    getStaffRole(),
    fetchImages(),
  ]);
  if (!asset || asset.role !== "form_reply") notFound();

  const englishBody = bodyAsHtml(asset.body, asset.body_format);
  const body = lang === "ar" ? (asset.body_ar ?? "") : englishBody;
  const subject = (lang === "ar" ? asset.subject_ar : asset.subject) ?? "";
  const usedBy = assignableForms()
    .filter((def) => assignments[def.key]?.assetId === asset.id)
    .map((def) => ({ key: def.key, name: def.name, surface: def.surface, path: def.path }));

  const preview = await previewFormReply(
    lang === "ar"
      ? { subject: "", body: "", subjectAr: subject, bodyAr: body, format: "html" }
      : { subject, body, format: "html" },
    usedBy[0]?.key ?? null,
    undefined,
    lang,
  );
  const sender = emailSender();

  return (
    <CmsShell
      title={asset.name}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href={withLang("/admin/content-assets/replies", lang)} className="hover:text-bz-ink">
            Content assets · Form replies
          </Link>
          <ChevronRight size={11} />
          <span>{asset.name}</span>
        </span>
      }
    >
      <FormReplyEditor
        id={asset.id}
        lang={lang}
        english={{ subject: asset.subject ?? "", body: englishBody }}
        initial={{
          name: asset.name,
          subject,
          body,
          notes: asset.notes ?? "",
          status: asset.status,
        }}
        updatedAt={asset.updated_at}
        trashed={asset.deleted_at !== null}
        usedBy={usedBy}
        assignableForms={assignableForms().map((def) => ({
          key: def.key,
          name: def.name,
          surface: def.surface,
          assignedElsewhere:
            assignments[def.key] != null && assignments[def.key]?.assetId !== asset.id
              ? assignments[def.key]!.assetName
              : null,
        }))}
        initialPreview={preview}
        media={media}
        canWrite={role === "admin" || role === "editor" || role === "marketing"}
        from={sender.from}
        replyTo={sender.replyTo}
      />
    </CmsShell>
  );
}
