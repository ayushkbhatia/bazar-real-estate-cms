"use client";

import { useActionState } from "react";
import Link from "@/components/i18n/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestStaffPasswordLink,
  type ForgotPasswordState,
} from "./_actions";

const initial: ForgotPasswordState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestStaffPasswordLink,
    initial,
  );

  return (
    <div className="w-full max-w-[400px]">
      <Link href="/" className="inline-flex mb-8">
        <Wordmark sublabel="CMS" size="md" />
      </Link>

      <div className="rounded-xl border border-bz-border bg-bz-surface p-7 md:p-8">
        <Eyebrow>Staff access</Eyebrow>
        <h1
          className="serif text-[26px] md:text-[30px] font-normal mt-2 mb-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          Reset your password
        </h1>

        {state.status === "sent" ? (
          <>
            <p className="mt-4 text-[13.5px] leading-relaxed text-bz-ink-2">
              {state.message}
            </p>
            <p className="mt-4 text-[12.5px] text-bz-muted">
              Nothing arrived? Check spam, then ask an administrator to send you
              a link from the CMS.
            </p>
          </>
        ) : (
          <>
            <p className="text-[13px] text-bz-muted mb-6">
              We&apos;ll email you a single-use link to set a new password. Your
              current password keeps working until you use it.
            </p>
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@bazarrealestate.ae"
                  autoComplete="email"
                  required
                />
              </div>

              {state.status === "error" ? (
                <p className="text-[13px] text-[oklch(0.45_0.13_28)]">
                  {state.message}
                </p>
              ) : null}

              <Button type="submit" disabled={pending} className="mt-2">
                {pending ? "Sending…" : "Email me a link"}
              </Button>
            </form>
          </>
        )}
      </div>

      <p className="mt-6 text-center">
        <Link
          href="/admin/login"
          className="text-[12.5px] text-bz-muted hover:text-bz-ink underline"
        >
          Back to sign-in
        </Link>
      </p>
    </div>
  );
}
