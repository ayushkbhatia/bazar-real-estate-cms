"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Imported from the neutral module, not the customer auth route group — that
// group is being deleted with the customer-account surface, and the staff door
// must not go with it.
import { signInAction, type AuthState } from "@/app/_actions/auth";

const initial: AuthState = { status: "idle" };

/**
 * Staff-facing sign-in. Same server action as the customer page, but a
 * distinct, invite-only surface: no "create an account", and the hidden
 * `redirect` defaults staff into the CMS. `signInAction` looks up the staff
 * role and routes accordingly, so a non-staff user who lands here is quietly
 * sent to `/account` instead.
 */
export function StaffSignInForm({
  redirectTo,
  prefillEmail,
  justActivated,
}: {
  redirectTo?: string;
  /** Filled in after activating an invitation, so signing in is one field. */
  prefillEmail?: string;
  justActivated?: boolean;
}) {
  const [state, formAction, pending] = useActionState(signInAction, initial);

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
          Sign in to the admin panel
        </h1>
        {justActivated ? (
          <p className="mt-3 mb-6 rounded-md border border-bz-border bg-bz-surface-2 px-3 py-2.5 text-[13px] text-bz-ink-2">
            Your account is active. Sign in to open the admin panel.
          </p>
        ) : (
          <p className="text-[13px] text-bz-muted mb-7">
            For Bazar team members. Use the email your invitation was sent to.
          </p>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          {/* Deep-link back to the requested admin page after a bounce; the
              server action validates this and ignores it for non-staff. */}
          <input type="hidden" name="redirect" value={redirectTo ?? ""} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@bazar.ae"
              autoComplete="email"
              defaultValue={prefillEmail ?? ""}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-[12px] text-bz-muted hover:text-bz-ink"
              >
                Forgot?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {state.status === "error" ? (
            <p className="text-[13px] text-[oklch(0.45_0.13_28)]">
              {state.message}
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Signing in…" : "Sign in to admin"}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-[12.5px] text-bz-muted text-center leading-relaxed">
        Staff access is invite-only. Need an account?{" "}
        <span className="text-bz-ink-2">Ask an administrator to invite you.</span>
      </p>
      <p className="mt-3 text-center">
        <Link
          href="/sign-in"
          className="text-[12.5px] text-bz-muted hover:text-bz-ink underline"
        >
          Not staff? Customer sign-in
        </Link>
      </p>
    </div>
  );
}
