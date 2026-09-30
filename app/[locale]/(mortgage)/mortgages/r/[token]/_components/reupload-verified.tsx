"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Upload } from "lucide-react";
import { Glyph } from "@/components/mortgage/glyphs";
import { contiguous, formatMonthAbbrev, formatMonthSpan, type Coverage } from "@/lib/mortgage-requests/coverage";
import { acceptAttribute, DOCUMENT_RULES } from "@/lib/mortgage-requests/documents";
import { formatDayTime, formatLimitMb, formatMb, formatMonthList } from "@/lib/mortgage-requests/format";
import { ApiError } from "@/lib/mortgage-requests/client/api";
import { trackMortgage } from "@/lib/mortgage-requests/client/analytics";
import { sendReupload } from "@/lib/mortgage-requests/client/link-api";
import { isInFlight, rowAction, rowView } from "@/lib/mortgage-requests/client/upload-queue";
import type { ReuploadContext, StaffCard } from "@/lib/mortgage-requests/server/links";
import { cn } from "@/lib/utils";
import { docKey, DocumentIcon, UploadedFile, useUploadErrorMessage } from "../../../../_components/documents";
import { FlowActions } from "../../../../_components/flow-actions";
import { FlowPage } from "../../../../_components/flow-page";
import { FlowButton, NoteRow, Pill, RailCard } from "../../../../_components/primitives";
import { richTags } from "../../../../_components/rich";
import { ConfirmationHeading, FlowHeading, NextSteps } from "../../../../_components/steps";
import { useLinkUploads, useUploadAnnouncement, type ReadyFile } from "./use-link-uploads";

/** The secure pill in the page's top slot (W8). */
export function SecurePill({ fullName, sentTo }: { fullName: string; sentTo: string }) {
  const t = useTranslations("mortgage");
  return (
    <div className="ph-no-capture inline-flex min-h-8 items-center gap-2 rounded-full border border-bz-border bg-bz-surface px-3.5 py-1 text-[12.5px] text-bz-ink-2">
      <span className="flex shrink-0 text-[oklch(0.5_0.12_145)]">
        <Glyph name="lock" size={14} />
      </span>
      {t("w8.secure", { fullName, maskedMobile: sentTo })}
    </div>
  );
}

