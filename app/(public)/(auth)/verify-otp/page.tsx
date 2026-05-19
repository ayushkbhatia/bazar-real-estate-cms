"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { magicLinkAction, type AuthState } from "../_actions";

const initial: AuthState = { status: "idle" };

export default function VerifyOtpPage() {
  const [state, formAction, pending] = useActionState(magicLinkAction, initial);

  return (
    <div className="max-w-md mx-auto py-20 px-6">
      <Eyebrow>Magic link</Eyebrow>
      <h1
        className="serif text-[44px] font-normal mt-2 mb-4"
        style={{ letterSpacing: "-0.025em" }}
      >
        Sign in by email
      </h1>
      <p className="text-[14px] text-bz-muted mb-8">
        Enter your email and we&apos;ll send you a one-time link. No password
        required.
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        {state.status === "error" ? (
          <p className="text-[13px] text-[oklch(0.45_0.13_28)]">
            {state.message}
          </p>
        ) : null}
        {state.status === "success" ? (
          <p className="text-[13px] text-[oklch(0.35_0.08_145)]">
            {state.message}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="mt-2">
          {pending ? "Sending…" : "Send magic link"}
        </Button>
      </form>

      <p className="mt-8 text-[13px] text-bz-muted text-center">
        Prefer a password?{" "}
        <Link href="/sign-in" className="text-bz-ink underline">
          Sign in instead
        </Link>
      </p>
    </div>
  );
}
