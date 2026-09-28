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

export type TestStaff = { id: string; client: SupabaseClient };

/**
 * A signed-in staff member on the local stack: an auth user, a staff row with
 * this role and mortgage role, and a client carrying their session — so RLS and
 * the functions' role checks run exactly as they would for a real login.
 */
export async function createTestStaff(
  stack: LocalStack,
  service: SupabaseClient,
  role: "support" | "admin" | "agent",
  mortgageRole: "head" | "adviser" | null,
): Promise<TestStaff> {
  const email = `staff-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const password = crypto.randomUUID();
  const { data: created, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(error.message);
  const id = created.user!.id;
  const { error: staffError } = await service.from("staff").insert({
    user_id: id,
    display_name: `Test ${role} ${mortgageRole ?? ""}`.trim(),
    slug: `test-${id.slice(0, 8)}`,
    role,
    status: "active",
    mortgage_role: mortgageRole,
  });
  if (staffError) throw new Error(staffError.message);
  const { data: session, error: signInError } = await client(stack, stack.anonKey).auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(signInError.message);
  return {
    id,
    client: createClient(stack.apiUrl, stack.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${session.session!.access_token}` } },
    }),
  };
}
