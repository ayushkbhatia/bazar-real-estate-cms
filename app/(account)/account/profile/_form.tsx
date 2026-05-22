"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  accountProfileSchema,
  ACCOUNT_LANGUAGES,
  ACCOUNT_LANGUAGE_LABELS,
  ACCOUNT_RESIDENCY,
  ACCOUNT_RESIDENCY_LABELS,
  type AccountProfileInput,
} from "@/lib/schemas/account-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAccountProfileAction } from "./_actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-[12px] text-bz-danger mt-1">{message}</p>
  );
}

export function ProfileForm({ initial }: { initial: AccountProfileInput }) {
  const [pending, startTransition] = useTransition();
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountProfileInput>({
    resolver: zodResolver(accountProfileSchema),
    defaultValues: initial,
  });

  function onSubmit(values: AccountProfileInput) {
    setServerErrors({});
    startTransition(async () => {
      const result = await updateAccountProfileAction(values);
      if (result.status === "ok") {
        toast.success("Profile saved.");
      } else {
        if (result.fieldErrors) setServerErrors(result.fieldErrors);
        toast.error(result.message ?? "Could not save.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-5">
        <div>
          <Label htmlFor="first_name">First name</Label>
          <Input id="first_name" {...register("first_name")} />
          <FieldError
            message={errors.first_name?.message ?? serverErrors.first_name}
          />
        </div>
        <div>
          <Label htmlFor="last_name">Last name</Label>
          <Input id="last_name" {...register("last_name")} />
          <FieldError
            message={errors.last_name?.message ?? serverErrors.last_name}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="nationality">Nationality</Label>
        <Input
          id="nationality"
          placeholder="e.g. United Arab Emirates"
          {...register("nationality")}
        />
        <FieldError
          message={errors.nationality?.message ?? serverErrors.nationality}
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <Label htmlFor="preferred_language">Preferred language</Label>
          <select
            id="preferred_language"
            {...register("preferred_language")}
            className="mt-1.5 w-full h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[14px] focus:outline-none focus:border-bz-border-strong"
          >
            {ACCOUNT_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {ACCOUNT_LANGUAGE_LABELS[l]}
              </option>
            ))}
          </select>
          <FieldError
            message={
              errors.preferred_language?.message ??
              serverErrors.preferred_language
            }
          />
        </div>
        <div>
          <Label htmlFor="residency_status">Residency</Label>
          <select
            id="residency_status"
            {...register("residency_status")}
            className="mt-1.5 w-full h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[14px] focus:outline-none focus:border-bz-border-strong"
          >
            <option value="">Not specified</option>
            {ACCOUNT_RESIDENCY.map((r) => (
              <option key={r} value={r}>
                {ACCOUNT_RESIDENCY_LABELS[r]}
              </option>
            ))}
          </select>
          <FieldError
            message={
              errors.residency_status?.message ?? serverErrors.residency_status
            }
          />
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          {...register("marketing_opt_in")}
          className="mt-1"
        />
        <span>
          <span className="text-[14px] text-bz-ink">
            Subscribe to the Bazar Brief
          </span>
          <span className="block text-[12.5px] text-bz-muted mt-0.5 leading-relaxed max-w-[60ch]">
            One email every Wednesday with the week&apos;s deals, advisor notes,
            and a chart worth sitting with. Unsubscribe any time.
          </span>
        </span>
      </label>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
