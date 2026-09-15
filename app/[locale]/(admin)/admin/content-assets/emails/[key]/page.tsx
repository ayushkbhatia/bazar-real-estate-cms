import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffRole } from "@/lib/auth";
import { mediaPublicUrl } from "@/lib/media";
import { emailSender } from "@/lib/email";
import { getSystemAssetRow } from "@/lib/queries/content-assets";
import {
  PREVIEW_ONLY_EMAILS,
  SYSTEM_ASSETS,
  isSystemAssetKey,
} from "@/lib/content-assets/system";
import { bodyAsHtml } from "@/lib/content-assets/email-html";
import {
  liveSourceLabel,
  previewAdvisorReply,
  previewSystemEmail,
} from "@/lib/content-assets/system-emails";
import { readEmailBrand } from "@/lib/content-assets/system-resolve";
import type { BlogMediaOption } from "../../../blog/_image-insert-dialog";
import { SystemEmailEditor } from "./_system-email-editor";
import { PreviewOnlyEmail } from "./_preview-only";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ key: string }> };

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

/** The sample recipient every preview is addressed to. */
const SAMPLE_TO = {
  client: "Amira Haddad <amira@example.com>",
  team: "Layla Mansour <layla@bazarrealestate.ae>",
} as const;

function Crumbs({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Link href="/admin/content-assets" className="hover:text-bz-ink">
        Content assets · Site emails
      </Link>
      <ChevronRight size={11} />
      <span>{label}</span>
    </span>
  );
}

export default async function SystemEmailPage({ params }: PageProps) {
  const { key } = await params;
  const sender = emailSender();

  const previewOnly = PREVIEW_ONLY_EMAILS.find((e) => e.key === key);
  if (previewOnly) {
    const email = previewAdvisorReply(await readEmailBrand());
    return (
      <CmsShell title={previewOnly.label} breadcrumbs={<Crumbs label={previewOnly.label} />}>
        <PreviewOnlyEmail
          def={previewOnly}
          email={email}
          from={sender.from}
          replyTo={sender.replyTo}
          to={SAMPLE_TO.client}
        />
      </CmsShell>
    );
  }

  if (!isSystemAssetKey(key)) notFound();
  const def = SYSTEM_ASSETS[key];

  const [row, role, media] = await Promise.all([
    getSystemAssetRow(key),
    getStaffRole(),
    fetchImages(),
  ]);

  const initialBody = row ? bodyAsHtml(row.body, row.body_format) : "";
  const initialSubject = row?.subject ?? "";
  const preview = await previewSystemEmail(key, {
    draft: row
      ? { subject: initialSubject, body: initialBody, format: "html" }
      : null,
  });

  return (
    <CmsShell title={def.label} breadcrumbs={<Crumbs label={def.label} />}>
      {row ? (
        <SystemEmailEditor
          emailKey={key}
          initial={{
            subject: initialSubject,
            body: initialBody,
            notes: row.notes ?? "",
            status: row.status,
          }}
          updatedAt={row.updated_at}
          live={preview.live}
          liveLabel={liveSourceLabel(key, preview.liveSource)}
          liveIsOwn={
            preview.liveSource.kind === "override" && preview.liveSource.key === key
          }
          builtin={preview.builtin}
          initialDraft={preview.draft}
          media={media}
          canWrite={role === "admin" || role === "editor" || role === "marketing"}
          from={sender.from}
          replyTo={sender.replyTo}
          to={SAMPLE_TO[def.audience]}
        />
      ) : (
        <div className="rounded-lg border border-bz-border bg-bz-surface p-6 text-[13px] text-bz-ink-2 max-w-[70ch]">
          The row for this email hasn&apos;t been created in this database yet —
          migration <span className="mono">0127_system_emails_catalogue</span>{" "}
          seeds it. Until then Bazar&apos;s built-in wording sends, exactly as
          before.
        </div>
      )}
    </CmsShell>
  );
}
