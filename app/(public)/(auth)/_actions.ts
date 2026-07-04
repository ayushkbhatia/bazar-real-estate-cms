"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { pickPostSignInPath } from "@/lib/auth-redirect";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const magicLinkSchema = z.object({
  email: z.string().email(),
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
  });
  if (error) return { status: "error", message: error.message };

  return {
    status: "success",
    message: "Magic link sent — check your email.",
  };
}

export async function signOutAction() {
  if (!isSupabaseConfigured) return;
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
