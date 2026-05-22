"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/schemas/reset-password";

type ActionResult =
  | { status: "ok" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Record<string, string>;
    };

/**
 * Sprint 2 ships the UI shell; Sprint 11 wires the real token-exchange flow
 * via Supabase `auth.updateUser({ password })` after the magic-link callback
 * sets the session. For now the form validates locally and tells the user
 * full reset lands in Sprint 11.
 */
export async function resetPasswordAction(
  input: ResetPasswordInput,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string") fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Check the fields.", fieldErrors };
  }

  if (!isSupabaseConfigured) {
    return {
      status: "error",
      message: "Backend not configured.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Without an active session (the recovery link should establish one),
  // the real update can't run. Sprint 11 ships /auth/callback to set the
  // session from the recovery token before this action fires.
  if (!user) {
    return {
      status: "error",
      message:
        "Recovery link expired or session not yet established. Request a new link from /forgot-password.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      status: "error",
      message: error.message ?? "Could not update password.",
    };
  }

  redirect("/sign-in?reset=ok");
}
