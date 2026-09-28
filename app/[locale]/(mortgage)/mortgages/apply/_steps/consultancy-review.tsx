"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { validateDetails } from "@/lib/mortgage-requests/details";
import { formatDob, formatMobile } from "@/lib/mortgage-requests/format";
import { FLOW_PATHS } from "@/lib/mortgage-requests/client/apply-state";
import { trackMortgage } from "@/lib/mortgage-requests/client/analytics";
import { FlowActions } from "../../../_components/flow-actions";
import { FlowPage, FlowPending, useGuardedState } from "../../../_components/flow-page";
import { RailCard, Tick } from "../../../_components/primitives";
import { linkTag, richTags } from "../../../_components/rich";
import { FlowHeading, NextSteps } from "../../../_components/steps";
import { DetailsSummary, SelectionSummary } from "../../../_components/summary";
import { useSubmit } from "../../../_components/use-submit";
import { SubmitAlert } from "../../../_components/submit-alert";

/**
 * W3 · Consultancy — review & request. Nothing to upload: the applicant
 * checks the details and sends. Chips read service, residency, employment
 * as W3 designs them (FE-14 notes W5/W6 order them differently).
 */
export function ConsultancyReview() {
  const t = useTranslations("mortgage");
  const [state] = useGuardedState("review");
  const { submit, busy, failure } = useSubmit();
  const viewed = useRef(false);

  useEffect(() => {
    if (state && !viewed.current) {
      viewed.current = true;
      trackMortgage("mortgage_apply_viewed", { step: "review", service: "consultancy" });
    }
  }, [state]);

  if (!state) return <FlowPending />;
  const valid = validateDetails(state.details);
  if (!valid.ok) return <FlowPending />;
  const d = valid.details;

  const rail = (
    <RailCard title={t("common.whatHappensNext")}>
      <NextSteps
        items={[
          t.rich("consultNext.receive", richTags),
          t.rich("consultNext.review", richTags),
          t.rich("consultNext.contact", richTags),
        ]}
      />
    </RailCard>
  );

  return (
    <FlowPage step={2} last="submit" rail={rail}>
      <SelectionSummary
        label={t("selections.label")}
        chips={[
          t("selections.service.consultancy"),
          d.residency === "uae_national" ? t("residency.uaeNational.title") : t("residency.expat.title"),
          d.employmentType === "salaried" ? t("employment.salaried.title") : t("employment.businessOwner.title"),
        ]}
        action={{ label: t("selections.edit"), href: FLOW_PATHS.service }}
      />
      <FlowHeading eyebrow={t("w3.eyebrow")} title={t("w3.title")} lede={t("w3.lede")} />

      <div className="mt-9 flex items-start gap-[18px] rounded-[14px] border border-bz-border bg-bz-surface p-[22px]">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-[11px] bg-[var(--mrq-success-bg)] text-[var(--mrq-success-glyph)]"
        >
          <Tick size={20} strokeWidth={2.2} />
        </span>
        <div>
          <div className="text-[15.5px] font-medium">{t("w3.noDocs.title")}</div>
          <p className="mt-1 text-[13.5px] leading-[1.55] text-bz-ink-2">{t("w3.noDocs.body")}</p>
        </div>
      </div>

      <DetailsSummary
        title={t("w3.details.title")}
        edit={{ label: t("w3.details.edit"), href: FLOW_PATHS.details }}
        rows={[
          [t("field.fullName"), d.fullName],
          [t("field.dateOfBirth"), formatDob(d.dateOfBirth)],
          [t("field.mobile"), formatMobile(d.mobile)],
          [t("field.email"), d.email],
        ]}
      />

      {failure ? <SubmitAlert message={failure.message} /> : null}

      <FlowActions
        backHref={FLOW_PATHS.details}
        cta={t("w3.cta")}
        busy={busy}
        onCta={() => void submit(state, { service: "consultancy" })}
        fine={t.rich("w3.fine", { link: linkTag("/legal/privacy") })}
        fineId="w3-fine"
      />
    </FlowPage>
  );
}
