"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  propertyEditSchema,
  normaliseEditInput,
} from "@/lib/schemas/property";
import { propertyUrl } from "@/lib/queries/properties";

export type SaveResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export async function updateProperty(
  id: string,
  raw: Record<string, unknown>,
): Promise<SaveResult> {
  if (!isSupabaseConfigured)
    return {
      status: "error",
      message:
        "Supabase env vars are not set. Configure NEXT_PUBLIC_SUPABASE_URL + ANON in .env.local.",
    };

  const normalised = normaliseEditInput(raw);
  const parsed = propertyEditSchema.safeParse(normalised);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Please fix the errors below.", fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .update(parsed.data)
    .eq("id", id)
    .select("slug, reference, status")
    .maybeSingle();

  if (error) {
    return { status: "error", message: error.message };
  }
  if (!data) {
    return {
      status: "error",
      message:
        "Property not found, or your account is not allowed to edit it.",
    };
  }

  // Revalidate paths affected by this change.
  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  if (data.status === "published") {
    revalidatePath(propertyUrl(data));
    revalidatePath("/buy");
    revalidatePath("/rent");
    revalidatePath("/");
  }

  return { status: "ok", message: "Saved." };
}
