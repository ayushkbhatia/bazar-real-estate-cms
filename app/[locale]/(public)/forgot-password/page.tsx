import type { Metadata } from "next";
import { localiseMetadata } from "@/lib/i18n/localise-metadata";
import { asLocale } from "@/lib/i18n/locales";
import { ForgotPasswordForm } from "./_form";

const METADATA: Metadata = {
  title: "Reset your password",
  description: "Request a sign-in link for your Bazar staff account.",
  // Same reasoning as /admin/login — never index a staff door.
  robots: { index: false, follow: false },
};

/** English as written above; Arabic from the site's store on /ar. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localiseMetadata(METADATA, asLocale((await params).locale));
}

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
