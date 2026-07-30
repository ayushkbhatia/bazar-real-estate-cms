"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { activateInvitation, type ActivateResult } from "./_actions";

export function ActivateForm({
  token,
  email,
  displayName,
  roleLabel,
  activate,
}: {
  token: string;
  email: string;
  displayName: string;
  roleLabel: string;
  /**
   * Passed by reference from the page — wrapping it in an arrow would make it
   * a plain function, which can't cross the server/client boundary.
   */
  activate: typeof activateInvitation;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    start(async () => {
      const result: ActivateResult = await activate({
        token,
        password,
        confirm,
      });
      if (result.status === "error") {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors ? null : result.message);
        return;
      }
      // Straight to the staff door with the address filled in, so signing in
      // is one field and a button.
      router.push(
        `/admin/login?invited=1&email=${encodeURIComponent(result.email)}`,
      );
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div>
        <Eyebrow>Activate your account</Eyebrow>
        <h1 className="serif mt-2 text-[32px] leading-tight">
          Welcome, {displayName.split(" ")[0]}.
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-bz-ink-2">
          You&apos;ve been invited to the Bazar admin console as{" "}
          <strong>{roleLabel}</strong>. Set a password to finish setting up{" "}
          <span className="mono text-[12.5px]">{email}</span>.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-bz-ink-2">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          className="border border-bz-border rounded p-2.5 text-[14px] bg-bz-surface focus:border-bz-accent outline-none"
        />
        {errors.password ? (
          <span className="text-[11.5px] text-[oklch(0.45_0.13_28)]">
            {errors.password}
          </span>
        ) : (
          <span className="text-[11.5px] text-bz-muted">
            At least 8 characters.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-bz-ink-2">
          Confirm password
        </span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          className="border border-bz-border rounded p-2.5 text-[14px] bg-bz-surface focus:border-bz-accent outline-none"
        />
        {errors.confirm ? (
          <span className="text-[11.5px] text-[oklch(0.45_0.13_28)]">
            {errors.confirm}
          </span>
        ) : null}
      </label>

      {formError ? (
        <p className="text-[12.5px] text-[oklch(0.45_0.13_28)]">{formError}</p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Activating…
          </>
        ) : (
          "Set password and continue"
        )}
      </Button>
    </form>
  );
}
