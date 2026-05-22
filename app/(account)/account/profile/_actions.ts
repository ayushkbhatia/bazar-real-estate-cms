"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  accountProfileSchema,
  normaliseAccountProfile,
  type AccountProfileInput,
} from "@/lib/schemas/account-profile";

type ActionResult =
  | { status: "ok" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Record<string, string>;
    };

export async function updateAccountProfileAction(
  input: AccountProfileInput,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) {
    return { status: "error", message: "Backend not configured." };
  }

  const parsed = accountProfileSchema.safeParse(
    normaliseAccountProfile(input as unknown as Record<string, unknown>),
  );
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string") fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Check the fields.", fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const { error } = await supabase
    .from("accounts")
    .update({
      first_name: parsed.data.first_name ?? null,
      last_name: parsed.data.last_name ?? null,
      nationality: parsed.data.nationality ?? null,
      preferred_language: parsed.data.preferred_language,
      residency_status: parsed.data.residency_status ?? null,
      marketing_opt_in: parsed.data.marketing_opt_in,
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("[updateAccountProfileAction]", error);
    return { status: "error", message: "Could not save changes." };
  }

  revalidatePath("/account/profile");
  return { status: "ok" };
}
