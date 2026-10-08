import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DraftDeps } from "./drafts";
import { MortgageApiError } from "./errors";
import { supabaseStorage } from "./storage";

/**
 * The real dependencies for the mortgage module's server code, from the
 * environment. Route handlers and crons call this; tests build their own.
 */
export function mortgageDeps(): DraftDeps {
  const db = createAdminClient();
  if (!db) throw new MortgageApiError(503, "not_configured");
  return { db, storage: supabaseStorage(db), now: () => new Date() };
}
