import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type SavedIdsResult = { ids: string[]; isAuthed: boolean };

export async function listSavedPropertyIdsForCurrentUser(): Promise<SavedIdsResult> {
  if (!isSupabaseConfigured) return { ids: [], isAuthed: false };
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ids: [], isAuthed: false };
    const { data, error } = await supabase
      .from("saved_properties")
      .select("property_id")
      .eq("user_id", user.id);
    if (error) return { ids: [], isAuthed: true };
    return { ids: (data ?? []).map((r) => r.property_id), isAuthed: true };
  } catch {
    return { ids: [], isAuthed: false };
  }
}
