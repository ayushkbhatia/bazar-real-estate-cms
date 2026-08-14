/**
 * Webhook subscriptions for /admin/settings/api.
 *
 * Outbound: when a domain event fires (property.published, etc.), the
 * dispatcher (Sprint 13) signs the payload with the row's `secret` via
 * HMAC-SHA256 and POSTs to `target_url`. Failures bump failure_count;
 * 5+ consecutive failures flip status → 'failing' (cron-managed).
 */

import { randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  WebhookEvent,
  WebhookRow,
  WebhookStatus,
} from "@/lib/types/sprint-8";

export type WebhookDisplay = {
  id: string;
  name: string;
  target_url: string;
  events: WebhookEvent[];
  status: WebhookStatus;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
  created_at: string;
};

export type CreateWebhookInput = {
  name: string;
  target_url: string;
  events: WebhookEvent[];
};

export type CreatedWebhook = {
  display: WebhookDisplay;
  secret: string; // shown ONCE in the admin UI
};

const DISPLAY_FIELDS =
  "id, name, target_url, events, status, last_success_at, last_failure_at, failure_count, created_at";

/** List subscriptions (no secret). Admin-only via RLS. */
export async function listWebhooks(): Promise<WebhookDisplay[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("webhooks")
      .select(DISPLAY_FIELDS)
      .order("created_at", { ascending: false });
    return (data as WebhookDisplay[] | null) ?? [];
  } catch {
    return [];
  }
}

/** Get one subscription including secret (used by dispatcher only). */
export async function getWebhookWithSecret(
  id: string,
): Promise<WebhookRow | null> {
  if (!isSupabaseConfigured || !id) return null;
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("webhooks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as WebhookRow | null) ?? null;
  } catch {
    return null;
  }
}

/** Active subscriptions matching an event (used by the dispatcher). */
export async function listWebhooksForEvent(
  event: WebhookEvent,
): Promise<WebhookRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("webhooks")
      .select("*")
      .eq("status", "active")
      .contains("events", [event]);
    return (data as WebhookRow[] | null) ?? [];
  } catch {
    return [];
  }
}

/** Create a new subscription. Returns the secret exactly once. */
export async function createWebhook(
  input: CreateWebhookInput,
  createdBy: string | null,
): Promise<CreatedWebhook | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const secret = `whsec_${randomBytes(24).toString("base64url")}`;
    const sb = await createSupabaseServerClient();
    const { data, error } = await sb
      .from("webhooks")
      .insert({
        name: input.name,
        target_url: input.target_url,
        events: input.events,
        secret,
        status: "active",
        created_by: createdBy,
      })
      .select(DISPLAY_FIELDS)
      .single();
    if (error || !data) {
      if (error) console.error("[createWebhook]", error);
      return null;
    }
    return { display: data as WebhookDisplay, secret };
  } catch (e) {
    console.error("[createWebhook]", e);
    return null;
  }
}

/** Pause / resume / mark failing. */
export async function setWebhookStatus(
  id: string,
  status: WebhookStatus,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const sb = await createSupabaseServerClient();
    const { error } = await sb.from("webhooks").update({ status }).eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Delete subscription. */
export async function deleteWebhook(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const sb = await createSupabaseServerClient();
    const { error } = await sb.from("webhooks").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
