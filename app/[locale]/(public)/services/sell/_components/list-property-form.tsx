"use client";

import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Home,
  MapPin,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadAreaOption } from "@/lib/queries/lead-routing";
import {
  LP_BEDROOMS,
  LP_CALL_WINDOWS,
  LP_CATEGORIES,
  LP_FURNISHINGS,
  LP_INTENTS,
  LP_TYPES,
  LP_URGENCIES,
  bedroomsApply,
  buildSummary,
  listPropertySchema,
  parseAreaSqft,
  type ListPropertyInput,
  type LpCategory,
} from "@/lib/schemas/list-property";
import { submitListingLead, type ListPropertyAdvisor } from "../_actions";

const DRAFT_KEY = "bazar:list-property:draft";
const MAX_SUGGESTIONS = 5;

/**
 * Every string on the card that isn't a question, an option or a validation
 * message — all editable from Pages → List your property. Each is optional and
 * falls back to the literal below, which is the copy the form shipped with:
 * the master-page registry holds the same values as its defaults, so the two
 * only diverge if someone edits one and not the other.
 */
export type SellFormCopy = Partial<{
  step1Label: string | null;
  step2Label: string | null;
  continueLabel: string | null;
  reassurance: string | null;
  detailsTitle: string | null;
  detailsSub: string | null;
  consentLabel: string | null;
  submitLabel: string | null;
  submitPendingLabel: string | null;
  backLabel: string | null;
  editLabel: string | null;
  referenceLabel: string | null;
  headingMatched: string | null;
  headingDesk: string | null;
  summaryMatched: string | null;
  summaryDesk: string | null;
  deskName: string | null;
  deskRole: string | null;
  /** Monogram drawn in the round badge while no logo is picked. */
  deskInitials: string | null;
  /** Logo for the round badge. Resolved from the picked media asset. */
  deskAvatarUrl: string | null;
  deskAvatarAlt: string | null;
  callLabel: string | null;
  stepsLabel: string | null;
  steps: [string, string][];
  anotherLabel: string | null;
}>;

type ResolvedCopy = {
  [K in keyof Required<SellFormCopy>]: K extends "steps"
    ? [string, string][]
    : K extends "deskAvatarUrl" | "deskAvatarAlt"
      ? string | null
      : string;
};

const FALLBACK_COPY: ResolvedCopy = {
  step1Label: "Your property",
  step2Label: "Your details",
  continueLabel: "Continue",
  reassurance:
    "Takes about two minutes. Nothing is published without your written go-ahead.",
  detailsTitle: "Where should the advisor reach you?",
  detailsSub:
    "Your details go to one advisor only. We don't sell them on, and you won't be added to a mailing list.",
  consentLabel:
    "I agree that Bazar Real Estate may contact me about this property by phone, WhatsApp and email.",
  submitLabel: "Match me with an advisor",
  submitPendingLabel: "Matching…",
  backLabel: "Back",
  editLabel: "Edit",
  referenceLabel: "Matched · reference",
  headingMatched: "{advisor} will call you {when}.",
  headingDesk: "An advisor will call you {when}.",
  summaryMatched: "— assigned to the advisor who covers your community.",
  summaryDesk: "— with the Abu Dhabi desk, who will put the right advisor on it.",
  deskName: "Bazar advisory desk",
  deskRole: "Abu Dhabi · Sell, rent and management",
  deskInitials: "BZ",
  deskAvatarUrl: null,
  deskAvatarAlt: null,
  callLabel: "Call now",
  stepsLabel: "What happens next",
  steps: [
    ["Today", "{advisor} calls to confirm the details and answer anything outstanding."],
    [
      "Within 48 hours",
      "Free valuation visit, photography brief and a pricing recommendation.",
    ],
    [
      "Day 3–5",
      "Form A signed, listing goes live across Bazar and the UAE portals.",
    ],
  ] as [string, string][],
  anotherLabel: "Submit another property",
};