/** The adviser's message: plain text from the CMS, escaped by React, its line breaks kept. */
function AdviserMessage({ adviser, sentAt, message }: { adviser: StaffCard | null; sentAt: string; message: string }) {
  const t = useTranslations("mortgage");
  const when = formatDayTime(sentAt);
  return (
    <div className="mt-8 flex gap-3.5 rounded-[14px] border border-bz-border bg-bz-surface px-5 py-[18px]">
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-bz-surface-2 text-[13px] font-medium text-bz-ink-2"
      >
        {adviser?.initials ?? t("shell.brand").slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
          <b className="font-semibold">{adviser?.name ?? t("shell.brand")}</b>
          <span className="text-[12px] text-bz-muted">
            {adviser?.title ? t("w8.adviser.meta", { roleLabel: adviser.title, sentAt: when }) : when}
          </span>
        </div>
        <p className="mt-1.5 text-[14.5px] leading-[1.55] break-words whitespace-pre-line">{message}</p>
      </div>
    </div>
  );
}

/** A run of months as the legend writes it: a span when unbroken, a list when not. */
function monthsText(months: readonly string[]): string {
  return contiguous(months) ? formatMonthSpan(months[0]!, months.at(-1)!) : formatMonthList(months);
}

/** The months the statements must cover: received in green, missing dashed (W8, C4). */
function CoverageGrid({ coverage: cov }: { coverage: Coverage }) {
  const t = useTranslations("mortgage");
  return (
    <>
      <div className="grid grid-cols-6 gap-1 md:grid-cols-12" aria-hidden>
        {cov.months.map(({ month, received }) => (
          <div
            key={month}
            className={cn(
              "flex h-[46px] flex-col items-center justify-center gap-px rounded-md",
              received
                ? "border border-transparent bg-[oklch(0.94_0.04_145)]"
                : "border-[1.5px] border-dashed border-[oklch(0.72_0.12_28)] bg-[oklch(0.985_0.01_28)]",
            )}
          >
            <span className={cn("text-[11.5px] font-medium", received ? "text-[oklch(0.35_0.08_145)]" : "text-[oklch(0.48_0.15_28)]")}>
              {formatMonthAbbrev(month)}
            </span>
            <span className={cn("mono text-[9.5px]", received ? "text-[oklch(0.45_0.06_145)]" : "text-[oklch(0.55_0.12_28)]")}>
              ’{month.slice(2, 4)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-1 text-[12px] text-bz-muted md:flex-row md:justify-between md:gap-4">
        <span>{cov.received.length ? t("w8.coverage.received", { range: monthsText(cov.received) }) : null}</span>
        {cov.missing.length ? (
          <span className="text-[oklch(0.48_0.15_28)]">{t("w8.coverage.needed", { range: monthsText(cov.missing) })}</span>
        ) : null}
      </div>
    </>
  );
}

/**
 * W8 · Re-upload from a secure link, verified (the designed state): the
 * adviser's message, the flagged document with its coverage and a dropzone
 * for the new files, the documents already accepted, and Send. The files wait
 * in the link's own draft until Send; nothing reaches the application before.
 */
export function ReuploadVerified({ token, context, ready }: { token: string; context: ReuploadContext; ready: readonly ReadyFile[] }) {
  const t = useTranslations("mortgage");
  const errorMessage = useUploadErrorMessage();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const mode = useRef<"add" | "replace" | "choose_another">("add");
  const viewed = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const { items, announcement, actions } = useLinkUploads(token, ready);
  const liveText = useUploadAnnouncement(announcement);

  const { reason } = context.request;
  const doc = context.document;
  const kind = doc.kind;
  const key = docKey(kind);
  const rule = DOCUMENT_RULES[kind];
  const multi = rule.maxFiles > 1;
  const statements = doc.coverage !== null;
  // The months are the story only when they are what's wrong: the periods are
  // the reviewer's to enter, so a new file without one isn't a missing month.
  const cov = reason === "period_incomplete" ? doc.coverage : null;
  const view = rowView(kind, items);
  const action = rowAction(kind, view);
  const toSend = items.filter((i) => i.kind === kind && i.stage === "ready" && !i.replacedBy && i.fileId);
  const canSend = toSend.length > 0 && !items.some(isInFlight) && !items.some((i) => i.stage === "error");
  const accepted = context.otherDocuments.filter((d) => d.state === "accepted");
  const adviserFirstName = context.adviser?.firstName ?? t("shell.brand");
  const firstName = context.applicant.firstName;

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackMortgage("mortgage_reupload_viewed", { kind, reason, state: "verified" });
  }, [kind, reason]);

  const pick = (m: typeof mode.current) => {
    mode.current = m;
    input.current?.click();
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files];
    if (files.length === 0) return;
    actions.pick(kind, files, action === "choose_another" ? "choose_another" : action === "replace" ? "replace" : "add");
  };

  const send = async () => {
    setSending(true);
    setFailure(null);
    try {
      await sendReupload(token, toSend.map((i) => i.fileId!));
      trackMortgage("mortgage_reupload_sent", { kind, files: toSend.length });
      setSent(true);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "generic";
      setFailure(code === "link_unavailable" || code === "unauthorised" || code === "link_locked" ? t("w8.submit.gone") : t("w8.submit.error"));
      setSending(false);
    }
  };

  if (sent) {
    return (
      <FlowPage>
        <ConfirmationHeading
          eyebrow={t("w8.eyebrow", { reference: context.reference })}
          title={t("w8.sent.title", { firstName })}
          body={t("w8.sent.body", { adviserFirstName })}
        />
      </FlowPage>
    );
  }

  const statementsShort = cov !== null && !cov.complete;
  const noun = t(`doc.${key}.name`);
  const instruction = statementsShort
    ? t.rich("w8.drop.instruction", { ...richTags, months: formatMonthList(cov.missing, "en", "long") })
    : doc.replace
      ? t.rich("w8.drop.replace", { ...richTags, document: noun.toLowerCase() })
      : t.rich("w8.drop.add", { ...richTags, document: noun.toLowerCase() });
  // Designed for the other three accepted; any other count has its own sentence.
  const lede =
    accepted.length === 3 && context.otherDocuments.length === 3
      ? t("w8.lede", { firstName })
      : t("w8.ledeCount", { firstName, count: accepted.length });
  const errorId = `${id}-error`;

  return (
    <FlowPage
      top={<SecurePill fullName={context.applicant.fullName} sentTo={context.applicant.codeSentTo} />}
      rail={
        <>
          <RailCard title={t("common.whatHappensNext")}>
            <NextSteps
              items={[
                t.rich(statements ? "w8.next.check" : "w8.next.checkOther", { ...richTags, adviserFirstName }),
                t.rich("w8.next.price", richTags),
                t.rich("w8.next.contact", richTags),
              ]}
            />
          </RailCard>
          <RailCard soft>
            <NoteRow glyph="chat" title={t("w8.questions.title")}>
              {t("w8.questions.body", { adviserFirstName })}
            </NoteRow>
          </RailCard>
        </>
      }
    >
      <FlowHeading eyebrow={t("w8.eyebrow", { reference: context.reference })} title={t("w8.title")} lede={lede} />

      <AdviserMessage adviser={context.adviser} sentAt={context.request.sentAt} message={context.request.message} />

      <div
        role="group"
        aria-labelledby={`${id}-title`}
        aria-describedby={view.error ? errorId : undefined}
        className="mt-3 rounded-[14px] border border-[oklch(0.86_0.07_28)] bg-bz-surface px-5 py-5 md:px-[22px]"
      >
        <input
          ref={input}
          type="file"
          className="sr-only"
          tabIndex={-1}
          accept={acceptAttribute(kind)}
          multiple={multi}
          aria-label={t("upload.pickerLabel", { document: noun })}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length > 0) actions.pick(kind, files, mode.current);
          }}
        />
        <div className="flex items-center gap-4">
          <DocumentIcon kind={kind} state="error" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span id={`${id}-title`} className="text-[15.5px] font-medium">
                {noun}
              </span>
              <Pill tone="danger" small>
                {statementsShort ? t("w8.pill.monthsMissing", { count: cov.missing.length }) : t(`w8.reason.${reason}`)}
              </Pill>
            </div>
            <div className="mt-[3px] text-[12.5px] text-bz-muted">{t(`doc.${key}.hint`)}</div>
          </div>
        </div>

        {cov ? (
          <div className="mt-[18px]">
            <CoverageGrid coverage={cov} />
          </div>
        ) : null}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "mt-[18px] rounded-xl border-[1.5px] p-[18px] transition-colors",
            dragging ? "border-solid border-bz-ink-2 bg-bz-surface-2" : "border-dashed border-bz-border-strong bg-bz-bg",
          )}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <p className="flex-1 text-[13.5px]">{instruction}</p>
            {action === "cancel" ? (
              <FlowButton kind="ghost" size="sm" className="self-start md:self-auto" onClick={() => view.items.filter(isInFlight).forEach((i) => actions.cancel(i.localId))}>
                {t("upload.cancel")}
              </FlowButton>
            ) : action === "replace" ? (
              <FlowButton kind="ghost" size="sm" className="self-start md:self-auto" onClick={() => pick("replace")}>
                <RefreshCw size={16} strokeWidth={1.6} aria-hidden />
                {t("upload.replace")}
              </FlowButton>
            ) : action === "choose_another" ? (
              <FlowButton kind="outline" size="sm" className="self-start md:self-auto" onClick={() => pick("choose_another")}>
                <Upload size={16} strokeWidth={1.6} aria-hidden />
                {t("upload.chooseAnother")}
              </FlowButton>
            ) : (
              <div className="flex items-center gap-3">
                <span className="hidden text-[12px] text-bz-muted md:inline">{multi ? t("upload.dropMany") : t("upload.dropOne")}</span>
                <FlowButton kind="outline" size="sm" onClick={() => pick("add")}>
                  <Upload size={16} strokeWidth={1.6} aria-hidden />
                  {multi ? t("upload.uploadMany") : t("upload.uploadOne")}
                </FlowButton>
              </div>
            )}
          </div>
          {view.items.length > 0 ? (
            <div className="ph-no-capture mt-3.5 flex flex-col gap-2.5 border-t border-bz-border pt-3.5">
              {view.items.map((item) => (
                <UploadedFile
                  key={item.localId}
                  item={item}
                  meta={item.stage === "ready" && !item.replacedBy ? t("w8.file.readyToSend", { size: formatMb(item.sizeBytes) }) : undefined}
                  onRemove={() => actions.remove(item.localId)}
                  onCancel={() => actions.cancel(item.localId)}
                />
              ))}
              {view.error?.error ? (
                <div id={errorId} className="flex gap-2 text-[12.5px] leading-[1.5] text-[var(--mrq-danger-fg)]">
                  <Glyph name="alert" size={15} className="mt-0.5 shrink-0" />
                  <span>
                    {errorMessage(kind, view.error.error)}
                    {actions.canRetry(view.error.localId) ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={() => actions.retry(view.error!.localId)}
                          className="font-medium underline underline-offset-2"
                        >
                          {t("upload.retry")}
                        </button>
                      </>
                    ) : null}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* The files already received can't be removed here: the footnote lists them (W8). */}
        {doc.replace ? (
          <p className="mt-3 text-[12px] text-bz-muted">{t("w8.replaceNote", { document: noun.toLowerCase() })}</p>
        ) : doc.existingFiles.length > 0 ? (
          <p className="ph-no-capture mt-3 text-[12px] text-bz-muted">
            {t("w8.alreadyReceived", {
              files: doc.existingFiles.map((f) => f.name).join(", "),
              used: formatMb(doc.usedBytes),
              limit: formatLimitMb(doc.limitBytes),
            })}
          </p>
        ) : null}
      </div>
      <div aria-live="polite" className="sr-only">
        {liveText}
      </div>

      {accepted.length > 0 ? (
        <ul className="mt-3 overflow-hidden rounded-[14px] border border-bz-border bg-bz-surface">
          {accepted.map((d, i) => (
            <li key={d.kind} className={cn("flex items-center gap-3.5 px-5 py-3", i > 0 && "border-t border-bz-border")}>
              <DocumentIcon kind={d.kind} state="done" size={32} />
              <span className="flex-1 text-[13.5px]">{t(`doc.${docKey(d.kind)}.name`)}</span>
              <Pill tone="success" small>
                {t("doc.state.accepted")}
              </Pill>
            </li>
          ))}
        </ul>
      ) : null}

      {failure ? (
        <p role="alert" className="mt-6 text-[13.5px] text-[var(--mrq-danger-fg)]">
          {failure}
        </p>
      ) : null}
      <FlowActions
        note={t("w8.note")}
        noteId={`${id}-note`}
        cta={t("w8.cta")}
        disabled={!canSend}
        busy={sending}
        onCta={() => void send()}
      />
    </FlowPage>
  );
}
