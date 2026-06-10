"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction, type AuthState } from "../_actions";

const initial: AuthState = { status: "idle" };

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(signInAction, initial);

  return (
    <div className="max-w-md mx-auto py-12 md:py-20 px-4 md:px-6">
      <Eyebrow>Welcome back</Eyebrow>
      <h1
        className="serif text-[30px] md:text-[44px] font-normal mt-2 mb-8"
        style={{ letterSpacing: "-0.025em" }}
      >
        Sign in to Bazar
      </h1>

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
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-8 flex items-center gap-3 text-[12px] text-bz-muted">
        <span className="flex-1 h-px bg-bz-border" />
        or
        <span className="flex-1 h-px bg-bz-border" />
      </div>

      <Link href="/magic-link">
        <Button variant="outline" className="w-full">
          Sign in with a magic link
        </Button>
      </Link>

      <p className="mt-8 text-[13px] text-bz-muted text-center">
        New to Bazar?{" "}
        <Link href="/sign-up" className="text-bz-ink underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