function resolveCopy(copy: SellFormCopy | undefined): ResolvedCopy {
  const pick = <K extends keyof ResolvedCopy>(key: K) => {
    const value = copy?.[key];
    if (key === "steps") {
      return (Array.isArray(value) && value.length > 0
        ? value
        : FALLBACK_COPY.steps) as ResolvedCopy[K];
    }
    return (typeof value === "string" && value.trim() !== ""
      ? value
      : FALLBACK_COPY[key]) as ResolvedCopy[K];
  };
  return {
    step1Label: pick("step1Label"),
    step2Label: pick("step2Label"),
    continueLabel: pick("continueLabel"),
    reassurance: pick("reassurance"),
    detailsTitle: pick("detailsTitle"),
    detailsSub: pick("detailsSub"),
    consentLabel: pick("consentLabel"),
    submitLabel: pick("submitLabel"),
    submitPendingLabel: pick("submitPendingLabel"),
    backLabel: pick("backLabel"),
    editLabel: pick("editLabel"),
    referenceLabel: pick("referenceLabel"),
    headingMatched: pick("headingMatched"),
    headingDesk: pick("headingDesk"),
    summaryMatched: pick("summaryMatched"),
    summaryDesk: pick("summaryDesk"),
    deskName: pick("deskName"),
    deskRole: pick("deskRole"),
    deskAvatarUrl: pick("deskAvatarUrl"),
    deskAvatarAlt: pick("deskAvatarAlt"),
    deskInitials: pick("deskInitials"),
    callLabel: pick("callLabel"),
    stepsLabel: pick("stepsLabel"),
    steps: pick("steps"),
    anotherLabel: pick("anotherLabel"),
  };
}

/**
 * The advisor and the call window are only known once the lead has been
 * routed, so the confirmation copy carries them as placeholders rather than as
 * text an editor could type. An unknown token is left alone rather than
 * blanked, so a typo reads as a typo instead of losing the sentence.
 */
