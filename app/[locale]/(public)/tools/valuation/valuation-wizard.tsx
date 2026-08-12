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
import { useLocale } from "next-intl";
import type { Locale } from "@/lib/i18n/locales";

type Furnishing = Database["public"]["Enums"]["property_furnishing"];
type PropertyType = Database["public"]["Enums"]["property_type"];

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Apartment",
  villa: "Villa",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  commercial: "Commercial",
  land: "Land",
  hotel_apartment: "Hotel apartment",
  office: "Office",
  building: "Building",
  retail: "Retail",
  commercial_villa: "Commercial villa",
};

const FURNISHING_LABELS: Record<Furnishing, string> = {
  unfurnished: "Unfurnished",
  semi: "Semi-furnished",
  fully: "Fully furnished",
};

const CONDITION_LABELS: Record<ValuationCondition, string> = {
  original: "Original",
  lightly_refreshed: "Lightly refreshed",
  renovated: "Renovated",
  fully_renovated: "Fully renovated",
};

const TENANCY_LABELS: Record<(typeof VALUATION_TENANCIES)[number], string> = {
  vacant: "Vacant",
  rented_le_6mo: "Rented · expires within 6 mo",
  rented_gt_6mo: "Rented · expires > 6 mo",
};

const MORTGAGE_LABELS: Record<
  (typeof VALUATION_MORTGAGE_STATES)[number],
  string
> = {
  no: "No",
  yes_partial: "Yes — partial",
};

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

