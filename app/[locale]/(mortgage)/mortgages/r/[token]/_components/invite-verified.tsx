"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CURRENT_CONSENT_VERSION } from "@/lib/mortgage-requests/consent";
import { requiredStatementMonths, type DocKind } from "@/lib/mortgage-requests/documents";
import { formatMonthList, formatMonthYear } from "@/lib/mortgage-requests/format";
import { ApiError } from "@/lib/mortgage-requests/client/api";
import type { SubmittedSummary } from "@/lib/mortgage-requests/client/apply-state";
import { trackMortgage } from "@/lib/mortgage-requests/client/analytics";
import { submitInvite } from "@/lib/mortgage-requests/client/link-api";
import { completion, rowView } from "@/lib/mortgage-requests/client/upload-queue";
import type { InviteContext } from "@/lib/mortgage-requests/server/links";
import { ConsentCheckbox, DocumentUploadRow } from "../../../../_components/documents";
import { FlowActions } from "../../../../_components/flow-actions";
import { FlowPage } from "../../../../_components/flow-page";
import { NoteRow, RailCard } from "../../../../_components/primitives";
import { richTags } from "../../../../_components/rich";
import { FlowHeading, NextSteps } from "../../../../_components/steps";
import { SubmitAlert } from "../../../../_components/submit-alert";
import { ApplicationReceived } from "../../../apply/_steps/received";
import { SecurePill } from "./reupload-verified";
import { useLinkUploads, useUploadAnnouncement, type ReadyFile } from "./use-link-uploads";

/**
 * The pre-approval invite (C6 → W8's route, FE-2: not designed). After the
 * code it is W5/W6's documents step with the consultancy's details carried
 * over — nothing to type again — and sending it makes a new pre-approval
 * request linked to the consultancy, then shows W7.
 */
export function InviteVerified({ token, context, ready }: { token: string; context: InviteContext; ready: readonly ReadyFile[] }) {
  const t = useTranslations("mortgage");
  const kinds = context.kinds;
  const { items, announcement, actions } = useLinkUploads(token, ready);
  const liveText = useUploadAnnouncement(announcement);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<SubmittedSummary | null>(null);
  // One key per page: a retried send makes one request, never two.
  const idempotencyKey = useState(() => crypto.randomUUID())[0];

  // The statement rows name the months they need, in Dubai time (W5, W6).
  const monthsNote = useMemo(() => {
    const now = new Date();
    const notes: Partial<Record<DocKind, string>> = {};
    for (const kind of kinds) {
      const months = requiredStatementMonths(kind, now);
      if (months.length === 3) notes[kind] = formatMonthList(months);
      else if (months.length > 3) {
        notes[kind] = t("docs.monthsRange", { from: formatMonthYear(months[0]!), to: formatMonthYear(months.at(-1)!) });
      }
    }
    return notes;
  }, [kinds, t]);

  if (done) return <ApplicationReceived s={done} maskedMobile={context.applicant.maskedMobile} stepper={false} />;

  const progress = completion(kinds, items);
  const ready_ = progress.complete && consent;
  const note = !progress.anyFiles ? (
    t("docs.note.none", { total: progress.total })
  ) : (
    <>
      {t.rich("docs.note.progress", { ...richTags, ready: progress.ready, total: progress.total })}
      {progress.attention > 0 ? <> · {t("docs.note.attention", { count: progress.attention })}</> : null}
      {progress.complete && !consent ? <> · {t("docs.note.consent")}</> : null}
    </>
  );

  const onSubmit = async () => {
    setBusy(true);
    setFailure(null);
    const fileIds = items.filter((i) => i.stage === "ready" && i.fileId && !i.replacedBy).map((i) => i.fileId!);
    try {
      const made = await submitInvite(token, { fileIds, consent: { given: true, wordingVersion: CURRENT_CONSENT_VERSION } }, idempotencyKey);
      trackMortgage("mortgage_invite_submitted", { employment_type: context.employment });
      setDone({
        reference: made.reference,
        service: "pre_approval",
        submittedAt: made.submittedAt,
        dueAt: made.dueAt,
        residency: context.residency,
        employmentType: context.employment,
        // The server masked the mobile; W7 is handed that, not a number.
        mobile: "",
        email: "",
        documents: kinds.map((kind) => ({ kind, files: rowView(kind, items).readyCount })),
      });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "generic";
      setFailure(code === "link_unavailable" || code === "unauthorised" || code === "link_locked" ? t("w8.submit.gone") : t("w8.submit.error"));
      setBusy(false);
    }
  };

  return (
    <FlowPage
      top={<SecurePill fullName={context.applicant.fullName} sentTo={context.applicant.codeSentTo} />}
      rail={
        <>
          <RailCard title={t("common.whatHappensNext")}>
            <NextSteps
              items={[t.rich("preNext.review", richTags), t.rich("preNext.price", richTags), t.rich("preNext.contact", richTags)]}
            />
          </RailCard>
          <RailCard soft>
            <NoteRow glyph="shield" title={t("security.title")}>
              {t("security.body")}
            </NoteRow>
          </RailCard>
        </>
      }
    >
      <FlowHeading
        eyebrow={t("w8.invite.eyebrow", { reference: context.reference })}
        title={context.employment === "business_owner" ? t("w6.title") : t("w5.title")}
        lede={t("w8.invite.lede")}
      />

      <div className="mt-9 flex flex-col gap-3">
        {kinds.map((kind) => (
          <DocumentUploadRow
            key={kind}
            kind={kind}
            view={rowView(kind, items)}
            note={monthsNote[kind]}
            onPick={(files, mode) => actions.pick(kind, files, mode)}
            onCancel={actions.cancel}
            onRemove={actions.remove}
            onRetry={actions.retry}
            canRetry={actions.canRetry}
          />
        ))}
      </div>
      <div aria-live="polite" className="sr-only">
        {liveText}
      </div>

      <ConsentCheckbox
        checked={consent}
        onChange={(checked) => {
          setConsent(checked);
          trackMortgage("mortgage_consent_toggled", { checked });
        }}
        label={t("consent.label")}
        pending={t("consent.pending")}
      />

      {failure ? <SubmitAlert message={failure} /> : null}

      <FlowActions note={note} noteId="invite-note" cta={t("docs.cta")} disabled={!ready_} busy={busy} onCta={() => void onSubmit()} />
    </FlowPage>
  );
}
