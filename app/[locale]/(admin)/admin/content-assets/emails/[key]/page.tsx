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
import { emailSurfaces } from "@/lib/content-assets/usage";
import type { EmailLocale } from "@/lib/content-assets/tokens";
import { langFrom, withLang } from "../../_lang-toggle";
import { listFormAssignments } from "@/lib/queries/content-assets";
import type { BlogMediaOption } from "../../../blog/_image-insert-dialog";
import { SystemEmailEditor } from "./_system-email-editor";
import { PreviewOnlyEmail } from "./_preview-only";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ key: string }>;
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

/** The sample recipient every preview is addressed to. */
const SAMPLE_TO = {
  client: "Amira Haddad <amira@example.com>",
  team: "Layla Mansour <layla@bazarrealestate.ae>",
} as const;

function Crumbs({ label, lang }: { label: string; lang: EmailLocale }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Link href={withLang("/admin/content-assets", lang)} className="hover:text-bz-ink">
        Content assets · Site emails
      </Link>
      <ChevronRight size={11} />
      <span>{label}</span>
    </span>
  );
}

export default async function SystemEmailPage({ params, searchParams }: PageProps) {
  const { key } = await params;
  const lang = langFrom(await searchParams);
  const sender = emailSender();

  const previewOnly = PREVIEW_ONLY_EMAILS.find((e) => e.key === key);
  if (previewOnly) {
    const email = previewAdvisorReply(await readEmailBrand());
    return (
      <CmsShell title={previewOnly.label} breadcrumbs={<Crumbs label={previewOnly.label} lang={lang} />}>
        <PreviewOnlyEmail
          def={previewOnly}
          surfaces={emailSurfaces(previewOnly.key)}
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

  const [row, role, media, assignments] = await Promise.all([
    getSystemAssetRow(key),
    getStaffRole(),
    fetchImages(),
    listFormAssignments(),
  ]);
  const surfaces = emailSurfaces(
    key,
    Object.fromEntries(Object.entries(assignments).map(([k, a]) => [k, a.assetId])),
  );

  // The editor edits one language at a time; which columns that means is the
  // only difference between the two sides of the toggle.
  const initialBody = row
    ? lang === "ar"
      ? (row.body_ar ?? "")
      : bodyAsHtml(row.body, row.body_format)
    : "";
  const initialSubject = (lang === "ar" ? row?.subject_ar : row?.subject) ?? "";
  const englishBody = row ? bodyAsHtml(row.body, row.body_format) : "";
  const preview = await previewSystemEmail(key, {
    draft: row
      ? lang === "ar"
        ? {
            subject: "",
            body: "",
            subjectAr: initialSubject,
            bodyAr: initialBody,
            format: "html",
          }
        : { subject: initialSubject, body: initialBody, format: "html" }
      : null,
    locale: lang,
  });

  return (
    <CmsShell title={def.label} breadcrumbs={<Crumbs label={def.label} lang={lang} />}>
      {row ? (
        <SystemEmailEditor
          emailKey={key}
          lang={lang}
          english={{ subject: row.subject ?? "", body: englishBody }}
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
          surfaces={surfaces}
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
