"use server";

import { z } from "zod";
import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { absoluteUrl } from "@/lib/site-url";
/**
 * Sign-in and sign-out moved to app/_actions/auth.ts so the staff door does not
 * depend on this route group, which is scheduled for deletion with the
 * customer-account surface. They are re-exported here so the three protected
 * brand components that import them (account-menu, cms-user-pile,
 * public-mega-nav-mobile) keep working untouched — repointing those needs the
 * do-not-edit exemption named in the removal plan, §2a.
 */
import {
  signInAction as signIn,
  signOutAction as signOut,
  type AuthState,
} from "@/app/_actions/auth";

export type { AuthState };

/**
 * Thin pass-throughs, not re-exports: a "use server" module may only export
 * async functions declared in it, so `export { x } from "..."` compiles to a
 * module with no exports at all and every importer breaks at build time.
 *
 * These exist so the three protected brand components that import from this
 * path (account-menu, cms-user-pile, public-mega-nav-mobile) keep working
 * untouched. Repointing them at @/app/_actions/auth needs the do-not-edit
 * exemption named in the removal plan, §2a — at which point these two
 * wrappers, and this whole module, go.
 */
export async function signInAction(
  prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  return signIn(prev, formData);
}

export async function signOutAction(): Promise<void> {
  return signOut();
}

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const magicLinkSchema = z.object({
  email: z.string().email(),
});


function notConfiguredState(): AuthState {
  return {
    status: "error",
    message:
      "Auth is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
  };
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured) return notConfiguredState();

  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fill all fields. Password must be at least 8 characters.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Without this, Supabase builds the confirmation link from the project's
      // Site URL alone — one static host for every environment. Deriving it
      // from the live request means a preview deployment confirms back to
      // itself instead of sending the user to production (or, as configured
      // until now, to localhost).
      //
      // The target must appear in the project's redirect allow-list, or
      // Supabase silently falls back to Site URL.
      emailRedirectTo: await absoluteUrl("/auth/callback?type=signup"),
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
      },
    },
  });
  if (error) return { status: "error", message: error.message };

  return {
    status: "success",
    message: "Check your email to confirm your account.",
  };
}

export async function magicLinkAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured) return notConfiguredState();

  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // Same reasoning as sign-up. This is also the password-recovery route —
      // /forgot-password sends people here — so a broken link here means no
      // way back into an account.
      emailRedirectTo: await absoluteUrl("/auth/callback?type=magiclink"),
    },
  });
  if (error) return { status: "error", message: error.message };

  return {
    status: "success",
    message: "Magic link sent — check your email.",
  };
}
