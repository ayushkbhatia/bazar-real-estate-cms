"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import {
  CASE_DOCUMENTS_MAX,
  CASE_DOCUMENT_DESCRIPTION_MAX,
  CASE_DOCUMENT_MAX_BYTES,
  CASE_DOCUMENT_TITLE_MAX,
  isCaseDocumentMime,
  NOTE_MAX,
} from "@/lib/mortgage-requests/case-documents";
import type { RequestFile } from "@/lib/mortgage-requests/server/cms-queries";
import {
  addMortgageNote,
  completeCaseDocument,
  removeCaseDocument,
  startCaseDocument,
} from "../_case-actions";
import { useAction, type Target } from "./file-actions";
import { Card } from "./ui";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

const FIELD =
  "w-full rounded-md border border-bz-border bg-bz-bg px-3 py-2 text-[13px] outline-none focus:border-bz-accent disabled:opacity-60";

/**
 * Internal notes (0171): staff-only comments on a request, newest first.
 * The owner or the Head adds them; everyone on the team reads them.
 */
export function InternalNotesCard({
  target,
  notes,
  canAdd,
}: {
  target: Target;
  notes: RequestFile["notes"];
  canAdd: boolean;
}) {
  const { pending, run } = useAction();
  const [body, setBody] = useState("");

  return (
    <Card title={t("internal.notes.title")}>
      <p className="text-[12px] text-bz-muted">{t("internal.notes.help")}</p>
      {canAdd ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            run(
              () => addMortgageNote({ ...target, body }),
              (r) => {
                if (r.ok) setBody("");
              },
            );
          }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={NOTE_MAX}
            rows={3}
            placeholder={t("internal.notes.placeholder")}
            aria-label={t("internal.notes.title")}
            className={FIELD}
            disabled={pending}
          />
          <div>
            <Button type="submit" size="sm" disabled={pending || !body.trim()}>
              {t("internal.notes.submit")}
            </Button>
          </div>
        </form>
      ) : null}
      {notes.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-bz-muted">{t("internal.notes.empty")}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md bg-bz-surface-2 px-3 py-2.5">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-bz-ink">{n.body}</p>
              <p className="mt-1.5 text-[11.5px] text-bz-muted">
                {t("internal.notes.by", { name: n.author?.name ?? "—", when: n.when })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** "2.4 MB", "640 KB". */
function sizeLabel(bytes: number): string {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Case documents (0171): files the team uploads to the case, each with a title
 * and a short description, at most 10. The file goes straight to the private
 * bucket through a signed URL, then the server checks the stored bytes before
 * it goes live. Opening one goes through the logged file route.
 */
export function CaseDocumentsCard({
  target,
  documents,
  canAdd,
}: {
  target: Target;
  documents: RequestFile["caseDocuments"];
  canAdd: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const full = documents.length >= CASE_DOCUMENTS_MAX;
  const busy = pending || uploading;

  async function upload() {
    if (!file || !title.trim()) return;
    if (!isCaseDocumentMime(file.type) || file.size > CASE_DOCUMENT_MAX_BYTES) {
      toast.error(t("internal.docs.badFile"));
      return;
    }
    setUploading(true);
    try {
      const started = await startCaseDocument({
        ...target,
        title,
        description,
        fileName: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      if (!started.ok) {
        toast.error(started.message);
        return;
      }
      const put = await fetch(started.url, { method: "PUT", headers: started.headers, body: file });
      const done = await completeCaseDocument({
        reference: target.reference,
        caseDocumentId: started.caseDocumentId,
        fileId: started.fileId,
      });
      if (!put.ok || !done.ok) {
        toast.error(done.ok ? t("internal.docs.badFile") : done.message);
        return;
      }
      toast.success(done.message ?? t("internal.docs.saved"));
      setTitle("");
      setDescription("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch {
      toast.error(t("common.failed"));
    } finally {
      setUploading(false);
      router.refresh();
    }
  }

  return (
    <Card
      title={t("internal.docs.title")}
      aside={
        <span className="text-[11.5px] text-bz-muted">
          {t("internal.docs.count", { count: documents.length, max: CASE_DOCUMENTS_MAX })}
        </span>
      }
    >
      <p className="text-[12px] text-bz-muted">{t("internal.docs.help", { max: CASE_DOCUMENTS_MAX })}</p>

      {documents.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-bz-muted">{t("internal.docs.empty")}</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-bz-border">
          {documents.map((d) => (
            <li key={d.id} className="flex items-start gap-3 py-3 first:pt-0">
              <FileText size={16} strokeWidth={1.6} className="mt-0.5 shrink-0 text-bz-muted" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-bz-ink">{d.title}</div>
                {d.description ? (
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-bz-ink-2">{d.description}</p>
                ) : null}
                <p className="mt-1 text-[11.5px] text-bz-muted">
                  {d.file
                    ? `${d.file.name} · ${sizeLabel(d.file.sizeBytes)} · `
                    : `${t("internal.docs.pending")} · `}
                  {t("internal.docs.by", { name: d.addedBy?.name ?? "—", when: d.when })}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  {d.file ? (
                    <>
                      <a
                        href={`/api/admin/mortgages/files/${d.file.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-bz-accent hover:underline"
                      >
                        <ExternalLink size={12} /> {t("internal.docs.open")}
                      </a>
                      <a
                        href={`/api/admin/mortgages/files/${d.file.id}?download=1`}
                        className="inline-flex items-center gap-1 text-[12px] text-bz-accent hover:underline"
                      >
                        <Download size={12} /> {t("internal.docs.download")}
                      </a>
                    </>
                  ) : null}
                  {canAdd ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(t("internal.docs.removeConfirm", { title: d.title }))) return;
                        run(() => removeCaseDocument({ ...target, caseDocumentId: d.id }));
                      }}
                      className="inline-flex items-center gap-1 text-[12px] text-bz-danger hover:underline disabled:opacity-60"
                    >
                      <Trash2 size={12} /> {t("internal.docs.remove")}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canAdd ? (
        full ? (
          <p className="mt-4 text-[12.5px] text-bz-muted">
            {t("internal.docs.full", { max: CASE_DOCUMENTS_MAX })}
          </p>
        ) : (
          <form
            className="mt-4 flex flex-col gap-2 border-t border-bz-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void upload();
            }}
          >
            <label className="text-[12px] font-medium text-bz-ink-2">
              {t("internal.docs.titleLabel")}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={CASE_DOCUMENT_TITLE_MAX}
                className={`mt-1 ${FIELD}`}
                disabled={busy}
                required
              />
            </label>
            <label className="text-[12px] font-medium text-bz-ink-2">
              {t("internal.docs.descriptionLabel")}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={CASE_DOCUMENT_DESCRIPTION_MAX}
                rows={2}
                className={`mt-1 ${FIELD}`}
                disabled={busy}
              />
            </label>
            <label className="text-[12px] font-medium text-bz-ink-2">
              {t("internal.docs.fileLabel")}
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-[12.5px]"
                disabled={busy}
                required
              />
            </label>
            <div>
              <Button type="submit" size="sm" disabled={busy || !file || !title.trim()}>
                {uploading ? t("internal.docs.uploading") : t("internal.docs.submit")}
              </Button>
            </div>
          </form>
        )
      ) : null}
    </Card>
  );
}
