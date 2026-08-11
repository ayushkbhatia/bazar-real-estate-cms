"use client";

import { useId, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  serviceLeadSchema,
  type ServiceLeadInput,
  type ServiceLeadKind,
} from "@/lib/schemas/service-lead";
import { submitServiceLead } from "../_actions";

export type InterestOption = {
  label: string;
  intent: ServiceLeadInput["intent"];
};

export type ServiceLeadCopy = {
  title: string | null;
  sub: string | null;
  submitLabel: string | null;
  note: string | null;
  successTitle: string | null;
  successBody: string | null;
  /** Consultation only — the question above the interest buttons. */
  interestLabel?: string | null;
};

type Props = {
  kind: ServiceLeadKind;
  copy: ServiceLeadCopy;
  /** Management only — suggestions for the location field. */
  areas?: string[];
  /** Management only — the Property Type options. */
  propertyTypes?: readonly string[];
  /** Consultation only. */
  interestOptions?: InterestOption[];
  className?: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{message}</span>
  );
}

/**
 * The lead card on /services/manage and /services/consultation.
 *
 * One component for both: the contact block, the submit path and the
 * confirmation are identical, and only the qualification row differs — a
 * location + property type on the management form, a set of interest buttons
 * on the consultation one. Every string it renders comes from the master-page
 * editor; the inputs themselves don't, because their names, validation and
 * routing are behaviour rather than copy.
 */
export function ServiceLeadForm({
  kind,
  copy,
  areas,
  propertyTypes,
  interestOptions,
  className,
}: Props) {
  const uid = useId();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string>
  >({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<ServiceLeadInput>({
    resolver: zodResolver(serviceLeadSchema),
    defaultValues: {
      kind,
      name: "",
      phone: "",
      email: "",
      location: "",
      property_type: "",
      interest: "",
      intent: null,
      message: "",
    },
  });

  const interest = watch("interest");

  const onSubmit = (values: ServiceLeadInput) => {
    setServerFieldErrors({});
    startTransition(async () => {
      const result = await submitServiceLead(values);
      if (result.status === "ok") {
        setDone(true);
        reset({ ...values, name: "", phone: "", email: "", message: "" });
      } else {
        toast.error(result.message);
        if (result.fieldErrors) setServerFieldErrors(result.fieldErrors);
      }
    });
  };

  if (done) {
    return (
      <div
        className={cn(
          "rounded-xl border border-bz-border bg-bz-surface p-6 md:p-8",
          className,
        )}
      >
        <div className="serif text-[24px]" style={{ letterSpacing: "-0.015em" }}>
          {copy.successTitle ?? "Thank you — we have your details."}
        </div>
        <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed">
          {copy.successBody ??
            "One of our property consultants will be in contact with you shortly."}
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-5 text-[12.5px] text-bz-ink-2 underline underline-offset-4"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-bz-border bg-bz-surface p-6 md:p-8",
        className,
      )}
    >
      {copy.title ? (
        <h2
          className="serif text-[26px] md:text-[30px] leading-[1.1]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {copy.title}
        </h2>
      ) : null}
      {copy.sub ? (
        <p className="mt-2.5 text-[14px] text-bz-ink-2 leading-relaxed">
          {copy.sub}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-3.5 mt-6"
      >
        <input type="hidden" {...register("kind")} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-name`}>Full Name</Label>
          <Input
            id={`${uid}-name`}
            {...register("name")}
            autoComplete="name"
            placeholder="Full name"
          />
          <FieldError
            message={errors.name?.message ?? serverFieldErrors.name}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${uid}-phone`}>Phone Number</Label>
            <Input
              id={`${uid}-phone`}
              {...register("phone")}
              autoComplete="tel"
              inputMode="tel"
              placeholder="+971 50 …"
            />
            <FieldError
              message={errors.phone?.message ?? serverFieldErrors.phone}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${uid}-email`}>Email Address</Label>
            <Input
              id={`${uid}-email`}
              type="email"
              {...register("email")}
              autoComplete="email"
              placeholder="you@example.com"
            />
            <FieldError
              message={errors.email?.message ?? serverFieldErrors.email}
            />
          </div>
        </div>

        {kind === "management" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-location`}>Property Location</Label>
              <Input
                id={`${uid}-location`}
                {...register("location")}
                list={areas && areas.length > 0 ? `${uid}-areas` : undefined}
                placeholder="Community or building"
              />
              {/* A datalist, not a select: the list covers the communities we
                  have on file, and an owner whose building isn't on it still
                  has to be able to type it. */}
              {areas && areas.length > 0 ? (
                <datalist id={`${uid}-areas`}>
                  {areas.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              ) : null}
              <FieldError
                message={errors.location?.message ?? serverFieldErrors.location}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-type`}>Property Type</Label>
              <select
                id={`${uid}-type`}
                {...register("property_type")}
                className="h-9 rounded border border-bz-border bg-bz-surface px-2 text-[14px] outline-none focus:border-bz-accent"
              >
                <option value="">Select a type</option>
                {(propertyTypes ?? []).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <FieldError
                message={
                  errors.property_type?.message ??
                  serverFieldErrors.property_type
                }
              />
            </div>
          </div>
        ) : null}

        {kind === "consultation" && interestOptions?.length ? (
          <div className="flex flex-col gap-1.5">
            <Label>{copy.interestLabel ?? "I’m Interested In"}</Label>
            <div className="flex flex-wrap gap-1.5">
              {interestOptions.map((option) => {
                const active = interest === option.label;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => {
                      setValue("interest", active ? "" : option.label, {
                        shouldDirty: true,
                      });
                      setValue("intent", active ? null : option.intent, {
                        shouldDirty: true,
                      });
                    }}
                    className={cn(
                      "h-9 px-3.5 rounded text-[13px] border transition-colors",
                      active
                        ? "bg-bz-navy text-bz-bg border-bz-navy"
                        : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
                    )}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <FieldError
              message={errors.interest?.message ?? serverFieldErrors.interest}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-message`}>Message</Label>
          <textarea
            id={`${uid}-message`}
            {...register("message")}
            rows={4}
            className="border border-bz-border rounded p-2 text-[14px] bg-bz-surface focus:border-bz-accent outline-none resize-y"
            placeholder={
              kind === "management"
                ? "Anything we should know about the property or the tenancy?"
                : "Tell us what you're looking for."
            }
          />
          <FieldError
            message={errors.message?.message ?? serverFieldErrors.message}
          />
        </div>

        <Button type="submit" disabled={pending} className="mt-1">
          <Send size={14} strokeWidth={1.8} />
          {pending ? "Sending…" : (copy.submitLabel ?? "Send")}
        </Button>
        {copy.note ? (
          <p className="text-[11.5px] text-bz-muted -mt-1">{copy.note}</p>
        ) : null}
      </form>
    </div>
  );
}