function fillTokens(
  template: string,
  tokens: { advisor?: string; when?: string },
): string {
  return template
    .replace(/\{advisor\}/g, tokens.advisor ?? "")
    .replace(/\{when\}/g, tokens.when ?? "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type Props = {
  /** The areas index the location field autocompletes against. */
  areas: LeadAreaOption[];
  /** Fallback line for "Call now" when no advisor covers the area. */
  deskPhone: string | null;
  /** Editable copy from the master page. Omitted, the form uses its own. */
  copy?: SellFormCopy;
};

type Confirmation = {
  reference: string;
  summary: string;
  callPhrase: string;
  advisor: ListPropertyAdvisor | null;
};

const STEP1_FIELDS = [
  "intent",
  "location",
  "category",
  "property_type",
  "bedrooms",
  "area_sqft",
  "furnishing",
  "urgency",
] as const;

export function ListPropertyForm({ areas, deskPhone, copy }: Props) {
  const t = useTranslations("forms");
  const c = useMemo(() => resolveCopy(copy), [copy]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [areaText, setAreaText] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    reset,
    setError,
    formState: { errors },
  } = useForm<ListPropertyInput>({
    resolver: zodResolver(listPropertySchema),
    mode: "onSubmit",
    defaultValues: {
      intent: "sell",
      location: "",
      area_slug: null,
      category: "residential",
      property_type: "",
      bedrooms: null,
      area_sqft: null,
      furnishing: null,
      urgency: null,
      name: "",
      mobile: "",
      email: "",
      call_window: "afternoon",
      consent: true,
    },
  });

  const values = watch();
  const showBedrooms = bedroomsApply(values.category, values.property_type);

  // Owners are a high-value lead and the qualification half is the tedious
  // half — a refresh or a stray back-navigation must not cost them.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = window.sessionStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved) as Partial<ListPropertyInput>;
      for (const key of STEP1_FIELDS) {
        const v = draft[key];
        if (v !== undefined) {
          setValue(key, v as never);
        }
      }
      if (typeof draft.area_slug === "string" || draft.area_slug === null)
        setValue("area_slug", draft.area_slug);
      if (typeof draft.area_sqft === "number")
        setAreaText(draft.area_sqft.toLocaleString("en-GB"));
    } catch {
      // A corrupt draft is not worth surfacing — start clean.
    }
  }, [setValue]);

  useEffect(() => {
    if (!restored.current || step === 3) return;
    try {
      const draft: Partial<ListPropertyInput> = {};
      for (const key of STEP1_FIELDS) {
        (draft as Record<string, unknown>)[key] = values[key];
      }
      draft.area_slug = values.area_slug ?? null;
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Private-mode storage failures are not the owner's problem.
    }
  }, [values, step]);

  const setCategory = (category: LpCategory) => {
    setValue("category", category);
    // The type list changes underneath, so a carried-over selection would be
    // invalid — and bedrooms hang off the type.
    setValue("property_type", "");
    setValue("bedrooms", null);
  };

  const goToStep2 = async () => {
    setFormError(null);
    const ok = await trigger([...STEP1_FIELDS]);
    if (ok) setStep(2);
  };

  const onSubmit = (input: ListPropertyInput) => {
    setFormError(null);
    startTransition(async () => {
      const result = await submitListingLead(input);
      if (result.status === "ok") {
        try {
          window.sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          // ignore
        }
        setConfirmation({
          reference: result.reference,
          summary: result.summary,
          callPhrase: t(`sell.callPhrase.${result.callWindow}`),
          advisor: result.advisor,
        });
        setStep(3);
        return;
      }
      setFormError(result.message);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof ListPropertyInput, { message });
      }
    });
  };

  // A step-1 field can only fail here if someone got past the Continue gate
  // (stale tab, autofill). Sending them back beats showing an error on a field
  // that is currently hidden.
  const onInvalid = (fieldErrors: Record<string, unknown>) => {
    if (STEP1_FIELDS.some((f) => fieldErrors[f])) setStep(1);
  };

  const startAnother = () => {
    reset({
      ...values,
      location: "",
      area_slug: null,
      property_type: "",
      bedrooms: null,
      area_sqft: null,
      furnishing: null,
      urgency: null,
    });
    setAreaText("");
    setConfirmation(null);
    setStep(1);
  };

  const summary = buildSummary(values);

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface overflow-hidden">
      <StepHeader step={step} labels={[c.step1Label, c.step2Label]} />

      <p aria-live="polite" className="sr-only">
        {step === 1
          ? `Step 1 of 2 — ${c.step1Label}`
          : step === 2
            ? `Step 2 of 2 — ${c.step2Label}`
            : "Enquiry sent. You are matched with an advisor."}
      </p>

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        noValidate
        hidden={step === 3}
        className="p-6 md:p-7"
      >
        {/* `hidden` rather than a display class: the inactive step must leave
            the tab order and the accessibility tree, not just the viewport. */}
        <div hidden={step !== 1}>
          <FieldShell label="I am looking to" required>
            <div className="grid grid-cols-2 gap-1.5">
              {LP_INTENTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setValue("intent", v)}
                  aria-pressed={values.intent === v}
                  className={cn(
                    "h-12 rounded text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-teal",
                    values.intent === v
                      ? "bg-bz-navy text-bz-bg"
                      : "bg-bz-surface-2 text-bz-ink-2 hover:bg-bz-surface-3",
                  )}
                >
                  {t(`sell.intent.${v}`)}
                </button>
              ))}
            </div>
          </FieldShell>

          <LocationField
            areas={areas}
            value={values.location}
            error={errors.location?.message}
            onChange={(text, slug) => {
              setValue("location", text, { shouldValidate: false });
              setValue("area_slug", slug);
            }}
          />

          <FieldShell
            label="Category & type"
            required
            error={errors.property_type?.message}
            className="mt-6"
          >
            <div
              role="group"
              aria-label={t("sell.categoryGroup")}
              className="inline-flex gap-1 p-[3px] rounded bg-bz-surface-2"
            >
              {LP_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={values.category === c}
                  className={cn(
                    "h-9 px-3.5 rounded text-[12.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-teal",
                    values.category === c
                      ? "bg-bz-surface text-bz-ink font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                      : "text-bz-muted hover:text-bz-ink",
                  )}
                >
                  {t(`sell.category.${c}`)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {/*
                `pt` is the submitted value and the message key both — the
                English member of LP_TYPES is what the server validates
                against, so only the label moves.
              */}
              {LP_TYPES[values.category].map((pt) => (
                <Pill
                  key={pt}
                  active={values.property_type === pt}
                  onClick={() => {
                    setValue("property_type", pt);
                    if (!bedroomsApply(values.category, pt))
                      setValue("bedrooms", null);
                  }}
                >
                  {t(`sell.type.${pt}`)}
                </Pill>
              ))}
            </div>
          </FieldShell>

          {showBedrooms ? (
            <FieldShell
              label={t("sell.fieldBedrooms")}
              required
              error={errors.bedrooms?.message}
              className="mt-6"
            >
              <div className="flex flex-wrap gap-1.5">
                {LP_BEDROOMS.map((b) => (
                  <Pill
                    key={b === "Studio" ? t("sell.bedroomsStudio") : b}
                    active={values.bedrooms === b}
                    onClick={() => setValue("bedrooms", b)}
                    className={b === "Studio" ? undefined : "min-w-[48px]"}
                  >
                    {b === "Studio" ? t("sell.bedroomsStudio") : b}
                  </Pill>
                ))}
              </div>
            </FieldShell>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-6">
            <FieldShell label={t("sell.fieldArea")} error={errors.area_sqft?.message}>
              <div className="relative">
                <input
                  id="lp-area"
                  inputMode="numeric"
                  autoComplete="off"
                  value={areaText}
                  onChange={(e) => {
                    const next = e.target.value.replace(/[^\d,]/g, "");
                    setAreaText(next);
                    setValue("area_sqft", parseAreaSqft(next));
                  }}
                  placeholder="0"
                  className="mono w-full h-11 rounded border border-bz-border bg-bz-surface px-3 pe-11 text-[14px] transition-colors focus:border-bz-teal outline-none"
                />
                <span className="absolute end-3.5 top-1/2 -translate-y-1/2 text-[12px] text-bz-muted pointer-events-none">
                  ft²
                </span>
              </div>
            </FieldShell>
            <FieldShell label={t("sell.fieldFurnishing")} htmlFor="lp-furnishing">
              <select
                id="lp-furnishing"
                value={values.furnishing ?? ""}
                onChange={(e) =>
                  setValue(
                    "furnishing",
                    (e.target.value || null) as ListPropertyInput["furnishing"],
                  )
                }
                className="w-full h-11 rounded border border-bz-border bg-bz-surface px-3 text-[14px] transition-colors focus:border-bz-teal outline-none"
              >
                <option value="">Select</option>
                {LP_FURNISHINGS.map((f) => (
                  <option key={f} value={f}>
                    {t(`sell.furnishing.${f}`)}
                  </option>
                ))}
              </select>
            </FieldShell>
          </div>

          <FieldShell
            label={
              values.intent === "sell"
                ? t("sell.urgencySell")
                : t("sell.urgencyRent")
            }
            className="mt-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {LP_URGENCIES.map((u) => (
                <Pill
                  key={u}
                  active={values.urgency === u}
                  onClick={() =>
                    setValue("urgency", values.urgency === u ? null : u)
                  }
                  className="h-11 justify-center"
                >
                  {t(`sell.urgency.${u}`)}
                </Pill>
              ))}
            </div>
          </FieldShell>

          <button
            type="button"
            onClick={goToStep2}
            className="mt-7 w-full h-12 rounded bg-bz-accent text-bz-accent-fg text-[14.5px] font-medium inline-flex items-center justify-center gap-2 transition-colors hover:bg-bz-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-teal"
          >
            {c.continueLabel}
            <ArrowRight size={16} strokeWidth={1.7} />
          </button>
          <p className="text-[11.5px] text-bz-muted mt-3 text-center leading-relaxed">
            {c.reassurance}
          </p>
        </div>

        <div hidden={step !== 2}>
          <div className="flex items-center gap-3 p-3.5 rounded bg-bz-surface-2">
            <Home size={16} strokeWidth={1.6} className="text-bz-muted shrink-0" />
            <span className="text-[13px] flex-1 leading-snug">{summary}</span>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-9 px-3 rounded text-[13px] text-bz-ink-2 hover:bg-bz-surface-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-teal"
            >
              {c.editLabel}
            </button>
          </div>

          <h3
            className="serif text-[24px] md:text-[26px] mt-6"
            style={{ letterSpacing: "-0.02em" }}
          >
            {c.detailsTitle}
          </h3>
          <p className="text-[13px] text-bz-ink-2 mt-1.5 leading-relaxed">
            {c.detailsSub}
          </p>

          <FieldShell
            label={t("sell.fieldName")}
            required
            htmlFor="lp-name"
            error={errors.name?.message}
            className="mt-6"
          >
            <input
              id="lp-name"
              {...register("name")}
              autoComplete="name"
              placeholder={t("sell.namePlaceholder")}
              className="w-full h-11 rounded border border-bz-border bg-bz-surface px-3 text-[14px] transition-colors focus:border-bz-teal outline-none"
            />
          </FieldShell>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4.5">
            <FieldShell
              label={t("sell.fieldMobile")}
              required
              htmlFor="lp-mobile"
              error={errors.mobile?.message}
            >
              <div className="flex">
                <span className="mono inline-flex items-center h-11 px-3 rounded-s border border-e-0 border-bz-border bg-bz-surface-2 text-[12.5px] text-bz-ink-2">
                  +971
                </span>
                <input
                  id="lp-mobile"
                  {...register("mobile")}
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder={t("sell.mobilePlaceholder")}
                  className="mono w-full h-11 rounded-e border border-bz-border bg-bz-surface px-3 text-[14px] transition-colors focus:border-bz-teal outline-none"
                />
              </div>
            </FieldShell>
            <FieldShell
              label={t("sell.fieldEmail")}
              required
              htmlFor="lp-email"
              error={errors.email?.message}
            >
              <input
                id="lp-email"
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder={t("sell.emailPlaceholder")}
                className="w-full h-11 rounded border border-bz-border bg-bz-surface px-3 text-[14px] transition-colors focus:border-bz-teal outline-none"
              />
            </FieldShell>
          </div>

          <FieldShell label={t("sell.fieldCallWindow")} className="mt-4.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {LP_CALL_WINDOWS.map((c) => (
                <Pill
                  key={c}
                  active={values.call_window === c}
                  onClick={() => setValue("call_window", c)}
                  className="h-11 justify-center"
                >
                  {t(`sell.callWindow.${c}`)}
                </Pill>
              ))}
            </div>
          </FieldShell>

          <label className="flex gap-2.5 items-start mt-6 text-[12.5px] text-bz-ink-2 leading-relaxed cursor-pointer">
            <input
              type="checkbox"
              {...register("consent")}
              className="mt-0.5 size-4 accent-[var(--bz-navy)]"
            />
            <span>{c.consentLabel}</span>
          </label>
          {errors.consent?.message ? (
            <p role="alert" className="text-[12px] text-bz-danger mt-1.5">
              {errors.consent.message}
            </p>
          ) : null}

          {formError ? (
            <p
              role="alert"
              className="text-[12.5px] text-bz-danger mt-4 leading-relaxed"
            >
              {formError}
            </p>
          ) : null}

          <div className="flex gap-2.5 mt-6">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-12 px-4 rounded text-[14px] text-bz-ink-2 inline-flex items-center gap-2 hover:bg-bz-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-teal"
            >
              <ArrowLeft size={15} strokeWidth={1.7} />
              {c.backLabel}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 h-12 rounded bg-bz-accent text-bz-accent-fg text-[14.5px] font-medium transition-colors hover:bg-bz-accent-hover disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-teal"
            >
              {pending ? c.submitPendingLabel : c.submitLabel}
            </button>
          </div>
        </div>
      </form>

      {step === 3 && confirmation ? (
        <Confirmed
          confirmation={confirmation}
          deskPhone={deskPhone}
          copy={c}
          onAnother={startAnother}
        />
      ) : null}
    </div>
  );
}

