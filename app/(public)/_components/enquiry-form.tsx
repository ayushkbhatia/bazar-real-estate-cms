"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { toast } from "sonner";
import {
  enquirySchema,
  type EnquiryInput,
  ENQUIRY_SOURCES,
} from "@/lib/schemas/enquiry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createEnquiry } from "../_actions";

type Source = (typeof ENQUIRY_SOURCES)[number];

type Props = {
  source: Source;
  propertyId?: string | null;
  propertyReference?: string | null;
  defaultName?: string;
  defaultEmail?: string;
  /** Toggle the "intent" segmented control (contact page only). */
  showIntent?: boolean;
  /** Tighter copy + layout when rendered inside the property-page sidebar. */
  compact?: boolean;
  className?: string;
};

const INTENT_LABELS: Record<
  NonNullable<EnquiryInput["intent"]>,
  string
> = {
  buy: "Buy",
  sell: "Sell",
  rent: "Rent",
  invest: "Invest",
  manage: "Manage",
};

const INTENT_VALUES: NonNullable<EnquiryInput["intent"]>[] = [
  "buy",
  "sell",
  "rent",
  "invest",
  "manage",
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{message}</span>
  );
}

export function EnquiryForm({
  source,
  propertyId,
  propertyReference,
  defaultName,
  defaultEmail,
  showIntent,
  compact,
  className,
}: Props) {
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
  } = useForm<EnquiryInput>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      name: defaultName ?? "",
      email: defaultEmail ?? "",
      phone: "",
      message: propertyReference
        ? `I'd like to know more about ${propertyReference}.`
        : "",
      source,
      property_id: propertyId ?? null,
      intent: null,
    },
  });

  const intent = watch("intent");

  const onSubmit = (values: EnquiryInput) => {
    setServerFieldErrors({});
    startTransition(async () => {
      const result = await createEnquiry(values);
      if (result.status === "ok") {
        setDone(true);
        toast.success("Enquiry sent — we'll be in touch within 2 hours.");
        reset();
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
          "bg-bz-accent-soft text-bz-accent rounded-lg p-5",
          className,
        )}
      >
        <div className="font-medium text-[14px]">Thank you.</div>
        <p className="text-[13px] mt-1.5 leading-relaxed text-bz-ink-2">
          We&apos;ve received your brief. An advisor will reach out within
          2 hours during business hours, and by next morning otherwise.
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
      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-2")}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enq-name">Name</Label>
          <Input
            id="enq-name"
            {...register("name")}
            autoComplete="name"
            placeholder="Full name"
          />
          <FieldError
            message={errors.name?.message ?? serverFieldErrors.name}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enq-phone">Phone</Label>
          <Input
            id="enq-phone"
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
        <Label htmlFor="enq-email">Email</Label>
        <Input
          id="enq-email"
          type="email"
          {...register("email")}
          autoComplete="email"
          placeholder="you@example.com"
        />
        <FieldError
          message={errors.email?.message ?? serverFieldErrors.email}
        />
      </div>

      {showIntent ? (
        <div className="flex flex-col gap-1.5">
          <Label>I&apos;m looking to</Label>
          <div className="flex flex-wrap gap-1.5">
            {INTENT_VALUES.map((v) => {
              const active = intent === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setValue("intent", active ? null : v, {
                      shouldDirty: true,
                    })
                  }
                  className={cn(
                    "h-9 px-3 rounded text-[13px] border transition-colors",
                    active
                      ? "bg-bz-ink text-bz-bg border-bz-ink"
                      : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-border-strong",
                  )}
                  aria-pressed={active}
                >
                  {INTENT_LABELS[v]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enq-message">
          {compact ? "Message" : "Tell us more"}
        </Label>
        <textarea
          id="enq-message"
          {...register("message")}
          rows={compact ? 3 : 5}
          className="border border-bz-border rounded p-2 text-[14px] bg-bz-surface focus:border-bz-ink-2 outline-none resize-y"
          placeholder={
            compact
              ? "What would you like to know?"
              : "Tell us about your brief — area, budget, timeline."
          }
        />
        <FieldError
          message={errors.message?.message ?? serverFieldErrors.message}
        />
      </div>

      <Button type="submit" disabled={pending} className="mt-1">
        <Send size={14} strokeWidth={1.8} />
        {pending ? "Sending…" : compact ? "Send enquiry" : "Send brief"}
      </Button>
      <p className="text-[11.5px] text-bz-muted -mt-1">
        By submitting you agree to be contacted by a Bazar advisor.
      </p>
    </form>
  );
}
