"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DETAIL_FIELDS,
  dobRule,
  emailRule,
  firstInvalidField,
  maskDob,
  maskMobile9,
  mobileRule,
  nameRule,
  parseDob,
  validateDetails,
  type DetailField,
  type DetailRule,
  type DetailsDraft,
} from "@/lib/mortgage-requests/details";
import { formatDob } from "@/lib/mortgage-requests/format";
import { FLOW_PATHS } from "@/lib/mortgage-requests/client/apply-state";
import { trackMortgage } from "@/lib/mortgage-requests/client/analytics";
import { ChoiceTile } from "../../../_components/choices";
import { GroupError, TextField } from "../../../_components/fields";
import { FlowActions } from "../../../_components/flow-actions";
import { FlowPage, FlowPending, useGuardedState } from "../../../_components/flow-page";
import { Glyph } from "@/components/mortgage/glyphs";
import { Divider, RailCard } from "../../../_components/primitives";
import { richTags } from "../../../_components/rich";
import { FlowHeading } from "../../../_components/steps";
import { SelectionSummary } from "../../../_components/summary";

type Errors = Partial<Record<DetailField, DetailRule>>;

/** A single field's rule, for checking on blur. */
function ruleFor(field: DetailField, draft: DetailsDraft): DetailRule | null {
  switch (field) {
    case "residency":
      return draft.residency ? null : "required";
    case "employmentType":
      return draft.employmentType ? null : "required";
    case "fullName":
      return nameRule(draft.fullName ?? "");
    case "dateOfBirth":
      return dobRule(draft.dateOfBirth ?? "");
    case "mobile":
      return mobileRule(draft.mobileNational ?? "");
    case "email":
      return emailRule(draft.email ?? "");
  }
}

/**
 * W2 · Personal details. Nothing leaves the browser here, as the rail
 * promises: answers are saved to the tab's storage as they're typed, and
 * checked on blur and again on Continue, which focuses the first field that
 * fails.
 */
