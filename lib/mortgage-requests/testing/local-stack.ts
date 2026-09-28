/**
 * The local Supabase stack the mortgage database tests run against
 * (`npm run db:local:reset`, then `npm run test:db`). Reads its address and
 * keys from the CLI rather than hard-coding them, and returns null when the
 * stack isn't running so the tests can skip with a message instead of failing.
 *
 * Never production: the workdir is scripts/db-local, whose config.toml only
 * describes the Docker stack.
 */

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
export const LOCAL_DB_CONTAINER = "supabase_db_bazar-local";

export type LocalStack = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

export function localStack(): LocalStack | null {
  try {
    const output = execFileSync(
      "supabase",
      ["status", "-o", "json", "--workdir", "scripts/db-local"],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 20_000 },
    );
    const json = output.slice(output.indexOf("{"), output.lastIndexOf("}") + 1);
    const status = JSON.parse(json) as Record<string, string>;
    if (!status.API_URL?.includes("127.0.0.1:55321")) return null;
    return {
      apiUrl: status.API_URL,
      anonKey: status.ANON_KEY,
      serviceRoleKey: status.SERVICE_ROLE_KEY,
    };
  } catch {
    return null;
  }
}

/** A client with no session, acting as the given key's role. */
export function client(stack: LocalStack, key: string): SupabaseClient {
  return createClient(stack.apiUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Run SQL as the database superuser, inside the container. Throws with psql's message on error. */
export function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", LOCAL_DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}
