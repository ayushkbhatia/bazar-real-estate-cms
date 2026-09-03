"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Eye } from "lucide-react";
import { toast } from "sonner";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PROPERTY_TYPES,
  FURNISHINGS,
} from "@/lib/schemas/property";
import {
  UPGRADE_OPTIONS,
  VALUATION_CONDITIONS,
  VALUATION_MORTGAGE_STATES,
  VALUATION_TENANCIES,
  VIEW_OPTIONS,
  valuationStep1Schema,
  valuationStep2Schema,
  valuationStep3Schema,
  valuationStep4Schema,
} from "@/lib/schemas/valuation";
import {
  estimateValuation,
  formatRangeAed,
  type ValuationCondition,
} from "@/lib/valuation";
// The model behind this wizard is calibrated in AED/ft² — `built_up_ft2`
// stays ft² and the estimate stays AED. Inputs convert at the boundary and
// output converts at the point of render; nothing in `lib/valuation.ts` moves.
import {
  areaUnitLabel,
  convertArea,
  convertFromAed,
  currencySymbol,
  formatArea,
  formatPricePerArea,
  formatPricePerAreaValue,
  toFt2,
  usePreferences,
} from "@/lib/preferences";
import type { AreaOption } from "@/lib/queries/areas";
import type { Database } from "@/db/types";
import { submitValuation } from "./_actions";
import { pdfLabel } from "@/lib/pdf/language-note";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/locales";

type Furnishing = Database["public"]["Enums"]["property_furnishing"];
type PropertyType = Database["public"]["Enums"]["property_type"];

/*
 * The enum values ARE the message keys, so five of the six label tables that
 * used to live here are gone: `condition`, `furnishingOption`, `tenancy` and
 * `mortgage` are read straight off the enum with `t(\`valuation.tenancy.${t}\`)`.
 *
 * Property types are not even that — `search.type.*` already carries all
 * eleven, byte-identical, and `search` is on CLIENT_NAMESPACES, so the wizard
 * reads the existing keys rather than adding a twelfth copy of "Penthouse".
 */

/**
 * The two option lists that are their own identity.
 *
 * `UPGRADE_OPTIONS` and `VIEW_OPTIONS` are `z.enum(...)` members in
 * `lib/schemas/valuation.ts`, so the English prose is what the browser submits
 * and what the server validates against — translate the array and every
 * submission fails validation in a language the visitor cannot debug. The
 * stored value stays English; only the label moves.
 *
 * Keyed by the English string rather than by index so reordering the array
 * cannot silently repoint a label, and typed as a total `Record` over the
 * union so adding an option is a compile error until it has a key.
 */
const UPGRADE_KEYS: Record<(typeof UPGRADE_OPTIONS)[number], string> = {
  "Designer kitchen (Boffi / Poliform / etc.)": "designerKitchen",
  "Marble or stone flooring": "stoneFlooring",
  "Smart home wiring": "smartHome",
  "Extended primary suite / dressing room": "extendedSuite",
  "Custom joinery / built-ins": "joinery",
  "AV / cinema room": "cinema",
  "Pool or outdoor terrace upgrades": "outdoor",
  "Bathroom remodels": "bathrooms",
};

const VIEW_KEYS: Record<(typeof VIEW_OPTIONS)[number], string> = {
  "Sea / waterfront": "sea",
  "Skyline / city": "skyline",
  "Park / garden": "park",
  "Community / pool": "community",
  "Partial sea": "partialSea",
};

/** The four steps, in order. The enum value is the message key. */
const STEP_KEYS = [
  "property",
  "specifications",
  "condition",
  "aboutYou",
] as const;

type FormState = {
  // Step 1
  area_id: string;
  address_line: string;
  building_name: string;
  unit_number: string;
  // Step 2
  property_type: PropertyType;
  beds: number;
  baths: number;
  built_up_ft2: number;
  floor: number | null;
  // Step 3
  condition: ValuationCondition | null;
  upgrades: string[];
  furnishing: Furnishing | null;
  view_description: string | null;
  tenancy: (typeof VALUATION_TENANCIES)[number] | null;
  mortgage_state: (typeof VALUATION_MORTGAGE_STATES)[number] | null;
  // Step 4
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  marketing_opt_in: boolean;
};

