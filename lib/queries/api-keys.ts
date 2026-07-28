/**
 * API keys CRUD for /admin/settings/api.
 *
 * Plaintext keys are never stored. `createApiKey` returns the plaintext
 * once (so the UI can copy + display it) and persists only key_hash +
 * key_prefix. Verification (Sprint 13) hashes the inbound bearer token
 * and compares to key_hash.
 */

import { createHash, randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  ApiKeyRole,
  ApiKeyRow,
  ApiKeyStatus,
} from "@/lib/types/sprint-8";

export type ApiKeyDisplay = {
  id: string;
  name: string;
  key_prefix: string;
  role: ApiKeyRole;
  status: ApiKeyStatus;
  last_used_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
};

export type CreateApiKeyInput = {
  name: string;
  role: ApiKeyRole;
  expires_at?: string | null;
  notes?: string | null;
};

export type CreatedApiKey = {
  plaintext: string;       // shown ONCE
  display: ApiKeyDisplay;
};

/** List keys (without secrets). Admin-only via RLS. */
export async function listApiKeys(): Promise<ApiKeyDisplay[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("api_keys")
      .select(
        "id, name, key_prefix, role, status, last_used_at, expires_at, notes, created_at",
      )
      .order("created_at", { ascending: false });
    if (!data) return [];
    return (data as ApiKeyDisplay[]).slice();
  } catch {
    return [];
  }
}

/** Mint a new key. Returns plaintext exactly once. */
export async function createApiKey(
  input: CreateApiKeyInput,
  createdBy: string | null,
): Promise<CreatedApiKey | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const plaintext = generatePlaintext();
    const prefix = `bzk_${plaintext.slice(0, 6)}`;
    const hash = sha256(plaintext);
    const sb = await createSupabaseServerClient();
    const { data, error } = await sb
      .from("api_keys")
      .insert({
        name: input.name,
        key_prefix: prefix,
        key_hash: hash,
        role: input.role,
        status: "active",
        expires_at: input.expires_at ?? null,
        notes: input.notes ?? null,
        created_by: createdBy,
      })
      .select(
        "id, name, key_prefix, role, status, last_used_at, expires_at, notes, created_at",
      )
      .single();
    if (error || !data) {
      if (error) console.error("[createApiKey]", error);
      return null;
    }
    return {
      plaintext: `${prefix}.${plaintext}`,
      display: data as ApiKeyDisplay,
    };
  } catch (e) {
    console.error("[createApiKey]", e);
    return null;
  }
}

/** Revoke a key by id. Returns true on success. */
export async function revokeApiKey(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const sb = await createSupabaseServerClient();
    const { error } = await sb
      .from("api_keys")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Verify a bearer token. Returns the row when valid (and bumps last_used_at). */
export async function verifyApiKey(
  presented: string,
): Promise<ApiKeyRow | null> {
  if (!isSupabaseConfigured || !presented) return null;
  // Format: "bzk_xxxxxx.<plaintext>"
  const parts = presented.split(".");
  const plaintext = parts[1];
  if (!plaintext) return null;
  try {
    const hash = sha256(plaintext);
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("api_keys")
      .select("*")
      .eq("key_hash", hash)
      .eq("status", "active")
      .maybeSingle();
    const row = data as ApiKeyRow | null;
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
    // Bump last_used_at — best-effort.
    void sb
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id);
    return row;
  } catch {
    return null;
  }
}

function generatePlaintext(): string {
  return randomBytes(24).toString("base64url");
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