/* ── step header ─────────────────────────────────────────────────── */

function StepHeader({
  step,
  labels,
}: {
  step: 1 | 2 | 3;
  labels: [string, string];
}) {
  const tabs: [string, string][] = [
    ["01", labels[0]],
    ["02", labels[1]],
  ];
  return (
    <div className="flex border-b border-bz-border">
      {tabs.map(([n, label], i) => {
        const index = i + 1;
        const done = step > index;
        const current = step === index;
        return (
          <div
            key={n}
            className={cn(
              "flex-1 flex items-center gap-2.5 px-5 py-4 -mb-px border-b-2",
              current || done ? "border-bz-teal" : "border-transparent",
              current ? "bg-transparent" : "bg-bz-surface-2",
            )}
          >
            <span
              className={cn(
                "mono text-[10.5px]",
                current || done ? "text-bz-ink" : "text-bz-muted-2",
              )}
            >
              {n}
            </span>
            <span
              className={cn(
                "text-[13px]",
                current
                  ? "font-medium text-bz-ink"
                  : done
                    ? "text-bz-ink"
                    : "text-bz-muted",
              )}
            >
              {label}
            </span>
            {done ? (
              <Check
                size={15}
                strokeWidth={2}
                className="ms-auto text-bz-success"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ── confirmation ────────────────────────────────────────────────── */

function Confirmed({
  confirmation,
  deskPhone,
  copy,
  onAnother,
}: {
  confirmation: Confirmation;
  deskPhone: string | null;
  copy: ResolvedCopy;
  onAnother: () => void;
}) {
  const t = useTranslations("forms");
  const { advisor } = confirmation;
  const firstName = advisor?.name.split(" ")[0] ?? null;
  const phone = advisor?.phone ?? deskPhone;
  // "Your advisor" rather than a blank when nobody is matched: the timeline
  // still describes a call that will happen, just not by name.
  const advisorToken = firstName ?? t("sell.advisorFallback");
  const nextSteps: [string, string][] = copy.steps.map(([when, what]) => [
    when,
    fillTokens(what, { advisor: advisorToken }),
  ]);

  return (
    <div className="p-6 md:p-7">
      <div className="flex items-center gap-2.5">
        <span className="size-[30px] rounded-full bg-bz-accent-soft text-bz-accent inline-flex items-center justify-center shrink-0">
          <Check size={16} strokeWidth={2} />
        </span>
        <span className="eyebrow" style={{ color: "var(--bz-accent)" }}>
          {copy.referenceLabel} {confirmation.reference}
        </span>
      </div>

      <h3
        className="serif text-[26px] md:text-[30px] mt-4 leading-[1.15]"
        style={{ letterSpacing: "-0.025em" }}
      >
        {fillTokens(firstName ? copy.headingMatched : copy.headingDesk, {
          advisor: firstName ?? "",
          when: confirmation.callPhrase,
        })}
      </h3>
      <p className="text-[14px] text-bz-ink-2 mt-2.5 leading-relaxed">
        {confirmation.summary}{" "}
        {advisor ? copy.summaryMatched : copy.summaryDesk}
      </p>

      <div className="flex flex-wrap gap-3.5 items-center mt-6 p-4 border border-bz-border rounded-lg">
        {/* A matched advisor keeps their own monogram — the logo stands in for
            the desk, not for a named person. */}
        {!advisor && copy.deskAvatarUrl ? (
          <span className="relative size-[52px] rounded-full overflow-hidden bg-bz-surface-2 border border-bz-border shrink-0">
            <Image
              src={copy.deskAvatarUrl}
              alt={copy.deskAvatarAlt ?? copy.deskName}
              fill
              sizes="52px"
              className="object-cover"
            />
          </span>
        ) : (
          <span className="size-[52px] rounded-full bg-bz-accent text-bz-accent-fg serif text-[18px] inline-flex items-center justify-center shrink-0">
            {advisor?.initials ?? copy.deskInitials}
          </span>
        )}
        <div className="flex-1 min-w-[140px]">
          <div className="text-[15px] font-medium">
            {advisor?.name ?? copy.deskName}
          </div>
          <div className="text-[12px] text-bz-muted mt-0.5">
            {[advisor?.title, formatLicence(advisor?.brn)]
              .filter(Boolean)
              .join(" · ") || copy.deskRole}
          </div>
        </div>
        {phone ? (
          <a
            href={`tel:${phone.replace(/\s+/g, "")}`}
            className="h-11 px-4 rounded border border-bz-border text-[13px] inline-flex items-center gap-2 hover:bg-bz-surface-2 transition-colors"
          >
            <Phone size={14} strokeWidth={1.7} />
            {copy.callLabel}
          </a>
        ) : null}
      </div>

      <div className="eyebrow mt-6">{copy.stepsLabel}</div>
      <ol className="mt-3">
        {nextSteps.map(([when, what], i) => (
          <li
            key={when}
            className={cn("flex gap-3.5", i === nextSteps.length - 1 ? "" : "pb-4")}
          >
            <div className="flex flex-col items-center shrink-0">
              <span
                className={cn(
                  "size-[9px] rounded-full border-[1.5px] border-bz-ink mt-1.5",
                  i === 0 ? "bg-bz-ink" : "bg-bz-surface",
                )}
              />
              {i === nextSteps.length - 1 ? null : (
                <span className="flex-1 w-px bg-bz-border-strong mt-1" />
              )}
            </div>
            <div>
              <div className="text-[12.5px] font-medium">{when}</div>
              <div className="text-[12.5px] text-bz-ink-2 mt-0.5 leading-relaxed">
                {what}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onAnother}
        className="mt-6 h-11 px-4 -ms-4 rounded text-[13px] text-bz-ink-2 hover:bg-bz-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-teal"
      >
        {copy.anotherLabel}
      </button>
    </div>
  );
}

/**
 * Licence numbers are stored however the registry writes them — some carry
 * their own prefix ("BRN-58219"), some don't. Prefixing blindly gave us
 * "BRN BRN-58219" on the confirmation card.
 */
function formatLicence(brn: string | null | undefined): string | null {
  if (!brn) return null;
  return /^(brn|adrec)/i.test(brn.trim()) ? brn.trim() : `BRN ${brn.trim()}`;
}

/* ── location combobox ───────────────────────────────────────────── */

function LocationField({
  areas,
  value,
  error,
  onChange,
}: {
  areas: LeadAreaOption[];
  value: string;
  error?: string;
  onChange: (text: string, slug: string | null) => void;
}) {
  const t = useTranslations("forms");
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const pool = q
      ? areas.filter((a) => a.name.toLowerCase().includes(q))
      : areas;
    return pool.slice(0, MAX_SUGGESTIONS);
  }, [areas, value]);

  const commit = useCallback(
    (option: LeadAreaOption) => {
      onChange(option.name, option.slug);
      setOpen(false);
    },
    [onChange],
  );

  // Click-away rather than blur: blur fires before a suggestion's click and
  // would close the list out from under the pointer.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const showList = open && matches.length > 0;

  return (
    <FieldShell
      label={t("sell.fieldLocation")}
      required
      htmlFor="lp-location"
      error={error}
      className="mt-6"
    >
      <div className="relative" ref={wrap}>
        <MapPin
          size={16}
          strokeWidth={1.6}
          className="absolute start-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
        />
        <input
          id="lp-location"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList ? `${listId}-option-${active}` : undefined
          }
          autoComplete="off"
          value={value}
          onChange={(e) => {
            onChange(e.target.value, null);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!showList) {
              if (e.key === "ArrowDown") setOpen(true);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % matches.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + matches.length) % matches.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              commit(matches[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={t("sell.locationPlaceholder")}
          className="w-full h-11 rounded border border-bz-border bg-bz-surface ps-9 pe-3 text-[14px] transition-colors focus:border-bz-teal outline-none"
        />
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={t("sell.matchingAreas")}
            className="absolute top-[calc(100%+4px)] start-0 end-0 z-20 rounded border border-bz-border bg-bz-surface overflow-hidden"
          >
            {matches.map((option, i) => (
              <li
                key={option.slug}
                id={`${listId}-option-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                // mousedown, not click — the selection has to land before the
                // input's blur tears the list down.
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(option);
                }}
                className={cn(
                  "flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] cursor-pointer border-b border-bz-border last:border-b-0",
                  i === active ? "bg-bz-surface-2" : "",
                )}
              >
                <MapPin size={14} strokeWidth={1.6} className="text-bz-muted-2" />
                {option.name}
                <span className="ms-auto text-[11px] text-bz-muted">
                  {option.context}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </FieldShell>
  );
}

/* ── small pieces ────────────────────────────────────────────────── */

function Pill({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center h-11 px-3.5 rounded border text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-teal",
        active
          ? "bg-bz-navy text-bz-bg border-bz-navy font-medium"
          : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
        className,
      )}
    >
      {children}
    </button>
  );
}

function FieldShell({
  label,
  required,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  const Tag = htmlFor ? "label" : "span";
  return (
    <div className={className}>
      <Tag
        {...(htmlFor ? { htmlFor } : {})}
        className="block text-[12.5px] font-medium text-bz-ink mb-2"
      >
        {label}
        {required ? <span className="text-bz-muted-2 ms-0.5">*</span> : null}
      </Tag>
      {children}
      {error ? (
        <p role="alert" className="text-[12px] text-bz-danger mt-1.5">
          {error}
        </p>
      ) : null}
    </div>
  );
}
