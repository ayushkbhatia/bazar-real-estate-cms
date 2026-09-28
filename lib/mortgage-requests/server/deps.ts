import "server-only";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DraftDeps } from "./drafts";
import { MortgageApiError } from "./errors";
import { clamdScanner, devScanner, type Scanner } from "./scan";
import { supabaseStorage } from "./storage";

/**
 * The real dependencies for the mortgage module's server code, from the
 * environment. Route handlers and crons call this; tests build their own.
 */
export function mortgageDeps(): DraftDeps {
  const db = createAdminClient();
  if (!db) throw new MortgageApiError(503, "not_configured");
  return { db, storage: supabaseStorage(db), scanner: scannerFromEnv(), now: () => new Date() };
}

/**
 * Which scanner runs (decision D6). A configured ClamAV daemon wins. The dev
 * scanner runs locally by default, and on preview or staging deployments
 * when MORTGAGE_SCANNER=dev asks for it — never on the production deployment,
 * where no scanner means files wait, unopenable (fail closed).
 */
export function scannerFromEnv(
  e: Pick<typeof env, "MORTGAGE_SCANNER" | "MORTGAGE_CLAMD_HOST" | "MORTGAGE_CLAMD_PORT" | "NODE_ENV" | "VERCEL_ENV"> = env,
): Scanner | null {
  if (e.MORTGAGE_SCANNER === "clamd" && e.MORTGAGE_CLAMD_HOST) {
    return clamdScanner({ host: e.MORTGAGE_CLAMD_HOST, port: Number(e.MORTGAGE_CLAMD_PORT ?? "3310") });
  }
  if (e.VERCEL_ENV === "production") return null;
  if (e.MORTGAGE_SCANNER === "dev" || e.NODE_ENV !== "production") return devScanner;
  return null;
}
