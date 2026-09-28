"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { CURRENT_CONSENT_VERSION } from "@/lib/mortgage-requests/consent";
import {
  DOCUMENT_SETS,
  requiredStatementMonths,
  type DocKind,
} from "@/lib/mortgage-requests/documents";
import { formatMonthList, formatMonthYear } from "@/lib/mortgage-requests/format";
import { FLOW_PATHS } from "@/lib/mortgage-requests/client/apply-state";
import { trackMortgage } from "@/lib/mortgage-requests/client/analytics";
import { completion, rowView } from "@/lib/mortgage-requests/client/upload-queue";
import { ConsentCheckbox, docKey, DocumentUploadRow } from "../../../_components/documents";
import { FlowActions } from "../../../_components/flow-actions";
import { FlowPage, FlowPending, useGuardedState } from "../../../_components/flow-page";
import { FlowButton, NoteRow, RailCard } from "../../../_components/primitives";
import { richTags } from "../../../_components/rich";
import { FlowHeading, NextSteps } from "../../../_components/steps";
import { SubmitAlert } from "../../../_components/submit-alert";
import { SelectionSummary } from "../../../_components/summary";
import { useDocuments } from "../../../_components/use-documents";
import { useSubmit } from "../../../_components/use-submit";

/**
 * W5 · Salaried documents / W6 · Business Owner documents. Four upload rows
 * from the document set, the consent, and a CTA that opens only when every
 * row has a ready file, nothing is moving or wrong, and consent is ticked
 * (00-foundations §7.5).
 */
export function UploadDocuments() {
  const t = useTranslations("mortgage");
  const [state, update] = useGuardedState("documents");
  const employment = state?.details.employmentType ?? "salaried";
  const kinds = DOCUMENT_SETS[employment];
  const docs = useDocuments(state, update, kinds);
  const { submit, busy, failure } = useSubmit();
  const viewed = useRef(false);

  useEffect(() => {
    if (state && !viewed.current) {
      viewed.current = true;
      trackMortgage("mortgage_apply_viewed", { step: "documents", service: "pre_approval" });
    }
  }, [state]);

  // The rows' live region: files added, removed and refused (00-foundations §11).
  const announcement = docs.announcement;
  const liveText = useMemo(() => {
    const item = announcement?.item;
    if (!item) return "";
    const document = t(`doc.${docKey(item.kind)}.name`);
    if (announcement.type === "added") return t("upload.announce.added", { name: item.name, document });
    if (announcement.type === "removed") return t("upload.announce.removed", { name: item.name });
    if (announcement.type === "failed") return t("upload.announce.failed", { name: item.name, document });
    return "";
  }, [announcement, t]);

  // The statement rows name the months they need, in Dubai time (W5, W6).
  const monthsNote = useMemo(() => {
    const now = new Date();
    const notes: Partial<Record<DocKind, string>> = {};
    for (const kind of kinds) {
      const months = requiredStatementMonths(kind, now);
      if (months.length === 3) notes[kind] = formatMonthList(months);
      else if (months.length > 3) {
        notes[kind] = t("docs.monthsRange", {
          from: formatMonthYear(months[0]!),
          to: formatMonthYear(months.at(-1)!),
        });
      }
    }
    return notes;
  }, [kinds, t]);

  if (!state) return <FlowPending />;

  const done = completion(kinds, docs.items);
  const ready = done.complete && state.consent && docs.draftStatus === "ready";
  const note = !done.anyFiles ? (
    t("docs.note.none", { total: done.total })
  ) : (
    <>
      {t.rich("docs.note.progress", { ...richTags, ready: done.ready, total: done.total })}
      {done.attention > 0 ? <> · {t("docs.note.attention", { count: done.attention })}</> : null}
      {done.complete && !state.consent ? <> · {t("docs.note.consent")}</> : null}
    </>
  );

  const onSubmit = async () => {
    const draft = docs.draft;
    if (!draft) return;
    const fileIds = docs.items
      .filter((i) => i.stage === "ready" && i.fileId && !i.replacedBy)
      .map((i) => i.fileId!);
    const failed = await submit(state, {
      service: "pre_approval",
      draftId: draft.draftId,
      draftToken: draft.draftToken,
      fileIds,
      wordingVersion: CURRENT_CONSENT_VERSION,
      documents: kinds.map((kind) => ({ kind, files: rowView(kind, docs.items).readyCount })),
    });
    if (failed?.code === "files_not_ready") await docs.actions.recheck();
    if (failed?.code === "draft_expired") await docs.actions.renew();
  };

  const rail = (
    <>
      <RailCard title={t("common.whatHappensNext")}>
        <NextSteps
          items={[
            t.rich("preNext.review", richTags),
            t.rich("preNext.price", richTags),
            t.rich("preNext.contact", richTags),
          ]}
        />
      </RailCard>
      <RailCard soft>
        <NoteRow glyph="shield" title={t("security.title")}>
          {t("security.body")}
        </NoteRow>
      </RailCard>
    </>
  );

  const d = state.details;
  return (
    <FlowPage step={2} last="documents" rail={rail}>
      <SelectionSummary
        label={t("selections.label")}
        chips={[
          t("selections.service.preApproval"),
          d.employmentType === "business_owner" ? t("employment.businessOwner.title") : t("employment.salaried.title"),
          d.residency === "uae_national" ? t("residency.uaeNational.title") : t("residency.expat.title"),
        ]}
        action={{ label: t("selections.edit"), href: FLOW_PATHS.service }}
      />
      <FlowHeading
        eyebrow={t("docs.eyebrow")}
        title={employment === "business_owner" ? t("w6.title") : t("w5.title")}
        lede={t("docs.lede")}
      />

      {docs.expired ? (
        <div role="status" className="mt-6 rounded-xl border border-bz-border bg-bz-surface-2 px-4 py-3 text-[13.5px] leading-[1.5] text-bz-ink-2">
          {t("docs.expired")}
        </div>
      ) : null}

      {docs.draftStatus === "failed" ? (
        <div className="mt-6">
          <SubmitAlert message={t("docs.error.draft")} />
          <FlowButton kind="outline" className="mt-3" onClick={() => void docs.actions.renew()}>
            {t("docs.error.retry")}
          </FlowButton>
        </div>
      ) : null}

      <div className="mt-9 flex flex-col gap-3" aria-busy={docs.draftStatus === "loading" || undefined}>
        {kinds.map((kind) => (
          <DocumentUploadRow
            key={kind}
            kind={kind}
            view={rowView(kind, docs.items)}
            note={monthsNote[kind]}
            onPick={(files, mode) => docs.actions.pick(kind, files, mode)}
            onCancel={docs.actions.cancel}
            onRemove={docs.actions.remove}
            onRetry={docs.actions.retry}
            canRetry={docs.actions.canRetry}
          />
        ))}
      </div>
      <div aria-live="polite" className="sr-only">
        {liveText}
      </div>

      <ConsentCheckbox
        checked={state.consent}
        onChange={(checked) => {
          update((s) => ({ ...s, consent: checked }));
          trackMortgage("mortgage_consent_toggled", { checked });
        }}
        label={t("consent.label")}
        pending={t("consent.pending")}
      />

      {failure ? <SubmitAlert message={failure.message} /> : null}

      <FlowActions
        backHref={FLOW_PATHS.details}
        note={note}
        noteId="docs-note"
        cta={t("docs.cta")}
        disabled={!ready || docs.draftStatus !== "ready"}
        busy={busy}
        onCta={() => void onSubmit()}
      />
    </FlowPage>
  );
}