export function PersonalDetails({ ltv }: { ltv: { national: number; expat: number } }) {
  const t = useTranslations("mortgage");
  const router = useRouter();
  const [state, update] = useGuardedState("details");
  const [checked, setErrors] = useState<Errors>({});
  const refs = useRef<Partial<Record<DetailField, HTMLInputElement | null>>>({});
  const viewed = useRef(false);

  // A field the server refused at submit comes back marked (W3/W5 "Errors")
  // until the applicant changes it.
  const flagged =
    state?.flagged && (DETAIL_FIELDS as readonly string[]).includes(state.flagged.field)
      ? { field: state.flagged.field as DetailField, rule: (state.flagged.rule || "invalid") as DetailRule }
      : null;
  const errors: Errors = flagged ? { ...checked, [flagged.field]: flagged.rule } : checked;

  useEffect(() => {
    if (!state || viewed.current) return;
    viewed.current = true;
    trackMortgage("mortgage_apply_viewed", { step: "details", service: state.service });
  }, [state]);

  const flaggedField = flagged?.field;
  useEffect(() => {
    if (flaggedField) refs.current[flaggedField]?.focus();
  }, [flaggedField]);

  if (!state) return <FlowPending />;

  const d = state.details;
  const preApproval = state.service === "pre_approval";
  const set = (patch: Partial<DetailsDraft>) => {
    update((s) => ({ ...s, details: { ...s.details, ...patch }, flagged: undefined }));
    // Once a field is fixed, its message goes.
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch) as (keyof DetailsDraft)[]) {
        const field = (key === "mobileNational" ? "mobile" : key) as DetailField;
        if (next[field] && !ruleFor(field, { ...d, ...patch })) delete next[field];
      }
      return next;
    });
  };
  const blur = (field: DetailField) => {
    const rule = ruleFor(field, d);
    setErrors((e) => ({ ...e, [field]: rule ?? undefined }));
    if (rule) trackMortgage("mortgage_details_error", { field, rule });
  };
  const message = (field: DetailField) => {
    const rule = errors[field];
    if (!rule) return undefined;
    const key = `w2.error.${field}.${rule}`;
    // A rule only the server knows (a 422 sent back here) gets the general line.
    return t.has(key) ? t(key) : t("submit.error.details");
  };

  const next = () => {
    const result = validateDetails(d);
    if (!result.ok) {
      setErrors(result.errors);
      for (const [field, rule] of Object.entries(result.errors)) {
        trackMortgage("mortgage_details_error", { field, rule: rule! });
      }
      const first = firstInvalidField(result.errors);
      if (first) refs.current[first]?.focus();
      return;
    }
    trackMortgage("mortgage_details_completed", {
      service: state.service!,
      residency: result.details.residency,
      employment_type: result.details.employmentType,
    });
    router.push(preApproval ? FLOW_PATHS.documents : FLOW_PATHS.review);
  };

  const rail = (
    <RailCard title={t("w2.rail.title")}>
      <div className="text-[13.5px] font-semibold">{t("w2.rail.residency.title")}</div>
      <p className="mt-1 text-[13px] leading-[1.55] text-bz-ink-2">{t("w2.rail.residency.body")}</p>
      <Divider className="my-4" />
      <div className="text-[13.5px] font-semibold">{t("w2.rail.employment.title")}</div>
      <p className="mt-1 text-[13px] leading-[1.55] text-bz-ink-2">{t("w2.rail.employment.body")}</p>
      <div className="mt-5 flex gap-3 rounded-[10px] bg-bz-surface-2 p-4">
        <span className="mt-px text-bz-accent">
          <Glyph name="lock" />
        </span>
        <div>
          <div className="text-[13px] font-semibold">{t("w2.rail.private.title")}</div>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-bz-ink-2">{t("w2.rail.private.body")}</p>
        </div>
      </div>
    </RailCard>
  );

  return (
    <FlowPage step={1} last={preApproval ? "documents" : "submit"} rail={rail}>
      <SelectionSummary
        label={t("selections.label")}
        chips={[preApproval ? t("selections.service.preApproval") : t("selections.service.consultancy")]}
        action={{ label: t("selections.change"), href: FLOW_PATHS.service }}
      />
      <FlowHeading eyebrow={t("w2.eyebrow")} title={t("w2.title")} lede={t("w2.lede")} />

      {flagged ? (
        <div role="alert" className="mt-6 rounded-xl border border-[var(--mrq-danger-row-border)] bg-[var(--mrq-danger-row-bg)] px-4 py-3 text-[13px] text-[var(--mrq-danger-fg)]">
          {t("w2.error.banner")}
        </div>
      ) : null}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        className="ph-no-capture mt-9 flex flex-col gap-7"
      >
        <fieldset>
          <legend className="mb-2.5 text-[13px] font-medium">{t("w2.residency.label")}</legend>
          <div className="grid gap-3 md:grid-cols-2" ref={(el) => void (refs.current.residency = el?.querySelector("input") ?? null)}>
            <ChoiceTile
              name="residency"
              value="uae_national"
              checked={d.residency === "uae_national"}
              onSelect={(v) => set({ residency: v as DetailsDraft["residency"] })}
              title={t("residency.uaeNational.title")}
              sub={t("residency.uaeNational.sub", { ltv: ltv.national })}
              invalid={!!errors.residency}
              describedBy={errors.residency ? "w2-residency-error" : undefined}
            />
            <ChoiceTile
              name="residency"
              value="uae_resident_expat"
              checked={d.residency === "uae_resident_expat"}
              onSelect={(v) => set({ residency: v as DetailsDraft["residency"] })}
              title={t("residency.expat.title")}
              sub={t("residency.expat.sub", { ltv: ltv.expat })}
              invalid={!!errors.residency}
              describedBy={errors.residency ? "w2-residency-error" : undefined}
            />
          </div>
          {errors.residency ? <GroupError id="w2-residency-error">{message("residency")}</GroupError> : null}
        </fieldset>

        <fieldset>
          <legend className="mb-2.5 text-[13px] font-medium">{t("w2.employment.label")}</legend>
          <div className="grid gap-3 md:grid-cols-2" ref={(el) => void (refs.current.employmentType = el?.querySelector("input") ?? null)}>
            <ChoiceTile
              name="employmentType"
              value="salaried"
              checked={d.employmentType === "salaried"}
              onSelect={(v) => set({ employmentType: v as DetailsDraft["employmentType"] })}
              title={t("employment.salaried.title")}
              sub={t("employment.salaried.sub")}
              invalid={!!errors.employmentType}
              describedBy={[preApproval ? "w2-employment-note" : "", errors.employmentType ? "w2-employment-error" : ""].filter(Boolean).join(" ") || undefined}
            />
            <ChoiceTile
              name="employmentType"
              value="business_owner"
              checked={d.employmentType === "business_owner"}
              onSelect={(v) => set({ employmentType: v as DetailsDraft["employmentType"] })}
              title={t("employment.businessOwner.title")}
              sub={t("employment.businessOwner.sub")}
              invalid={!!errors.employmentType}
              describedBy={[preApproval ? "w2-employment-note" : "", errors.employmentType ? "w2-employment-error" : ""].filter(Boolean).join(" ") || undefined}
            />
          </div>
          {errors.employmentType ? (
            <GroupError id="w2-employment-error">{message("employmentType")}</GroupError>
          ) : null}
          {/* The note is about the documents step, which consultancy doesn't have (proposal in W2). */}
          {preApproval ? (
            <p id="w2-employment-note" className="mt-3 flex gap-2.5 text-[13px] leading-[1.5] text-bz-ink-2">
              <span className="mt-px text-bz-accent">
                <Glyph name="doc" />
              </span>
              <span>{t.rich("w2.employment.note", richTags)}</span>
            </p>
          ) : null}
        </fieldset>

        <Divider />

        <div className="grid gap-x-4 gap-y-[22px] md:grid-cols-2">
          <TextField
            ref={(el) => void (refs.current.fullName = el)}
            label={t("field.fullName")}
            name="name"
            autoComplete="name"
            placeholder={t("w2.fullName.placeholder")}
            hint={t("w2.fullName.hint")}
            error={message("fullName")}
            value={d.fullName ?? ""}
            maxLength={120}
            onChange={(e) => set({ fullName: e.target.value })}
            onBlur={() => blur("fullName")}
          />
          <TextField
            ref={(el) => void (refs.current.dateOfBirth = el)}
            label={t("field.dateOfBirth")}
            name="bday"
            autoComplete="bday"
            inputMode="numeric"
            placeholder={t("w2.dateOfBirth.placeholder")}
            error={message("dateOfBirth")}
            value={d.dateOfBirth ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              // Autofill can write an ISO date; show it the way the field does.
              const iso = /^\d{4}-\d{1,2}-\d{1,2}$/.test(raw.trim()) ? parseDob(raw) : null;
              set({ dateOfBirth: iso ? formatDob(iso) : maskDob(raw) });
            }}
            onBlur={() => {
              const iso = parseDob(d.dateOfBirth ?? "");
              if (iso) set({ dateOfBirth: formatDob(iso) });
              blur("dateOfBirth");
            }}
          />
          <TextField
            ref={(el) => void (refs.current.mobile = el)}
            label={t("field.mobile")}
            accessibleLabel={t("w2.mobile.label", { label: t("field.mobile"), prefix: t("w2.mobile.prefix") })}
            prefix={t("w2.mobile.prefix")}
            type="tel"
            name="tel-national"
            autoComplete="tel-national"
            inputMode="tel"
            placeholder={t("w2.mobile.placeholder")}
            error={message("mobile")}
            value={d.mobileNational ?? ""}
            onChange={(e) => set({ mobileNational: maskMobile9(e.target.value) })}
            onBlur={() => blur("mobile")}
          />
          <TextField
            ref={(el) => void (refs.current.email = el)}
            label={t("field.email")}
            type="email"
            name="email"
            autoComplete="email"
            placeholder={t("w2.email.placeholder")}
            error={message("email")}
            value={d.email ?? ""}
            maxLength={254}
            onChange={(e) => set({ email: e.target.value })}
            onBlur={() => blur("email")}
          />
        </div>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>

      <FlowActions
        backHref={FLOW_PATHS.service}
        cta={preApproval ? t("w2.cta.preApproval") : t("w2.cta.consultancy")}
        arrow
        onCta={next}
      />
    </FlowPage>
  );
}
