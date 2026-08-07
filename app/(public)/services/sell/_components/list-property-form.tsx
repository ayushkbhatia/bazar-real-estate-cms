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
import { useForm } from "react-hook-form";
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
  LP_CALL_WINDOW_LABELS,
  LP_CALL_WINDOW_PHRASES,
  LP_CATEGORIES,
  LP_CATEGORY_LABELS,
  LP_FURNISHINGS,
  LP_FURNISHING_LABELS,
  LP_INTENTS,
  LP_INTENT_LABELS,
  LP_TYPES,
  LP_URGENCIES,
  LP_URGENCY_LABELS,
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

type Props = {
  /** The areas index the location field autocompletes against. */
  areas: LeadAreaOption[];
  /** Fallback line for "Call now" when no advisor covers the area. */
  deskPhone: string | null;
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

export function ListPropertyForm({ areas, deskPhone }: Props) {
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
          callPhrase: LP_CALL_WINDOW_PHRASES[result.callWindow],
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
      <StepHeader step={step} />

      <p aria-live="polite" className="sr-only">
        {step === 1
          ? "Step 1 of 2 — your property"
          : step === 2
            ? "Step 2 of 2 — your details"
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
                  {LP_INTENT_LABELS[v]}
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
              aria-label="Property category"
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
                  {LP_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {LP_TYPES[values.category].map((t) => (
                <Pill
                  key={t}
                  active={values.property_type === t}
                  onClick={() => {
                    setValue("property_type", t);
                    if (!bedroomsApply(values.category, t))
                      setValue("bedrooms", null);
                  }}
                >
                  {t}
                </Pill>
              ))}
            </div>
          </FieldShell>

          {showBedrooms ? (
            <FieldShell
              label="Bedrooms"
              required
              error={errors.bedrooms?.message}
              className="mt-6"
            >
              <div className="flex flex-wrap gap-1.5">
                {LP_BEDROOMS.map((b) => (
                  <Pill
                    key={b}
                    active={values.bedrooms === b}
                    onClick={() => setValue("bedrooms", b)}
                    className={b === "Studio" ? undefined : "min-w-[48px]"}
                  >
                    {b}
                  </Pill>
                ))}
              </div>
            </FieldShell>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-6">
            <FieldShell label="Built-up area" error={errors.area_sqft?.message}>
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
                  className="mono w-full h-11 rounded border border-bz-border bg-bz-surface px-3 pr-11 text-[14px] transition-colors focus:border-bz-teal outline-none"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] text-bz-muted pointer-events-none">
                  ft²
                </span>
              </div>
            </FieldShell>
            <FieldShell label="Furnishing" htmlFor="lp-furnishing">
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
                    {LP_FURNISHING_LABELS[f]}
                  </option>
                ))}
              </select>
            </FieldShell>
          </div>

          <FieldShell
            label={
              values.intent === "sell"
                ? "How soon do you want to sell?"
                : "How soon do you want it let?"
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
                  {LP_URGENCY_LABELS[u]}
                </Pill>
              ))}
            </div>
          </FieldShell>

          <button
            type="button"
            onClick={goToStep2}
            className="mt-7 w-full h-12 rounded bg-bz-accent text-bz-accent-fg text-[14.5px] font-medium inline-flex items-center justify-center gap-2 transition-colors hover:bg-bz-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-teal"
          >
            Continue
            <ArrowRight size={16} strokeWidth={1.7} />
          </button>
          <p className="text-[11.5px] text-bz-muted mt-3 text-center leading-relaxed">
            Takes about two minutes. Nothing is published without your written
            go-ahead.
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
              Edit
            </button>
          </div>

          <h3
            className="serif text-[24px] md:text-[26px] mt-6"
            style={{ letterSpacing: "-0.02em" }}
          >
            Where should the advisor reach you?
          </h3>
          <p className="text-[13px] text-bz-ink-2 mt-1.5 leading-relaxed">
            Your details go to one advisor only. We don&apos;t sell them on, and
            you won&apos;t be added to a mailing list.
          </p>

          <FieldShell
            label="Full name"
            required
            htmlFor="lp-name"
            error={errors.name?.message}
            className="mt-6"
          >
            <input
              id="lp-name"
              {...register("name")}
              autoComplete="name"
              placeholder="As it appears on the title deed"
              className="w-full h-11 rounded border border-bz-border bg-bz-surface px-3 text-[14px] transition-colors focus:border-bz-teal outline-none"
            />
          </FieldShell>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4.5">
            <FieldShell
              label="Mobile"
              required
              htmlFor="lp-mobile"
              error={errors.mobile?.message}
            >
              <div className="flex">
                <span className="mono inline-flex items-center h-11 px-3 rounded-l border border-r-0 border-bz-border bg-bz-surface-2 text-[12.5px] text-bz-ink-2">
                  +971
                </span>
                <input
                  id="lp-mobile"
                  {...register("mobile")}
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="50 000 0000"
                  className="mono w-full h-11 rounded-r border border-bz-border bg-bz-surface px-3 text-[14px] transition-colors focus:border-bz-teal outline-none"
                />
              </div>
            </FieldShell>
            <FieldShell
              label="Email"
              required
              htmlFor="lp-email"
              error={errors.email?.message}
            >
              <input
                id="lp-email"
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder="you@email.com"
                className="w-full h-11 rounded border border-bz-border bg-bz-surface px-3 text-[14px] transition-colors focus:border-bz-teal outline-none"
              />
            </FieldShell>
          </div>

          <FieldShell label="Best time to call" className="mt-4.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {LP_CALL_WINDOWS.map((c) => (
                <Pill
                  key={c}
                  active={values.call_window === c}
                  onClick={() => setValue("call_window", c)}
                  className="h-11 justify-center"
                >
                  {LP_CALL_WINDOW_LABELS[c]}
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
            <span>
              I agree that Bazar Real Estate may contact me about this property
              by phone, WhatsApp and email.
            </span>
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
              Back
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 h-12 rounded bg-bz-accent text-bz-accent-fg text-[14.5px] font-medium transition-colors hover:bg-bz-accent-hover disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-teal"
            >
              {pending ? "Matching…" : "Match me with an advisor"}
            </button>
          </div>
        </div>
      </form>

      {step === 3 && confirmation ? (
        <Confirmed
          confirmation={confirmation}
          deskPhone={deskPhone}
          onAnother={startAnother}
        />
      ) : null}
    </div>
  );
}

