"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/schemas/reset-password";
import { resetPasswordAction } from "./_actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[12px] text-bz-danger mt-1">{message}</p>;
}

export function ResetPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm_password: "" },
  });

  function onSubmit(values: ResetPasswordInput) {
    setServerErrors({});
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      if (result?.status === "error") {
        if (result.fieldErrors) setServerErrors(result.fieldErrors);
        toast.error(result.message ?? "Could not reset.");
      }
      // Success path redirects server-side.
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5 mt-8"
    >
      <div>
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        <FieldError
          message={errors.password?.message ?? serverErrors.password}
        />
      </div>
      <div>
        <Label htmlFor="confirm_password">Confirm new password</Label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          {...register("confirm_password")}
        />
        <FieldError
          message={
            errors.confirm_password?.message ?? serverErrors.confirm_password
          }
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