const STEP_LABELS = [
  "Property",
  "Specifications",
  "Condition & upgrades",
  "About you",
];

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
        toast.success("Valuation request received.");
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
            label="Property"
            summary={[
              areas.find((a) => a.id === state.area_id)?.name ??
                "Area not specified",
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
            label="Specifications"
            summary={`${PROPERTY_TYPE_LABELS[state.property_type]} · ${state.beds} bed · ${state.baths} bath · ${formatArea(state.built_up_ft2, prefs.area_unit)}${
              state.floor != null ? ` · Floor ${state.floor}` : ""
            }`}
            onEdit={() => setStep(1)}
          />
        ) : null}
        {step > 2 ? (
          <CollapsedStep
            n="03"
            label="Condition & upgrades"
            summary={
              state.condition
                ? CONDITION_LABELS[state.condition] +
                  (state.upgrades.length > 0
                    ? ` · ${state.upgrades.length} upgrade${state.upgrades.length === 1 ? "" : "s"}`
                    : "")
                : "—"
            }
            onEdit={() => setStep(2)}
          />
        ) : null}

        <div className="border border-bz-ink rounded-lg p-6 md:p-7 mt-2" style={{ borderWidth: 1.5 }}>
          <div className="flex justify-between items-center">
            <div>
              <Eyebrow>Step {String(step + 1).padStart(2, "0")} of 04</Eyebrow>
              <h2
                className="serif text-[28px] mt-1.5"
                style={{ letterSpacing: "-0.02em" }}
              >
                {STEP_LABELS[step]}
              </h2>
            </div>
            <span className="mono text-[11px] text-bz-muted">
              Step {step + 1} / 4
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
              Back
            </Button>
            {step < 3 ? (
              <Button onClick={onNext}>
                Continue · {STEP_LABELS[step + 1]}
                <ArrowRight size={14} strokeWidth={1.6} />
              </Button>
            ) : (
              <Button onClick={onSubmit} disabled={pending}>
                {pending ? "Sending…" : "Send for review"}
                <ArrowRight size={14} strokeWidth={1.6} />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 p-4 bg-bz-surface-2 rounded-lg text-[12.5px] text-bz-ink-2 flex gap-3 items-start">
          <Eye size={14} strokeWidth={1.6} className="text-bz-muted mt-0.5" />
          <p>
            <strong className="text-bz-ink">Your details stay private.</strong>{" "}
            We use the property address only to match comparable transactions.
            We never publish or list it without your written go-ahead.
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
  return (
    <div className="mt-5 flex flex-col gap-4">
      <p className="text-[13.5px] text-bz-ink-2 leading-relaxed">
        Where is the property? You can change the address and building
        below; we only use them to match comparable transactions.
      </p>
      <fieldset>
        <Label htmlFor="area">Area</Label>
        <Select
          value={state.area_id || "__none__"}
          onValueChange={(v) => update("area_id", v === "__none__" ? "" : v)}
        >
          <SelectTrigger id="area" className="mt-1.5 w-full">
            <SelectValue placeholder="Pick an area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Other / not listed</SelectItem>
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
        <Label htmlFor="building">Building / development</Label>
        <Input
          id="building"
          className="mt-1.5"
          value={state.building_name}
          onChange={(e) => update("building_name", e.target.value)}
          placeholder="e.g. Mamsha Al Saadiyat"
        />
      </fieldset>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <fieldset>
          <Label htmlFor="address">Address line (optional)</Label>
          <Input
            id="address"
            className="mt-1.5"
            value={state.address_line}
            onChange={(e) => update("address_line", e.target.value)}
            placeholder="Plot, street, neighbourhood"
          />
        </fieldset>
        <fieldset>
          <Label htmlFor="unit">Unit (optional)</Label>
          <Input
            id="unit"
            className="mt-1.5"
            value={state.unit_number}
            onChange={(e) => update("unit_number", e.target.value)}
            placeholder="e.g. 704"
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
  const { prefs } = usePreferences();
  return (
    <div className="mt-5 flex flex-col gap-4">
      <fieldset>
        <Label htmlFor="property_type">Property type</Label>
        <Select
          value={state.property_type}
          onValueChange={(v) => update("property_type", v as PropertyType)}
        >
          <SelectTrigger id="property_type" className="mt-1.5 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {PROPERTY_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </fieldset>
      <div className="grid grid-cols-3 gap-3">
        <fieldset>
          <Label htmlFor="beds">Bedrooms</Label>
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
          <Label htmlFor="baths">Bathrooms</Label>
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
          <Label htmlFor="floor">Floor (optional)</Label>
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
          Built-up area · {areaUnitLabel(prefs.area_unit)}
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
  return (
    <div className="mt-5 flex flex-col gap-5">
      <p className="text-[13.5px] text-bz-ink-2 leading-relaxed">
        The more you tell us, the tighter the range.
      </p>

      <fieldset>
        <Label>Overall condition</Label>
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
                {CONDITION_LABELS[c]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <Label>Renovation / upgrades · select all that apply</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
          {UPGRADE_OPTIONS.map((u) => {
            const checked = state.upgrades.includes(u);
            return (
              <label
                key={u}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 border rounded text-[12.5px] cursor-pointer",
                  checked
                    ? "bg-bz-surface-2 border-bz-border-strong"
                    : "bg-bz-surface border-bz-border hover:border-bz-border-strong",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...state.upgrades, u]
                      : state.upgrades.filter((x) => x !== u);
                    update("upgrades", next);
                  }}
                />
                <span>{u}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <Label>Furnishing</Label>
        <div className="flex gap-1.5 mt-2" role="radiogroup" aria-label="Furnishing">
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
                  "flex-1 h-9 rounded text-[12.5px] border transition-colors",
                  active
                    ? "bg-bz-navy text-bz-bg border-bz-navy"
                    : "bg-bz-surface-2 text-bz-ink-2 border-transparent hover:border-bz-border-strong",
                )}
              >
                {FURNISHING_LABELS[f]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <Label>View</Label>
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
                  "h-9 px-3 rounded text-[12px] border transition-colors",
                  active
                    ? "bg-bz-accent text-bz-accent-fg border-bz-accent"
                    : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
                )}
              >
                {v}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <fieldset>
          <Label htmlFor="tenancy">Currently rented?</Label>
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
              {VALUATION_TENANCIES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TENANCY_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>
        <fieldset>
          <Label htmlFor="mortgage">Mortgaged?</Label>
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
                  {MORTGAGE_LABELS[m]}
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
  return (
    <div className="mt-5 flex flex-col gap-4">
      <p className="text-[13.5px] text-bz-ink-2 leading-relaxed">
        Where should we send the report? A senior advisor will review your
        details and email you a refined number within 24 hours.
      </p>
      <fieldset>
        <Label htmlFor="owner_name">Full name</Label>
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
          <Label htmlFor="owner_email">Email</Label>
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
          <Label htmlFor="owner_phone">Phone (optional)</Label>
          <Input
            id="owner_phone"
            className="mt-1.5"
            autoComplete="tel"
            value={state.owner_phone}
            onChange={(e) => update("owner_phone", e.target.value)}
            placeholder="+971 50 …"
          />
          <FieldError message={errors.owner_phone} />
        </fieldset>
      </div>
      <label className="flex items-center gap-2.5 text-[12.5px] text-bz-ink-2 cursor-pointer mt-1">
        <input
          type="checkbox"
          checked={state.marketing_opt_in}
          onChange={(e) => update("marketing_opt_in", e.target.checked)}
        />
        Send me Bazar&apos;s quarterly market read (no daily spam, ever).
      </label>
    </div>
  );
}

/* ─── Visual chrome ─────────────────────────────────────────── */

function ProgressStrip({ current }: { current: number }) {
  return (
    <div className="flex gap-1 mb-7" data-testid="progress-strip">
      {STEP_LABELS.map((label, i) => {
        const state =
          i < current ? "done" : i === current ? "current" : "pending";
        return (
          <div
            key={label}
            className={cn(
              "flex-1 pb-3 border-b-2",
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
  return (
    <div className="mb-2 flex justify-between items-center px-5 py-3.5 bg-bz-surface border border-bz-border rounded-lg">
      <div>
        <Eyebrow>Step {n} · {label}</Eyebrow>
        <div className="text-[13px] mt-1">{summary}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Edit
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
  const { prefs } = usePreferences();
  const rangeValue = (aed: number) =>
    formatRangeAed(convertFromAed(aed, prefs.currency));
  const area = areas.find((a) => a.id === state.area_id);
  const propertyLine = [
    state.building_name || area?.name || "Property",
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
            Live preview · refines as you fill
          </Eyebrow>
          <div className="serif text-[18px] mt-0.5">Bazar valuation report</div>
        </div>
        {estimate ? (
          <div className="mono text-[10.5px] text-white/70">
            range {Math.round(estimate.basis.rangeFraction * 100)}% ·{" "}
            {estimate.basis.confidence}
          </div>
        ) : null}
      </div>
      <div className="p-6">
        <div className="text-[13px] font-medium">{propertyLine}</div>
        <div className="text-[11.5px] text-bz-muted mt-0.5">
          {state.beds} bed · {state.baths} ba ·{" "}
          {formatArea(state.built_up_ft2, prefs.area_unit)}
          {state.floor != null ? ` · Floor ${state.floor}` : ""}
        </div>

        <div className="mt-6">
          <Eyebrow>
            Estimated market value · {currencySymbol(prefs.currency)}
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
                Midpoint{" "}
                <span className="text-bz-navy font-medium">
                  {currencySymbol(prefs.currency)} {rangeValue(estimate.midAed)}
                </span>{" "}
                · {formatPricePerArea(estimate.pricePerFt2Used, prefs)}
              </div>
            </>
          ) : (
            <div className="text-[13px] text-bz-muted mt-2">
              Add a built-up area to see the range.
            </div>
          )}
        </div>

        <div className="border-t border-bz-border my-6" />

        <div>
          <Eyebrow>What goes into the estimate</Eyebrow>
          <ul className="mt-3 flex flex-col gap-2 text-[12px] text-bz-ink-2">
            <li className="flex justify-between">
              <span>
                Area baseline ({currencySymbol(prefs.currency)}/
                {areaUnitLabel(prefs.area_unit)})
              </span>
              <span className="mono">
                {estimate
                  ? formatPricePerAreaValue(estimate.basis.baselinePpf, prefs)
                  : "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Condition adjustment</span>
              <span className="mono">
                {estimate
                  ? `× ${estimate.basis.multipliers.condition.toFixed(2)}`
                  : "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>View premium</span>
              <span className="mono">
                {estimate
                  ? `× ${estimate.basis.multipliers.view.toFixed(2)}`
                  : "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Upgrades premium</span>
              <span className="mono">
                {estimate
                  ? `× ${estimate.basis.multipliers.upgrades.toFixed(2)}`
                  : "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Furnishing</span>
              <span className="mono">
                {estimate
                  ? `× ${estimate.basis.multipliers.furnishing.toFixed(2)}`
                  : "—"}
              </span>
            </li>
            {estimate &&
            estimate.basis.multipliers.floor !== 1 ? (
              <li className="flex justify-between">
                <span>Floor premium</span>
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
            <Eyebrow>Advisor review · pending</Eyebrow>
            <p className="text-[13px] mt-1 leading-relaxed">
              A senior advisor will refine this and send a final number
              within 24 hours of submission.
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
  const { prefs } = usePreferences();
  const rangeValue = (aed: number) =>
    formatRangeAed(convertFromAed(aed, prefs.currency));
  return (
    <section
      className="px-4 md:px-12 pb-12 md:pb-24"
      data-testid="valuation-confirmation"
    >
      <div className="max-w-[640px] bg-bz-accent-soft rounded-xl p-6 md:p-10">
        <Eyebrow className="text-bz-accent">Thank you, {ownerName}</Eyebrow>
        <h2
          className="serif text-[28px] md:text-[36px] mt-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          Your valuation is in review.
        </h2>
        <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed">
          We&apos;ve sent a confirmation to{" "}
          <strong className="text-bz-ink">{ownerEmail}</strong> with the
          instant range below. A senior advisor will refine the number and
          email you within 24 hours.
        </p>
        {estimate ? (
          <div className="mt-6 px-5 py-4 bg-white rounded-lg border border-bz-border">
            <Eyebrow>Instant range</Eyebrow>
            <div
              className="serif text-[28px] md:text-[40px] mt-1 text-bz-navy"
              style={{ letterSpacing: "-0.025em" }}
              data-testid="confirmation-range"
            >
              {rangeValue(estimate.lowAed)} – {rangeValue(estimate.highAed)}
            </div>
            <div className="text-[12.5px] text-bz-muted mt-1">
              midpoint {currencySymbol(prefs.currency)}{" "}
              {rangeValue(estimate.midAed)}
            </div>
            {valuationId ? (
              <a
                href={`/api/pdf/valuation/${valuationId}`}
                className="mt-5 inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[13px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
              >
                {pdfLabel("Download PDF", locale)}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
