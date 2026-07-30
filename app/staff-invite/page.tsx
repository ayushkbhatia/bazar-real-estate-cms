import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { ROLE_LABEL, type StaffRole } from "@/lib/schemas/staff";
import {
  linkState,
  linkStateMessage,
  type InvitationRow,
} from "@/lib/staff-invitations";
import { ActivateForm } from "./_form";
import { activateInvitation } from "./_actions";

export const metadata: Metadata = {
  title: "Activate your Bazar account",
  robots: { index: false, follow: false },
};

// The token is read per request and nothing here may be cached.
export const dynamic = "force-dynamic";

/**
 * Staff invitation acceptance.
 *
 * Deliberately NOT under /admin. That prefix is auth-gated in the proxy, and
 * the person opening this link has no session yet — putting the page there
 * would bounce them to the sign-in door they can't get through, which is a
 * version of the bug this route exists to fix.
 */
type PageProps = { searchParams: Promise<{ token?: string | string[] }> };

const FIELDS =
  "email, display_name, role, expires_at, accepted_at, activated_at";

// Keeps Date.now() out of the JSX render body so the React Compiler doesn't
// flag it as impure — same helper shape as the enquiry detail page.
function serverNow(): number {
  return Date.now();
}

export default async function StaffInvitePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  let invitation: InvitationRow | null = null;
  if (isSupabaseConfigured && token.length >= 10) {
    // Service role: RLS grants anonymous nothing on staff_invitations, and the
    // token is the credential.
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin
        .from("staff_invitations")
        .select(FIELDS)
        .eq("token", token)
        .maybeSingle();
      invitation = (data as InvitationRow | null) ?? null;
    }
  }

  const state = linkState(invitation, serverNow());

  return (
    <main className="min-h-dvh bg-bz-bg flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-[420px]">
        <div className="mb-8">
          <Wordmark />
        </div>
        <div className="bg-bz-surface border border-bz-border rounded-lg p-6 md:p-7">
          {state.usable && invitation ? (
            <ActivateForm
              token={token}
              email={invitation.email}
              displayName={invitation.display_name}
              roleLabel={
                ROLE_LABEL[invitation.role as StaffRole] ?? invitation.role
              }
              // By reference — see the note on the prop.
              activate={activateInvitation}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <h1 className="serif text-[26px] leading-tight">
                This link can&apos;t be used
              </h1>
              <p className="text-[13.5px] leading-relaxed text-bz-ink-2">
                {linkStateMessage(state.usable ? "unknown" : state.reason)}
              </p>
              <Link
                href="/admin/login"
                className="text-[13px] text-bz-accent hover:underline"
              >
                Go to staff sign-in →
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
