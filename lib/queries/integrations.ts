/**
 * Integration status registry — the rows are seeded in migration 0024
 * (one per integration kind). Admin toggles status + sets last_synced_at
 * via the /admin/settings/integrations panel.
 *
 * Credentials NEVER live here — they read from env via `lib/env.ts`.
 * The `config` jsonb stores tuning knobs only (dataset IDs, rate limits,
 * feature toggles).
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Json } from "@/db/types";
import type {
  IntegrationKind,
  IntegrationRow,
  IntegrationStatus,
} from "@/lib/types/sprint-8";

/** All integrations, ordered by kind. */
export async function listIntegrations(): Promise<IntegrationRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("integrations")
      .select("*")
      .order("kind", { ascending: true });
    return (data as IntegrationRow[] | null) ?? [];
  } catch {
    return [];
  }
}

/** One integration by kind. */
export async function getIntegration(
  kind: IntegrationKind,
): Promise<IntegrationRow | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("integrations")
      .select("*")
      .eq("kind", kind)
      .maybeSingle();
    return (data as IntegrationRow | null) ?? null;
  } catch {
    return null;
  }
}

/** Update status + last sync metadata. Called by the cron sync routines. */
export async function setIntegrationStatus(
  kind: IntegrationKind,
  update: {
    status?: IntegrationStatus;
    last_synced_at?: string | null;
    last_error?: string | null;
    last_error_at?: string | null;
    config?: Record<string, unknown>;
    enabled?: boolean;
  },
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const sb = await createSupabaseServerClient();
    // `config` is a jsonb column, so the generated type is `Json`. The
    // caller-facing shape is the friendlier Record<string, unknown>; narrow
    // it here rather than pushing Json onto every call site. Only spread the
    // key when it was supplied, so an omitted config isn't written as null.
    const { config, ...rest } = update;
    const { error } = await sb
      .from("integrations")
      .update({
        ...rest,
        ...(config !== undefined && { config: config as Json }),
      })
      .eq("kind", kind);
    if (error) {
      console.error("[setIntegrationStatus]", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[setIntegrationStatus]", e);
    return false;
  }
}

/** Mark a sync attempt as successful. */
export async function markIntegrationSynced(
  kind: IntegrationKind,
): Promise<boolean> {
  return setIntegrationStatus(kind, {
    status: "connected",
    last_synced_at: new Date().toISOString(),
    last_error: null,
    last_error_at: null,
  });
}

/** Mark a sync attempt as failed. */
export async function markIntegrationError(
  kind: IntegrationKind,
  message: string,
): Promise<boolean> {
  return setIntegrationStatus(kind, {
    status: "error",
    last_error: message,
    last_error_at: new Date().toISOString(),
  });
}
