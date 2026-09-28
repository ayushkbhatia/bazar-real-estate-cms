"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { formatDayTime, formatMobile, formatTime, maskMobile } from "@/lib/mortgage-requests/format";
import type { SubmittedSummary } from "@/lib/mortgage-requests/client/apply-state";
import { trackMortgage } from "@/lib/mortgage-requests/client/analytics";
import { docKey, DocumentIcon } from "../../../_components/documents";
import { FlowPage, FlowPending, useGuardedState } from "../../../_components/flow-page";
import { Glyph } from "../../../_components/glyphs";
import { FlowLinkButton, RailCard } from "../../../_components/primitives";
import { richTags } from "../../../_components/rich";
import { ConfirmationHeading, ProgressTrack } from "../../../_components/steps";
import { KeyValueList } from "../../../_components/summary";

export function Received() {
  const [state] = useGuardedState("received");
  const viewed = useRef(false);
  const submitted = state?.submitted;

  useEffect(() => {
    if (submitted && !viewed.current) {
      viewed.current = true;
      trackMortgage("mortgage_apply_viewed", { step: "received", service: submitted.service });
    }
  }, [submitted]);

  if (!submitted) return <FlowPending />;
  return submitted.service === "consultancy" ? (
    <ConsultancyReceived s={submitted} />
  ) : (
    <ApplicationReceived s={submitted} />
  );
}

function useSummaryRows(s: SubmittedSummary): [string, React.ReactNode][] {
  const t = useTranslations("mortgage");
  return [
    [t("summary.reference"), <span key="ref" className="mono">{s.reference}</span>],
    [t("summary.service"), s.service === "consultancy" ? t("service.consultancy") : t("service.preApproval")],
    [t("summary.residency"), s.residency === "uae_national" ? t("residency.uaeNational.title") : t("residency.expat.title")],
    [t("summary.employment"), s.employmentType === "salaried" ? t("employment.salaried.title") : t("employment.businessOwner.title")],
  ];
}

function Onward({ s }: { s: SubmittedSummary }) {
  const t = useTranslations("mortgage");
  return (
    <div className="mt-8 flex flex-col gap-2.5 min-[480px]:flex-row">
      <FlowLinkButton kind="outline" size="lg" href={s.returnTo ?? "/"}>
        {t("received.backToBazar")}
      </FlowLinkButton>
      <FlowLinkButton kind="ghost" size="lg" href="/tools/mortgage">
        <Glyph name="chart" />
        {t("received.estimatePayment")}
      </FlowLinkButton>
    </div>
  );
}

/** W4 · Consultancy — request received. */
function ConsultancyReceived({ s }: { s: SubmittedSummary }) {
  const t = useTranslations("mortgage");
  const rows = useSummaryRows(s);
  const rail = (
    <RailCard title={t("w4.rail.title")}>
      <div className="ph-no-capture">
        <KeyValueList rows={[...rows, [t("summary.received"), formatDayTime(s.submittedAt)]]} />
        <div className="mt-[18px] border-t border-bz-border pt-4">
          <div className="text-[12px] text-bz-muted">{t("w4.rail.contactOn")}</div>
          <div className="mt-1.5 flex items-center gap-2 text-[13.5px]">
            <Glyph name="phone" />
            {formatMobile(s.mobile)}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[13.5px] break-all">
            <Glyph name="mail" className="shrink-0" />
            {s.email}
          </div>
        </div>
      </div>
    </RailCard>
  );
  return (
    <FlowPage step={3} last="submit" rail={rail}>
      <ConfirmationHeading eyebrow={t("w4.eyebrow")} title={t("w4.title")} body={t("w4.body")} />
      <div className="mt-10">
        <ProgressTrack
          items={[
            {
              body: t.rich("consultNext.receive", richTags),
              meta: t("w4.track.receivedAt", { time: formatTime(s.submittedAt) }),
            },
            { body: t.rich("consultNext.review", richTags) },
            { body: t.rich("consultNext.contact", richTags) },
          ]}
        />
      </div>
      <Onward s={s} />
    </FlowPage>
  );
}

/** W7 · Pre-approval — application received, with the promise as a time. */
function ApplicationReceived({ s }: { s: SubmittedSummary }) {
  const t = useTranslations("mortgage");
  const rows = useSummaryRows(s);
  const rail = (
    <RailCard title={t("w7.rail.title")}>
      <div className="ph-no-capture">
        <KeyValueList rows={rows} />
      </div>
      <div className="mt-[18px] mb-2.5 border-t border-bz-border pt-4 text-[12px] text-bz-muted">
        {t("w7.rail.docsReceived")}
      </div>
      <ul className="flex flex-col gap-2.5">
        {(s.documents ?? []).map((doc) => (
          <li key={doc.kind} className="flex items-center gap-3">
            <DocumentIcon kind={doc.kind} state="done" size={32} />
            <span className="flex-1 text-[13px] leading-[1.35]">{t(`doc.${docKey(doc.kind)}.name`)}</span>
            <span className="text-[11.5px] whitespace-nowrap text-bz-muted">
              {t("w7.rail.fileCount", { count: doc.files })}
            </span>
          </li>
        ))}
      </ul>
    </RailCard>
  );
  return (
    <FlowPage step={3} last="documents" rail={rail}>
      <ConfirmationHeading eyebrow={t("w7.eyebrow")} title={t("w7.title")} body={t("w7.body")} />
      {s.dueAt ? (
        <div className="mt-9 flex flex-col gap-3 rounded-[14px] bg-bz-ink px-6 py-5 text-bz-bg md:flex-row md:items-center md:gap-[18px]">
          <div className="flex flex-1 items-center gap-[18px]">
            <Glyph name="clock" size={28} strokeWidth={1.4} className="shrink-0" />
            <div>
              <div className="text-[12px] opacity-70">{t("w7.due.label")}</div>
              <time dateTime={s.dueAt} className="serif mt-0.5 block text-[30px] leading-[1.1]">
                {formatDayTime(s.dueAt)}
              </time>
            </div>
          </div>
          <p className="max-w-[260px] text-[12.5px] leading-[1.5] opacity-75 md:text-end">{t("w7.due.note")}</p>
        </div>
      ) : null}
      <div className="mt-4">
        <ProgressTrack
          items={[
            {
              body: <b className="font-semibold text-bz-ink">{t("w7.track.submitted")}</b>,
              meta: formatDayTime(s.submittedAt),
            },
            { body: t.rich("preNext.review", richTags) },
            { body: t.rich("preNext.price", richTags) },
            { body: t.rich("preNext.contact", richTags) },
          ]}
        />
      </div>
      <div className="ph-no-capture mt-4 flex gap-3 rounded-[14px] bg-bz-surface-2 px-5 py-4 text-[13.5px] leading-[1.55] text-bz-ink-2">
        <span className="mt-px text-bz-accent">
          <Glyph name="chat" />
        </span>
        <span>{t.rich("w7.whatsapp", { ...richTags, maskedMobile: maskMobile(s.mobile) })}</span>
      </div>
      <Onward s={s} />
    </FlowPage>
  );
}
