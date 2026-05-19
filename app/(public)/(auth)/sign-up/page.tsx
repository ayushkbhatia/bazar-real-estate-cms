"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction, type AuthState } from "../_actions";

const initial: AuthState = { status: "idle" };

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUpAction, initial);

  return (
    <div className="max-w-md mx-auto py-20 px-6">
      <Eyebrow>Create account</Eyebrow>
      <h1
        className="serif text-[44px] font-normal mt-2 mb-8"
        style={{ letterSpacing: "-0.025em" }}
      >
        Join Bazar
      </h1>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              required
            />
          </div>
        </div>
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <span className="text-[11.5px] text-bz-muted">At least 8 characters.</span>
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
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>

      <p className="mt-8 text-[13px] text-bz-muted text-center">
        Already have one?{" "}
        <Link href="/sign-in" className="text-bz-ink underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