const DEFAULT_STATE: FormState = {
  area_id: "",
  address_line: "",
  building_name: "",
  unit_number: "",
  property_type: "apartment",
  beds: 3,
  baths: 4,
  built_up_ft2: 2_180,
  floor: 7,
  condition: "renovated",
  upgrades: [],
  furnishing: "unfurnished",
  view_description: "Sea / waterfront",
  tenancy: "vacant",
  mortgage_state: "no",
  owner_name: "",
  owner_email: "",
  owner_phone: "",
  marketing_opt_in: false,
};

const STEP_SCHEMAS = [
  valuationStep1Schema,
  valuationStep2Schema,
  valuationStep3Schema,
  valuationStep4Schema,
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{message}</span>
  );
}

export function ValuationWizard({ areas }: { areas: AreaOption[] }) {
  const t = useTranslations("tools");
  // The eleven property-type labels already exist in `search.type.*`,
  // byte-identical, and `search` is on CLIENT_NAMESPACES. Reusing them beats a
  // twelfth copy of "Penthouse" that can drift from the other eleven.
  const types = useTranslations("search");
  const { prefs } = usePreferences();
  const [state, setState] = useState<FormState>(DEFAULT_STATE);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState<{
    id: string | null;
    lowAed: number;
    midAed: number;
    highAed: number;
  } | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const areaSlug = useMemo(() => {
    const a = areas.find((x) => x.id === state.area_id);
    return a?.slug ?? null;
  }, [areas, state.area_id]);

  const estimate = useMemo(
    () =>
      estimateValuation({
        areaSlug,
        propertyType: state.property_type,
        beds: state.beds,
        baths: state.baths,
        builtUpFt2: state.built_up_ft2,
        floor: state.floor,
        condition: state.condition,
        upgrades: state.upgrades,
        furnishing: state.furnishing,
        view: state.view_description,
      }),
    [areaSlug, state],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  };

  const validateStep = (s: number): boolean => {
    const result = STEP_SCHEMAS[s].safeParse(state);
    if (result.success) {
      setErrors({});
      return true;
    }
    const errs: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !errs[k]) errs[k] = issue.message;
    }
    setErrors(errs);
    return false;
  };

  const onNext = () => {
    if (!validateStep(step)) return;
    if (step < 3) setStep(((step as number) + 1) as 0 | 1 | 2 | 3);
  };

  const onSubmit = () => {
    if (!validateStep(3)) return;
    setSubmissionError(null);
    startTransition(async () => {
      const result = await submitValuation({
        ...state,
        // Server expects null over "" for optional fields
        area_id: state.area_id || null,
      });
      if (result.status === "ok") {
        // result.estimate may be null if the heuristic couldn't run;
        // we keep a Submitted shape regardless so the confirmation
        // screen always renders.
        setSubmitted({
          id: result.id ?? null,
          lowAed: result.estimate?.lowAed ?? 0,
          midAed: result.estimate?.midAed ?? 0,
          highAed: result.estimate?.highAed ?? 0,
        });
        toast.success(t("valuation.received"));
      } else {
        setSubmissionError(result.message);
        if (result.fieldErrors) setErrors(result.fieldErrors);
      }
    });
  };

  if (submitted) {
    return (
      <SubmittedConfirmation
        ownerName={state.owner_name}
        ownerEmail={state.owner_email}
        estimate={submitted}
        valuationId={submitted.id}
      />
    );
  }

  return (
    <section className="px-4 md:px-12 pb-12 md:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-14 items-start [&>*]:min-w-0">
      <div>
        <ProgressStrip current={step} />

        {/* Collapsed previous steps */}
        {step > 0 ? (
          <CollapsedStep
            n="01"
            label={t("valuation.step.property")}
            summary={[
              areas.find((a) => a.id === state.area_id)?.name ??
                t("valuation.areaUnset"),
              state.building_name,
              state.unit_number ? `· ${state.unit_number}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            onEdit={() => setStep(0)}
          />
        ) : null}
        {step > 1 ? (
          <CollapsedStep
            n="02"
            label={t("valuation.step.specifications")}
            summary={[
              types(`type.${state.property_type}`),
              t("valuation.bedsShort", { count: state.beds }),
              t("valuation.bathsLong", { count: state.baths }),
              formatArea(state.built_up_ft2, prefs),
              state.floor != null
                ? t("valuation.floor", { n: state.floor })
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            onEdit={() => setStep(1)}
          />
        ) : null}
        {step > 2 ? (
          <CollapsedStep
            n="03"
            label={t("valuation.step.condition")}
            summary={
              state.condition
                ? t(`valuation.condition.${state.condition}`) +
                  (state.upgrades.length > 0
                    ? ` · ${t("valuation.upgradeCount", { count: state.upgrades.length })}`
                    : "")
                : "—"
            }
            onEdit={() => setStep(2)}
          />
        ) : null}

        <div className="border border-bz-ink rounded-lg p-6 md:p-7 mt-2" style={{ borderWidth: 1.5 }}>
          <div className="flex justify-between items-center">
            <div>
              <Eyebrow>
                {t("valuation.stepEyebrow", {
                  n: String(step + 1).padStart(2, "0"),
                })}
              </Eyebrow>
              <h2
                className="serif text-[28px] mt-1.5"
                style={{ letterSpacing: "-0.02em" }}
              >
                {t(`valuation.step.${STEP_KEYS[step]}`)}
              </h2>
            </div>
            <span className="mono text-[11px] text-bz-muted">
              {t("valuation.stepCounter", { n: step + 1 })}
            </span>
          </div>

          {step === 0 ? (
            <Step1
              state={state}
              update={update}
              errors={errors}
              areas={areas}
            />
          ) : null}
          {step === 1 ? (
            <Step2 state={state} update={update} errors={errors} />
          ) : null}
          {step === 2 ? <Step3 state={state} update={update} /> : null}
          {step === 3 ? (
            <Step4 state={state} update={update} errors={errors} />
          ) : null}

          {submissionError ? (
            <p className="mt-4 text-[13px] text-[oklch(0.45_0.13_28)]">
              {submissionError}
            </p>
          ) : null}

          <div className="flex justify-between items-center mt-7 pt-6 border-t border-bz-border">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2 | 3) : s))}
              disabled={step === 0 || pending}
            >
              <ArrowLeft size={14} strokeWidth={1.6} />
              {t("valuation.back")}
            </Button>
            {step < 3 ? (
              <Button onClick={onNext}>
                {/*
                  One key for the button and one for the heading, both reading
                  `valuation.step.*`. e2e/tools-valuation.spec.ts asserts
                  `/Continue · Specifications/i` on the button and
                  `/^Specifications$/i` on the heading of the step it lands on,
                  so the two have to be the same string — which they are,
                  because there is only one.
                */}
                {t("valuation.continueTo", {
                  step: t(`valuation.step.${STEP_KEYS[step + 1]}`),
                })}
                <ArrowRight size={14} strokeWidth={1.6} />
              </Button>
            ) : (
              <Button onClick={onSubmit} disabled={pending}>
                {pending ? t("valuation.sending") : t("valuation.submit")}
                <ArrowRight size={14} strokeWidth={1.6} />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 p-4 bg-bz-surface-2 rounded-lg text-[12.5px] text-bz-ink-2 flex gap-3 items-start">
          <Eye size={14} strokeWidth={1.6} className="text-bz-muted mt-0.5" />
          <p>
            <strong className="text-bz-ink">{t("valuation.privacyLead")}</strong>{" "}
            {t("valuation.privacyBody")}
          </p>
        </div>
      </div>

      <aside className="lg:sticky lg:top-6">
        <LivePreview state={state} areas={areas} estimate={estimate} />
      </aside>
    </section>
  );
}

/* ─── Steps ─────────────────────────────────────────────────── */

function Step1({
  state,
  update,
  errors,
  areas,
}: {
  state: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  errors: Record<string, string>;
  areas: AreaOption[];
}) {
  const t = useTranslations("tools");
  return (
    <div className="mt-5 flex flex-col gap-4">
      <p className="text-[13.5px] text-bz-ink-2 leading-relaxed">
        {t("valuation.step1Intro")}
      </p>
      <fieldset>
        <Label htmlFor="area">{t("valuation.area")}</Label>
        <Select
          value={state.area_id || "__none__"}
          onValueChange={(v) => update("area_id", v === "__none__" ? "" : v)}
        >
          <SelectTrigger id="area" className="mt-1.5 w-full">
            <SelectValue placeholder={t("valuation.areaPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t("valuation.areaOther")}</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors.area_id} />
      </fieldset>
      <fieldset>
        <Label htmlFor="building">{t("valuation.building")}</Label>
        <Input
          id="building"
          className="mt-1.5"
          value={state.building_name}
          onChange={(e) => update("building_name", e.target.value)}
          placeholder={t("valuation.buildingPlaceholder")}
        />
      </fieldset>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <fieldset>
          <Label htmlFor="address">{t("valuation.addressLine")}</Label>
          <Input
            id="address"
            className="mt-1.5"
            value={state.address_line}
            onChange={(e) => update("address_line", e.target.value)}
            placeholder={t("valuation.addressPlaceholder")}
          />
        </fieldset>
        <fieldset>
          <Label htmlFor="unit">{t("valuation.unit")}</Label>
          <Input
            id="unit"
            className="mt-1.5"
            value={state.unit_number}
            onChange={(e) => update("unit_number", e.target.value)}
            placeholder={t("valuation.unitPlaceholder")}
          />
        </fieldset>
      </div>
    </div>
  );
}

function Step2({
  state,
  update,
  errors,
}: {
  state: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  errors: Record<string, string>;
}) {
  const t = useTranslations("tools");
  const types = useTranslations("search");
  const { prefs } = usePreferences();
  return (
    <div className="mt-5 flex flex-col gap-4">
      <fieldset>
        <Label htmlFor="property_type">{t("valuation.propertyType")}</Label>
        <Select
          value={state.property_type}
          onValueChange={(v) => update("property_type", v as PropertyType)}
        >
          <SelectTrigger id="property_type" className="mt-1.5 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map((pt) => (
              <SelectItem key={pt} value={pt}>
                {types(`type.${pt}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </fieldset>
      {/*
        Two across below `sm` — the only grid in this wizard that was still
        mobile-blind. At 390px the card's 310px interior split three ways
        leaves 95px tracks, and "Floor (optional)" measures ~112px at the
        Label's 14px: it wrapped, and its input then sat a line lower than the
        beds and baths inputs beside it.
      */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <fieldset>
          <Label htmlFor="beds">{t("valuation.bedrooms")}</Label>
          <Input
            id="beds"
            className="mt-1.5"
            inputMode="numeric"
            value={state.beds}
            onChange={(e) => update("beds", Number(e.target.value) || 0)}
          />
          <FieldError message={errors.beds} />
        </fieldset>
        <fieldset>
          <Label htmlFor="baths">{t("valuation.bathrooms")}</Label>
          <Input
            id="baths"
            className="mt-1.5"
            inputMode="numeric"
            value={state.baths}
            onChange={(e) => update("baths", Number(e.target.value) || 0)}
          />
          <FieldError message={errors.baths} />
        </fieldset>
        <fieldset>
          <Label htmlFor="floor">{t("valuation.floorOptional")}</Label>
          <Input
            id="floor"
            className="mt-1.5"
            inputMode="numeric"
            value={state.floor ?? ""}
            onChange={(e) =>
              update(
                "floor",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </fieldset>
      </div>
      <fieldset>
        <Label htmlFor="built_up">
          {t("valuation.builtUp", { unit: areaUnitLabel(prefs) })}
        </Label>
        <Input
          id="built_up"
          className="mt-1.5 mono"
          inputMode="numeric"
          value={Math.round(
            convertArea(state.built_up_ft2, prefs.area_unit),
          ).toLocaleString("en-US")}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9]/g, "");
            update(
              "built_up_ft2",
              Math.round(toFt2(Number(cleaned) || 0, prefs.area_unit)),
            );
          }}
        />
        <FieldError message={errors.built_up_ft2} />
      </fieldset>
    </div>
  );
}

function Step3({
  state,
  update,
}: {
  state: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const t = useTranslations("tools");
  return (
    <div className="mt-5 flex flex-col gap-5">
      <p className="text-[13.5px] text-bz-ink-2 leading-relaxed">
        {t("valuation.step3Intro")}
      </p>

      <fieldset>
        <Label>{t("valuation.overallCondition")}</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
          {VALUATION_CONDITIONS.map((c) => {
            const active = state.condition === c;
            return (
              <button
                type="button"
                key={c}
                onClick={() => update("condition", c)}
                aria-pressed={active}
                className={cn(
                  "h-11 px-2 rounded text-[12.5px] border transition-colors text-center",
                  active
                    ? "bg-bz-navy text-bz-bg border-bz-navy"
                    : "bg-bz-surface-2 text-bz-ink-2 border-transparent hover:border-bz-border-strong",
                )}
              >
                {t(`valuation.condition.${c}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <Label>{t("valuation.upgradesLabel")}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
          {UPGRADE_OPTIONS.map((u) => {
            const checked = state.upgrades.includes(u);
            return (
              <label
                key={u}
                className={cn(
                  // `py-2.5` around a 12.5px line is a ~38px row, and the
                  // painted border makes that row look like the target it
                  // isn't. `min-h-11` lifts the whole card to 44 on the phone;
                  // `md:min-h-0` leaves the desktop grid at today's height.
                  "flex items-center gap-2.5 px-3 py-2.5 min-h-11 md:min-h-0 border rounded text-[12.5px] cursor-pointer",
                  checked
                    ? "bg-bz-surface-2 border-bz-border-strong"
                    : "bg-bz-surface border-bz-border hover:border-bz-border-strong",
                )}
              >
                <input
                  type="checkbox"
                  /* The UA paints this at ~13px. `size-5` is the box itself;
                     the label above is the 44px hit area, and both are needed
                     — a 20px control in a 20px row still fails 2.5.5. */
                  className="size-5 md:size-auto shrink-0"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...state.upgrades, u]
                      : state.upgrades.filter((x) => x !== u);
                    update("upgrades", next);
                  }}
                />
                {/* The English `u` is the submitted value; only the label moves. */}
                <span>{t(`valuation.upgrade.${UPGRADE_KEYS[u]}`)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <Label>{t("valuation.furnishing")}</Label>
        <div
          className="flex gap-1.5 mt-2"
          role="radiogroup"
          aria-label={t("valuation.furnishing")}
        >
          {FURNISHINGS.map((f) => {
            const active = state.furnishing === f;
            return (
              <button
                type="button"
                key={f}
                onClick={() => update("furnishing", f)}
                aria-checked={active}
                role="radio"
                className={cn(
                  // 36px. `flex-1` already guarantees the width (three of
                  // them across the card), so height was the only failing
                  // axis; `md:h-9` is the row exactly as drawn today.
                  "flex-1 h-11 md:h-9 rounded text-[12.5px] border transition-colors",
                  active
                    ? "bg-bz-navy text-bz-bg border-bz-navy"
                    : "bg-bz-surface-2 text-bz-ink-2 border-transparent hover:border-bz-border-strong",
                )}
              >
                {t(`valuation.furnishingOption.${f}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <Label>{t("valuation.view")}</Label>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {VIEW_OPTIONS.map((v) => {
            const active = state.view_description === v;
            return (
              <button
                type="button"
                key={v}
                onClick={() => update("view_description", active ? null : v)}
                aria-pressed={active}
                className={cn(
                  // 36px chips in a wrapping row. Height only: the shortest
                  // view label plus `px-3` still clears 44 across, and these
                  // toggle off on a second tap, so a miss changes the
                  // valuation input rather than just failing to.
                  "h-11 md:h-9 px-3 rounded text-[12px] border transition-colors",
                  active
                    ? "bg-bz-accent text-bz-accent-fg border-bz-accent"
                    : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
                )}
              >
                {t(`valuation.viewOption.${VIEW_KEYS[v]}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <fieldset>
          <Label htmlFor="tenancy">{t("valuation.tenancyLabel")}</Label>
          <Select
            value={state.tenancy ?? "vacant"}
            onValueChange={(v) =>
              update("tenancy", v as (typeof VALUATION_TENANCIES)[number])
            }
          >
            <SelectTrigger id="tenancy" className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VALUATION_TENANCIES.map((v) => (
                <SelectItem key={v} value={v}>
                  {t(`valuation.tenancy.${v}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>
        <fieldset>
          <Label htmlFor="mortgage">{t("valuation.mortgageLabel")}</Label>
          <Select
            value={state.mortgage_state ?? "no"}
            onValueChange={(v) =>
              update(
                "mortgage_state",
                v as (typeof VALUATION_MORTGAGE_STATES)[number],
              )
            }
          >
            <SelectTrigger id="mortgage" className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VALUATION_MORTGAGE_STATES.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(`valuation.mortgage.${m}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>
      </div>
    </div>
  );
}

function Step4({
  state,
  update,
  errors,
}: {
  state: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  errors: Record<string, string>;
}) {
  const t = useTranslations("tools");
  return (
    <div className="mt-5 flex flex-col gap-4">
      <p className="text-[13.5px] text-bz-ink-2 leading-relaxed">
        {t("valuation.step4Intro")}
      </p>
      <fieldset>
        <Label htmlFor="owner_name">{t("valuation.fullName")}</Label>
        <Input
          id="owner_name"
          className="mt-1.5"
          autoComplete="name"
          value={state.owner_name}
          onChange={(e) => update("owner_name", e.target.value)}
        />
        <FieldError message={errors.owner_name} />
      </fieldset>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <fieldset>
          <Label htmlFor="owner_email">{t("valuation.email")}</Label>
          <Input
            id="owner_email"
            type="email"
            className="mt-1.5"
            autoComplete="email"
            value={state.owner_email}
            onChange={(e) => update("owner_email", e.target.value)}
          />
          <FieldError message={errors.owner_email} />
        </fieldset>
        <fieldset>
          <Label htmlFor="owner_phone">{t("valuation.phone")}</Label>
          <Input
            id="owner_phone"
            className="mt-1.5"
            autoComplete="tel"
            value={state.owner_phone}
            onChange={(e) => update("owner_phone", e.target.value)}
            placeholder={t("valuation.phonePlaceholder")}
          />
          <FieldError message={errors.owner_phone} />
        </fieldset>
      </div>
      {/* Consent, so the tap has to land where the owner meant it to: `size-5`
          on the ~13px UA box, `min-h-11` on the label so the sentence is part
          of the target. Both restored above `md`. */}
      <label className="flex items-center gap-2.5 min-h-11 md:min-h-0 text-[12.5px] text-bz-ink-2 cursor-pointer mt-1">
        <input
          type="checkbox"
          className="size-5 md:size-auto shrink-0"
          checked={state.marketing_opt_in}
          onChange={(e) => update("marketing_opt_in", e.target.checked)}
        />
        {t("valuation.marketingOptIn")}
      </label>
    </div>
  );
}

/* ─── Visual chrome ─────────────────────────────────────────── */

function ProgressStrip({ current }: { current: number }) {
  const t = useTranslations("tools");
  return (
    // Two rows of two below `md`. Four `flex-1` steps across 358px gives each
    // label ~82px, and "Condition & upgrades" then breaks over three lines
    // while "Specifications" claims its min-content and starves the rest —
    // the strip reads as a paragraph, not as progress. It never overflowed
    // (the four min-contents sum to ~324px), so `e2e/mobile-geometry` was
    // right not to flag it; it is simply unreadable at phone width.
    //
    // `basis` rather than `flex-1` because the two would fight: Tailwind
    // emits the `flex` shorthand after `flex-basis`, so `flex-1` would reset
    // the basis back to 0 and nothing would wrap. `md:flex-nowrap` pins the
    // desktop line to exactly today's behaviour.
    <div
      className="flex flex-wrap md:flex-nowrap gap-1 mb-7"
      data-testid="progress-strip"
    >
      {STEP_KEYS.map((key, i) => {
        const label = t(`valuation.step.${key}`);
        const state =
          i < current ? "done" : i === current ? "current" : "pending";
        return (
          <div
            key={key}
            className={cn(
              "grow basis-[calc(50%-2px)] md:basis-0 pb-3 border-b-2",
              state === "pending" ? "border-bz-border" : "border-bz-navy",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "mono text-[10.5px]",
                  state === "pending"
                    ? "text-bz-muted-2"
                    : "text-bz-navy",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "text-[12.5px]",
                  state === "pending"
                    ? "text-bz-muted"
                    : "text-bz-navy",
                  state === "current" && "font-semibold",
                )}
              >
                {label}
              </span>
              {state === "done" ? (
                <Check
                  size={14}
                  strokeWidth={2}
                  className="ms-auto text-bz-success"
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CollapsedStep({
  n,
  label,
  summary,
  onEdit,
}: {
  n: string;
  label: string;
  summary: string;
  onEdit: () => void;
}) {
  const t = useTranslations("tools");
  return (
    <div className="mb-2 flex justify-between items-center px-5 py-3.5 bg-bz-surface border border-bz-border rounded-lg">
      <div>
        <Eyebrow>{t("valuation.stepCollapsed", { n, label })}</Eyebrow>
        <div className="text-[13px] mt-1">{summary}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        {t("valuation.edit")}
      </Button>
    </div>
  );
}

function LivePreview({
  state,
  areas,
  estimate,
}: {
  state: FormState;
  areas: AreaOption[];
  estimate: ReturnType<typeof estimateValuation>;
}) {
  const t = useTranslations("tools");
  const { prefs } = usePreferences();
  const rangeValue = (aed: number) =>
    formatRangeAed(convertFromAed(aed, prefs.currency));
  const area = areas.find((a) => a.id === state.area_id);
  const propertyLine = [
    state.building_name || area?.name || t("valuation.propertyFallback"),
    state.unit_number,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      className="bg-bz-surface border border-bz-border rounded-lg overflow-hidden"
      data-testid="live-preview"
    >
      <div className="px-6 py-5 bg-bz-ink text-white flex justify-between items-center">
        <div>
          <Eyebrow className="text-white/70">
            {t("valuation.livePreview")}
          </Eyebrow>
          <div className="serif text-[18px] mt-0.5">
            {t("valuation.reportTitle")}
          </div>
        </div>
        {estimate ? (
          <div className="mono text-[10.5px] text-white/70">
            {t("valuation.rangeBadge", {
              pct: Math.round(estimate.basis.rangeFraction * 100),
              confidence: t(
                `valuation.confidence.${estimate.basis.confidence}`,
              ),
            })}
          </div>
        ) : null}
      </div>
      <div className="p-6">
        <div className="text-[13px] font-medium">{propertyLine}</div>
        {/*
          A middot-separated spec list, built part by part rather than from one
          message with three placeholders — because each count needs its own
          plural and `refuse()` rightly rejects a plural buried inside a
          sentence. English is invariant here ("3 bed", not "3 beds") because
          the line abbreviates; Arabic gets all six categories, which is the
          difference between "3 غرف نوم" and the "3 غرفة نوم" this rendered
          before.
        */}
        <div className="text-[11.5px] text-bz-muted mt-0.5">
          {[
            t("valuation.bedsShort", { count: state.beds }),
            t("valuation.bathsShort", { count: state.baths }),
            formatArea(state.built_up_ft2, prefs),
            state.floor != null
              ? t("valuation.floor", { n: state.floor })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>

        <div className="mt-6">
          <Eyebrow>
            {t("valuation.estimatedValue", {
              symbol: currencySymbol(prefs),
            })}
          </Eyebrow>
          {estimate ? (
            <>
              <div
                className="serif text-[30px] md:text-[44px] mt-1.5 text-bz-navy"
                style={{ letterSpacing: "-0.025em" }}
                data-testid="preview-range"
              >
                {rangeValue(estimate.lowAed)} – {rangeValue(estimate.highAed)}
              </div>
              <div className="text-[12px] text-bz-muted mt-1">
                {t("valuation.midpoint")}{" "}
                <span className="text-bz-navy font-medium">
                  {currencySymbol(prefs)} {rangeValue(estimate.midAed)}
                </span>{" "}
                · {formatPricePerArea(estimate.pricePerFt2Used, prefs)}
              </div>
            </>
          ) : (
            <div className="text-[13px] text-bz-muted mt-2">
              {t("valuation.needArea")}
            </div>
          )}
        </div>

        <div className="border-t border-bz-border my-6" />

        <div>
          <Eyebrow>{t("valuation.basisHeading")}</Eyebrow>
          <ul className="mt-3 flex flex-col gap-2 text-[12px] text-bz-ink-2">
            <li className="flex justify-between">
              <span>
                {t("valuation.basisBaseline", {
                  symbol: currencySymbol(prefs),
                  unit: areaUnitLabel(prefs),
                })}
              </span>
              <span className="mono">
                {estimate
                  ? formatPricePerAreaValue(estimate.basis.baselinePpf, prefs)
                  : "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>{t("valuation.basisCondition")}</span>
              <span className="mono">
                {estimate
                  ? `× ${estimate.basis.multipliers.condition.toFixed(2)}`
                  : "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>{t("valuation.basisView")}</span>
              <span className="mono">
                {estimate
                  ? `× ${estimate.basis.multipliers.view.toFixed(2)}`
                  : "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>{t("valuation.basisUpgrades")}</span>
              <span className="mono">
                {estimate
                  ? `× ${estimate.basis.multipliers.upgrades.toFixed(2)}`
                  : "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>{t("valuation.basisFurnishing")}</span>
              <span className="mono">
                {estimate
                  ? `× ${estimate.basis.multipliers.furnishing.toFixed(2)}`
                  : "—"}
              </span>
            </li>
            {estimate &&
            estimate.basis.multipliers.floor !== 1 ? (
              <li className="flex justify-between">
                <span>{t("valuation.basisFloor")}</span>
                <span className="mono">
                  × {estimate.basis.multipliers.floor.toFixed(2)}
                </span>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="border-t border-bz-border my-6" />

        <div className="flex gap-3">
          <div className="w-9 h-9 rounded-full bg-bz-surface-3 text-bz-ink flex items-center justify-center text-[11px] font-medium">
            MA
          </div>
          <div className="flex-1">
            <Eyebrow>{t("valuation.advisorPending")}</Eyebrow>
            <p className="text-[13px] mt-1 leading-relaxed">
              {t("valuation.advisorNote")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubmittedConfirmation({
  ownerName,
  ownerEmail,
  estimate,
  valuationId,
}: {
  ownerName: string;
  ownerEmail: string;
  estimate: { lowAed: number; midAed: number; highAed: number } | null;
  valuationId: string | null;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("tools");
  const { prefs } = usePreferences();
  const rangeValue = (aed: number) =>
    formatRangeAed(convertFromAed(aed, prefs.currency));
  return (
    <section
      className="px-4 md:px-12 pb-12 md:pb-24"
      data-testid="valuation-confirmation"
    >
      <div className="max-w-[640px] bg-bz-accent-soft rounded-xl p-6 md:p-10">
        <Eyebrow className="text-bz-accent">
          {t("valuation.thankYou", { name: ownerName })}
        </Eyebrow>
        <h2
          className="serif text-[28px] md:text-[36px] mt-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          {t("valuation.inReview")}
        </h2>
        {/*
          The email used to sit in its own <strong>, which meant the sentence
          was three JSX children and the Arabic could not move the address to
          where the clause wants it. One message, one placeholder.
        */}
        <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed">
          {t("valuation.confirmationBody", { email: ownerEmail })}
        </p>
        {estimate ? (
          <div className="mt-6 px-5 py-4 bg-white rounded-lg border border-bz-border">
            <Eyebrow>{t("valuation.instantRange")}</Eyebrow>
            <div
              className="serif text-[28px] md:text-[40px] mt-1 text-bz-navy"
              style={{ letterSpacing: "-0.025em" }}
              data-testid="confirmation-range"
            >
              {rangeValue(estimate.lowAed)} – {rangeValue(estimate.highAed)}
            </div>
            <div className="text-[12.5px] text-bz-muted mt-1">
              {t("valuation.confirmationMidpoint", {
                symbol: currencySymbol(prefs),
                value: rangeValue(estimate.midAed),
              })}
            </div>
            {valuationId ? (
              <a
                href={`/api/pdf/valuation/${valuationId}`}
                /* An <a> drawn as a button, so the globals.css floor — which
                   keys off `data-slot`, not appearance — never touched it.
                   36px, and it is the whole payoff of the wizard. */
                className="mt-5 inline-flex items-center gap-1.5 h-11 md:h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[13px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
              >
                {pdfLabel(t("valuation.downloadPdf"), locale)}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
