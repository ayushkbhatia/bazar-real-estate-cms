"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createEnquiry } from "../../../_actions";

/**
 * The area guide's consultation form.
 *
 * It is its own component rather than a variant of the shared `EnquiryForm`
 * because the brief asks for two controls that form doesn't carry — property
 * type and budget band. Neither has a column on `enquiries`, so both are
 * folded into the brief text an advisor reads, and the budget band
 * additionally populates `budget_min` / `budget_max`, which do exist and drive
 * lead scoring. That keeps the whole thing migration-free.
 */

const INTENTS = [
  { value: "buy", label: "Buying" },
  { value: "rent", label: "Renting" },
  { value: "invest", label: "Investing" },
  { value: "sell", label: "Selling" },
] as const;

const PROPERTY_TYPES = [
  "Apartment",
  "Villa",
  "Townhouse",
  "Penthouse",
  "Plot / land",
  "Commercial",
] as const;

/** Bands in AED. `null` bounds mean open-ended on that side. */
const BUDGETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Under AED 1M", min: null, max: 1_000_000 },
  { label: "AED 1M – 2M", min: 1_000_000, max: 2_000_000 },
  { label: "AED 2M – 4M", min: 2_000_000, max: 4_000_000 },
  { label: "AED 4M – 8M", min: 4_000_000, max: 8_000_000 },
  { label: "AED 8M – 15M", min: 8_000_000, max: 15_000_000 },
  { label: "AED 15M+", min: 15_000_000, max: null },
];

const schema = z
  .object({
    name: z.string().min(2, "Name is too short").max(120, "Name is too long"),
    phone: z
      .union([z.string().min(5, "Phone is too short").max(32), z.literal("")])
      .optional(),
    email: z
      .union([z.string().email("Enter a valid email"), z.literal("")])
      .optional(),
    message: z.string().max(1600, "Trim it to under 1600 characters").optional(),
  })
  .refine((v) => (v.email && v.email.length > 0) || (v.phone && v.phone.length > 0), {
    message: "We need at least an email or a phone number",
    path: ["email"],
  });

type FormValues = z.infer<typeof schema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{message}</span>;
}

function Pills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (next: T | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(active ? null : option)}
              aria-pressed={active}
              className={cn(
                "h-9 px-3 rounded text-[13px] border transition-colors",
                active
                  ? "bg-bz-navy text-bz-bg border-bz-navy"
                  : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AreaLeadForm({
  areaName,
  submitLabel,
  className,
}: {
  areaName: string;
  submitLabel?: string | null;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [intent, setIntent] = useState<(typeof INTENTS)[number]["label"] | null>(
    null,
  );
  const [propertyType, setPropertyType] = useState<
    (typeof PROPERTY_TYPES)[number] | null
  >(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string>
  >({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", message: "" },
  });

  const onSubmit = (values: FormValues) => {
    setServerFieldErrors({});
    const band = BUDGETS.find((b) => b.label === budget) ?? null;
    const brief = [
      values.message?.trim() || null,
      `Area: ${areaName}`,
      intent ? `Looking to: ${intent}` : null,
      propertyType ? `Property type: ${propertyType}` : null,
      budget ? `Budget: ${budget}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    startTransition(async () => {
      const result = await createEnquiry({
        name: values.name,
        email: values.email ?? "",
        phone: values.phone ?? "",
        message: brief,
        source: "property_consultation",
        intent: INTENTS.find((i) => i.label === intent)?.value ?? null,
        budget_min: band?.min ?? null,
        budget_max: band?.max ?? null,
      });
      if (result.status === "ok") {
        setDone(true);
        toast.success("Request sent — an advisor will be in touch.");
        reset();
        setIntent(null);
        setPropertyType(null);
        setBudget(null);
      } else {
        toast.error(result.message);
        if (result.fieldErrors) setServerFieldErrors(result.fieldErrors);
      }
    });
  };

  if (done) {
    return (
      <div className={cn("bg-bz-accent-soft text-bz-accent rounded-lg p-5", className)}>
        <div className="font-medium text-[14px]">Thank you.</div>
        <p className="text-[13px] mt-1.5 leading-relaxed text-bz-ink-2">
          We&apos;ve received your brief for {areaName}. An advisor will reach
          out within 2 hours during business hours, and by next morning
          otherwise.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="text-[12.5px] text-bz-ink-2 underline mt-3"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn("flex flex-col gap-3.5", className)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="area-lead-name">Full name</Label>
          <Input
            id="area-lead-name"
            {...register("name")}
            autoComplete="name"
            placeholder="Full name"
          />
          <FieldError message={errors.name?.message ?? serverFieldErrors.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="area-lead-phone">Phone number</Label>
          <Input
            id="area-lead-phone"
            {...register("phone")}
            autoComplete="tel"
            placeholder="+971 50 …"
          />
          <FieldError
            message={errors.phone?.message ?? serverFieldErrors.phone}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="area-lead-email">Email address</Label>
        <Input
          id="area-lead-email"
          type="email"
          {...register("email")}
          autoComplete="email"
          placeholder="you@example.com"
        />
        <FieldError message={errors.email?.message ?? serverFieldErrors.email} />
      </div>

      <Pills
        label="I'm interested in"
        options={INTENTS.map((i) => i.label)}
        value={intent}
        onChange={setIntent}
      />
      <Pills
        label="Property type"
        options={PROPERTY_TYPES}
        value={propertyType}
        onChange={setPropertyType}
      />
      <Pills
        label="Budget"
        options={BUDGETS.map((b) => b.label)}
        value={budget}
        onChange={setBudget}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="area-lead-message">Message</Label>
        <textarea
          id="area-lead-message"
          {...register("message")}
          rows={4}
          className="border border-bz-border rounded p-2 text-[14px] bg-bz-surface focus:border-bz-accent outline-none resize-y"
          placeholder={`What are you looking for in ${areaName}?`}
        />
        <FieldError
          message={errors.message?.message ?? serverFieldErrors.message}
        />
      </div>

      <Button type="submit" disabled={pending} className="mt-1">
        <Send size={14} strokeWidth={1.8} />
        {pending ? "Sending…" : (submitLabel ?? "Request a free consultation")}
      </Button>
      <p className="text-[11.5px] text-bz-muted -mt-1">
        By submitting you agree to be contacted by a Bazar advisor.
      </p>
    </form>
  );
}
