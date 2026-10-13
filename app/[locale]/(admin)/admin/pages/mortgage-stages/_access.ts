import "server-only";
import { getCurrentStaffRow, getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Where the stages are kept, and where they show. Both revalidate after every change. */
export const STAGES_ADMIN_PATH = "/admin/pages/mortgage-stages";
export const MORTGAGE_BOARD_PATH = "/admin/mortgages";

/**
 * The caller, when they may keep the mortgage stages: active staff for whom
 * `mortgage_can_edit_stages()` (0158) is true — Pages & blocks' editors
 * (admin, editor, marketing) and the Head of mortgages. Asked of the database
 * through the caller's own session, so it decides; null for anyone else.
 */
export async function stageEditorSession() {
  if (!isSupabaseConfigured) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  const staff = await getCurrentStaffRow();
  if (!staff || staff.status !== "active") return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("mortgage_can_edit_stages");
  if (error || data !== true) return null;
  return { user, staff, supabase };
}

/** For a link to the screen: never throws, false when in doubt. */
export async function canEditMortgageStages(): Promise<boolean> {
  try {
    return (await stageEditorSession()) !== null;
  } catch {
    return false;
  }
}
