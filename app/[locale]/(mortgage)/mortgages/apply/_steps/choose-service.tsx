"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Service } from "@/lib/mortgage-requests/details";
import { applyEntry, type EntryParams, FLOW_PATHS, returnPathFrom, siteLocaleFromReferrer } from "@/lib/mortgage-requests/client/apply-state";
import { useApplyState } from "@/lib/mortgage-requests/client/apply-store";
import { trackMortgage } from "@/lib/mortgage-requests/client/analytics";
import { ServiceCard } from "../../../_components/choices";
import { FlowActions } from "../../../_components/flow-actions";
import { FlowPage, FlowPending } from "../../../_components/flow-page";
import { Divider, NoteRow, RailCard } from "../../../_components/primitives";
import { contactTags } from "../../../_components/rich";
import { FlowHeading } from "../../../_components/steps";

const PHONE = "tel:+97126322223";
const WHATSAPP = "https://wa.me/971506911103";

/**
 * W1 · Choose service. Two cards, one radio group; nothing is selected until
 * the applicant picks one or an entry link did (FE-3). The stepper's last
 * step reads "Submit" for consultancy, "Documents" otherwise, and changes the
 * moment the selection does.
 */
export function ChooseService({ entry }: { entry: EntryParams }) {
  const t = useTranslations("mortgage");
  const router = useRouter();
  const [state, update] = useApplyState();
  const applied = useRef(false);

  // The entry link, read once into the tab's state (W1 "Entry and exit").
  useEffect(() => {
    if (!state || applied.current) return;
    applied.current = true;
    const back = returnPathFrom(document.referrer, window.location.origin);
    const next = applyEntry(state, entry, back ?? state.returnTo, siteLocaleFromReferrer(document.referrer, window.location.origin));
    update(() => next);
    trackMortgage("mortgage_apply_viewed", { step: "service", entry_point: next.entryPoint });
  }, [state, entry, update]);

  if (!state) return <FlowPending />;

  const service = state.service;
  const select = (value: string) => update((s) => ({ ...s, service: value as Service }));
  const next = () => {
    if (!service) return;
    trackMortgage("mortgage_service_selected", { service, entry_point: state.entryPoint });
    router.push(FLOW_PATHS.details);
  };

  const rail = (
    <>
      <RailCard title={t("w1.rail.title")}>
        <div className="text-[13.5px] font-semibold">{t("service.consultancy")}</div>
        <p className="mt-1 text-[13px] leading-[1.55] text-bz-ink-2 text-pretty">{t("w1.rail.consultancy")}</p>
        <Divider className="my-4" />
        <div className="text-[13.5px] font-semibold">{t("service.preApproval")}</div>
        <p className="mt-1 text-[13px] leading-[1.55] text-bz-ink-2 text-pretty">{t("w1.rail.preApproval")}</p>
      </RailCard>
      <RailCard soft>
        <NoteRow glyph="switch" title={t("w1.switch.title")}>
          {t("w1.switch.body")}
        </NoteRow>
      </RailCard>
      <p className="px-1 text-[12.5px] leading-[1.6] text-bz-muted">
        {t.rich("w1.contact", contactTags(PHONE, WHATSAPP))}
      </p>
    </>
  );

  return (
    <FlowPage step={0} last={service === "consultancy" ? "submit" : "documents"} rail={rail}>
      <FlowHeading eyebrow={t("w1.eyebrow")} title={t("w1.title")} lede={t("w1.lede")} />
      <div role="radiogroup" aria-label={t("w1.title")} className="mt-10 grid gap-5 md:grid-cols-2">
        <ServiceCard
          name="service"
          value="consultancy"
          checked={service === "consultancy"}
          onSelect={select}
          title={t("service.consultancy")}
          description={t("w1.consultancy.desc")}
          chip={t("w1.consultancy.chip")}
          chipTone="success"
          needsLabel={t("w1.needsLabel")}
          needs={t("w1.consultancy.needs")}
        />
        <ServiceCard
          name="service"
          value="pre_approval"
          checked={service === "pre_approval"}
          onSelect={select}
          title={t("service.preApproval")}
          description={t("w1.preApproval.desc")}
          chip={t("w1.preApproval.chip")}
          chipTone="accent"
          badge={t("w1.preApproval.badge")}
          needsLabel={t("w1.needsLabel")}
          needs={t("w1.preApproval.needs")}
        />
      </div>
      <FlowActions note={t("w1.note")} noteId="w1-note" cta={t("w1.cta")} arrow disabled={!service} onCta={next} />
    </FlowPage>
  );
}
