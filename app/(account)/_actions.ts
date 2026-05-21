"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { filterParsers, type PropertyFilters } from "@/lib/filters/property";
import { PROPERTY_MODES } from "@/lib/schemas/property";
import type { Database } from "@/db/types";

type Json = Database["public"]["Tables"]["saved_searches"]["Insert"]["query"];
type PropertyMode = Database["public"]["Enums"]["property_mode"];

export type ToggleSavedResult =
  | { status: "ok"; saved: boolean }
  | { status: "auth_required" }
  | { status: "error"; message: string };

export async function toggleSavedProperty(
  propertyId: string,
): Promise<ToggleSavedResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "auth_required" };

  // Check if already saved.
  const { data: existing } = await supabase
    .from("saved_properties")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("saved_properties")
      .delete()
      .eq("user_id", user.id)
      .eq("property_id", propertyId);
    if (error) return { status: "error", message: error.message };
    revalidatePath("/account/saved");
    return { status: "ok", saved: false };
  }

  const { error } = await supabase
    .from("saved_properties")
    .insert({ user_id: user.id, property_id: propertyId });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/account/saved");
  return { status: "ok", saved: true };
}

const saveSearchSchema = z.object({
  name: z.string().min(1).max(80),
  mode: z.enum(PROPERTY_MODES).nullable(),
  query: z.record(z.string(), z.unknown()),
  alert_frequency: z
    .enum(["off", "instant", "daily", "weekly"])
    .default("off"),
});

export type SaveSearchResult =
  | { status: "ok"; id: string }
  | { status: "auth_required" }
  | { status: "error"; message: string };

export async function saveCurrentSearch(input: {
  name: string;
  mode: PropertyMode | null;
  filters: PropertyFilters;
  alert_frequency?: "off" | "instant" | "daily" | "weekly";
}): Promise<SaveSearchResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "auth_required" };

  // Only persist the filters that are actually set, to keep the query
  // payload small and the diff clean.
  const queryClean: Record<string, unknown> = {};
  for (const key of Object.keys(filterParsers) as (keyof PropertyFilters)[]) {
    const v = input.filters[key];
    if (v !== null && v !== undefined && v !== "") queryClean[key] = v;
  }

  const parsed = saveSearchSchema.safeParse({
    name: input.name,
    mode: input.mode,
    query: queryClean,
    alert_frequency: input.alert_frequency ?? "off",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      mode: parsed.data.mode,
      query: parsed.data.query as unknown as Json,
      alert_frequency: parsed.data.alert_frequency,
    })
    .select("id")
    .maybeSingle();

  if (error || !data)
    return { status: "error", message: error?.message ?? "Failed to save." };

  revalidatePath("/account/saved");
  return { status: "ok", id: data.id };
}

export type DeleteSavedSearchResult =
  | { status: "ok" }
  | { status: "auth_required" }
  | { status: "error"; message: string };

export async function deleteSavedSearch(
  id: string,
): Promise<DeleteSavedSearchResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "auth_required" };

  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/account/saved");
  return { status: "ok" };
}
