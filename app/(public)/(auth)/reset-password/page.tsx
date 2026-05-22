import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { ResetPasswordForm } from "./_form";

export const metadata: Metadata = {
  title: "Set a new password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const tokenHint = params.token ? params.token.slice(0, 6) : null;

  return (
    <div className="px-12 py-20 max-w-[480px] mx-auto">
      <Eyebrow>Reset password</Eyebrow>
      <h1
        className="serif text-[40px] mt-2 font-normal leading-[1.05]"
        style={{ letterSpacing: "-0.02em" }}
      >
        Set a new password.
      </h1>
      <p className="mt-4 text-[14px] text-bz-muted">
        Pick something at least 10 characters long.
      </p>

      {tokenHint ? (
        <p className="mt-3 mono text-[11.5px] text-bz-muted">
          Token: …{tokenHint}
        </p>
      ) : null}

      <ResetPasswordForm />

      <p className="mt-10 text-[13px] text-bz-muted">
        Didn&apos;t request this?{" "}
        <Link
          href="/sign-in"
          className="text-bz-ink underline underline-offset-2 hover:text-bz-accent"
        >
          Sign in
        </Link>{" "}
        instead, or{" "}
        <Link
          href="/contact"
          className="text-bz-ink underline underline-offset-2 hover:text-bz-accent"
        >
          contact us
        </Link>
        .
      </p>
    </div>
  );
}
