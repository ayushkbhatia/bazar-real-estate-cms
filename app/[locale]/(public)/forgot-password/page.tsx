import type { Metadata } from "next";
import { ForgotPasswordForm } from "./_form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a sign-in link for your Bazar staff account.",
  // Same reasoning as /admin/login — never index a staff door.
  robots: { index: false, follow: false },
};

/**
 * Staff password recovery.
 *
 * Used to be a placeholder whose entire content was a button to /magic-link,
 * which is what actually did the work. Plan decision D10 retired the Supabase
 * mailer, so this page now issues the Resend-delivered token directly and
 * /magic-link is gone.
 *
 * Lives outside /admin on purpose: a locked-out staff member has no session,
 * and the proxy gates that prefix.
 */
export default function ForgotPasswordPage() {
  return (
    <main className="min-h-dvh bg-bz-bg flex items-center justify-center px-4 py-16">
      <ForgotPasswordForm />
    </main>
  );
}