/* ── step header ─────────────────────────────────────────────────── */

function StepHeader({ step }: { step: 1 | 2 | 3 }) {
  const tabs: [string, string][] = [
    ["01", "Your property"],
    ["02", "Your details"],
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
                className="ml-auto text-bz-success"
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
  onAnother,
}: {
  confirmation: Confirmation;
  deskPhone: string | null;
  onAnother: () => void;
}) {
  const { advisor } = confirmation;
  const firstName = advisor?.name.split(" ")[0] ?? null;
  const phone = advisor?.phone ?? deskPhone;
  const nextSteps: [string, string][] = [
    [
      "Today",
      `${firstName ?? "Your advisor"} calls to confirm the details and answer anything outstanding.`,
    ],
    [
      "Within 48 hours",
      "Free valuation visit, photography brief and a pricing recommendation.",
    ],
    [
      "Day 3–5",
      "Form A signed, listing goes live across Bazar and the UAE portals.",
    ],
  ];

  return (
    <div className="p-6 md:p-7">
      <div className="flex items-center gap-2.5">
        <span className="size-[30px] rounded-full bg-bz-accent-soft text-bz-accent inline-flex items-center justify-center shrink-0">
          <Check size={16} strokeWidth={2} />
        </span>
        <span className="eyebrow" style={{ color: "var(--bz-accent)" }}>
          Matched · reference {confirmation.reference}
        </span>
      </div>

      <h3
        className="serif text-[26px] md:text-[30px] mt-4 leading-[1.15]"
        style={{ letterSpacing: "-0.025em" }}
      >
        {firstName
          ? `${firstName} will call you ${confirmation.callPhrase}.`
          : `An advisor will call you ${confirmation.callPhrase}.`}
      </h3>
      <p className="text-[14px] text-bz-ink-2 mt-2.5 leading-relaxed">
        {confirmation.summary}
        {advisor
          ? " — assigned to the advisor who covers your community."
          : " — with the Abu Dhabi desk, who will put the right advisor on it."}
      </p>

      <div className="flex flex-wrap gap-3.5 items-center mt-6 p-4 border border-bz-border rounded-lg">
        <span className="size-[52px] rounded-full bg-bz-accent text-bz-accent-fg serif text-[18px] inline-flex items-center justify-center shrink-0">
          {advisor?.initials ?? "BZ"}
        </span>
        <div className="flex-1 min-w-[140px]">
          <div className="text-[15px] font-medium">
            {advisor?.name ?? "Bazar advisory desk"}
          </div>
          <div className="text-[12px] text-bz-muted mt-0.5">
            {[advisor?.title, formatLicence(advisor?.brn)]
              .filter(Boolean)
              .join(" · ") || "Abu Dhabi · Sell, rent and management"}
          </div>
        </div>
        {phone ? (
          <a
            href={`tel:${phone.replace(/\s+/g, "")}`}
            className="h-11 px-4 rounded border border-bz-border text-[13px] inline-flex items-center gap-2 hover:bg-bz-surface-2 transition-colors"
          >
            <Phone size={14} strokeWidth={1.7} />
            Call now
          </a>
        ) : null}
      </div>

      <div className="eyebrow mt-6">What happens next</div>
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
        className="mt-6 h-11 px-4 -ml-4 rounded text-[13px] text-bz-ink-2 hover:bg-bz-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-teal"
      >
        Submit another property
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
      label="Location"
      required
      htmlFor="lp-location"
      error={error}
      className="mt-6"
    >
      <div className="relative" ref={wrap}>
        <MapPin
          size={16}
          strokeWidth={1.6}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
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
          placeholder="Building, community or area"
          className="w-full h-11 rounded border border-bz-border bg-bz-surface pl-9 pr-3 text-[14px] transition-colors focus:border-bz-teal outline-none"
        />
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching areas"
            className="absolute top-[calc(100%+4px)] left-0 right-0 z-20 rounded border border-bz-border bg-bz-surface overflow-hidden"
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
                <span className="ml-auto text-[11px] text-bz-muted">
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
        {required ? <span className="text-bz-muted-2 ml-0.5">*</span> : null}
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
