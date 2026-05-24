import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";

export default function ForgotPasswordPage() {
  return (
    <div className="max-w-md mx-auto py-20 px-6">
      <Eyebrow>Reset</Eyebrow>
      <h1
        className="serif text-[44px] font-normal mt-2 mb-4"
        style={{ letterSpacing: "-0.025em" }}
      >
        Forgot your password?
      </h1>
      <p className="text-[14px] text-bz-muted mb-8">
        Use the magic link option for now — we&apos;ll send a one-time link to
        your inbox. Full password reset lands once Supabase is wired in Phase 1.
      </p>
      <Link
        href="/magic-link"
        className="inline-flex items-center justify-center h-10 px-4 rounded bg-bz-accent text-bz-accent-fg text-[13.5px] font-medium hover:bg-bz-accent-hover transition-colors"
      >
        Go to magic link sign-in
      </Link>
    </div>
  );
}
