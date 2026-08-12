"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { pickPostSignInPath } from "@/lib/auth-redirect";

/**
 * Sign-in and sign-out — shared by BOTH doors.
 *
 * These used to live in app/[locale]/(public)/(auth)/_actions.ts, which the staff login
 * form imported across route groups. That group is being deleted along with the
 * customer-account surface, so anything the staff door depends on had to move
 * somewhere neutral first: deleting the customer auth pages would otherwise
 * take staff sign-in down with them.
 *
 * Behaviour is unchanged. `pickPostSignInPath` still routes by role, so a staff
 * member signing in from either door lands in the CMS and everyone else does
 * not — see lib/auth-redirect.ts, which owns the open-redirect guard.
 */

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type AuthState = {
  status: "idle" | "error" | "success";
  message?: string;
};

function notConfiguredState(): AuthState {
  return {
    status: "error",
    message:
      "Auth is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
  };
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured) return notConfiguredState();

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { status: "error", message: error.message };

  // Route by role: active staff land in the CMS (/admin), everyone else in
  // their account. This is what lets a staff member sign in from either the
  // customer page or /admin/login and end up in the right place. An explicit
  // ?redirect is honoured only when safe and role-appropriate.
  const userId = signInData.user?.id;
  let isStaff = false;
  if (userId) {
    const { data: staffRow } = await supabase
      .from("staff")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    isStaff = staffRow?.status === "active";
  }
  const dest = pickPostSignInPath({
    isStaff,
    requested: formData.get("redirect") as string | null,
  });
  redirect(dest);
}

export async function signOutAction() {
  if (!isSupabaseConfigured) return;
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
