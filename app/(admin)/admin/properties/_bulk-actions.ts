"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { applyBulkUpdate, type BulkUpdateClient } from "@/lib/bulk/update";
import {
  type BulkInput,
  type BulkUpdateResult,
} from "@/lib/bulk/patch-schema";

/**
 * Server-action wrapper around `applyBulkUpdate`. The pure update helper
 * lives in `lib/bulk/update.ts` so the RLS-skip logic is unit-testable
 * with a mock client.
 *
 * Revalidates the admin properties index after every successful change so
 * the table reflects the new state on the next render. Public-side paths
 * are only invalidated when the patch touches `status` — most bulk patches
 * (e.g. agent reassignment) don't change the public surface.
 */
export async function bulkUpdateProperties(
  input: BulkInput,
): Promise<BulkUpdateResult> {
  if (!isSupabaseConfigured) {
    return {
      status: "error",
      message:
        "Supabase env vars are not set. Configure NEXT_PUBLIC_SUPABASE_URL + ANON in .env.local.",
    };
  }

  const supabase = await createSupabaseServerClient();
  // The Supabase generated client type is structurally compatible with
  // BulkUpdateClient, but the deeply-typed PostgrestFilterBuilder triggers
  // ts2589 here. Cast through unknown — the runtime contract is honoured.
  const client = supabase as unknown as BulkUpdateClient;
  const result = await applyBulkUpdate(client, input, logAudit);

  if (result.status === "ok" && result.succeeded.length > 0) {
    revalidatePath("/admin/properties");
    if (input.patch.status !== undefined) {
      revalidatePath("/buy");
      revalidatePath("/rent");
      revalidatePath("/");
    }
  }

  return result;
}
