/**
 * What makes a mortgage request a SAMPLE (scripts/mortgage-demo/README.md): a
 * BZM-yy-9xxx reference, which the reference counter won't reach, and an
 * applicant at @example.com, which can't receive mail. Both, never one: the
 * upload and clear scripts act on nothing else.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SAMPLE_REFERENCE = /^BZM-\d{2}-9\d{3}$/;

export function isSample(row: { reference: string; email: string }): boolean {
  return SAMPLE_REFERENCE.test(row.reference) && row.email.toLowerCase().endsWith("@example.com");
}

/** The service-role client for the stack the environment names (.env.local for production). */
export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error("needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The sample requests on that stack. */
export async function sampleRequests(db: SupabaseClient): Promise<{ id: string; reference: string; full_name: string }[]> {
  const { data, error } = await db
    .from("mortgage_requests")
    .select("id, reference, email, full_name")
    .like("reference", "BZM-__-9%")
    .order("reference");
  if (error) throw new Error(`requests read failed: ${error.message}`);
  return ((data ?? []) as { id: string; reference: string; email: string; full_name: string }[]).filter(isSample);
}
