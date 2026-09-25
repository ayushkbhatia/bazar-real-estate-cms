"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { runListingSync, type SyncSummary } from "@/lib/salesforce/listings/sync";
import {
  agentKey,
  developerKey,
  locationKey,
} from "@/lib/salesforce/listings/plan";
import type { Unresolved } from "@/lib/salesforce/listings/plan";
import { allRows } from "@/lib/salesforce/listings/paginate";

/**
 * Every write on the Salesforce listings screen.
 *
 * The mirror tables grant staff SELECT and nothing else, so these run with the
 * service role — after `requireRole` has decided the caller may. Approving,
 * hiding and mapping are editorial calls an editor makes every day; pausing
 * the sync and switching auto-publish change what reaches the public site
 * without a human looking, and are admin-only.
 *
 * Each action re-applies the listings it touched from their stored snapshots,
 * so the answer is on the website by the time the toast appears — not after
 * the next fifteen-minute sweep.
 */

const EDIT_ROLES = ["admin", "editor"] as const;
const ADMIN_ROLES = ["admin"] as const;

export type ActionResult = { status: "ok"; message: string } | { status: "error"; message: string };

const SF_ID = /^[a-zA-Z0-9]{18}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function outcome(summary: SyncSummary, done: string): ActionResult {
  if (summary.skipped === "busy") {
    return {
      status: "ok",
      message: `${done} A sync was running, so the website picks this up when it next runs — within fifteen minutes.`,
    };
  }
  if (!summary.ok) {
    return { status: "error", message: `${done} But the re-apply failed: ${summary.errors[0] ?? "unknown error"}` };
  }
  return { status: "ok", message: done };
}

function refresh(): void {
  revalidatePath("/admin/properties/salesforce");
  revalidatePath("/admin/properties");
}

export async function approveSalesforceListing(sfListingId: unknown): Promise<ActionResult> {
  const { user } = await requireRole(EDIT_ROLES);
  if (typeof sfListingId !== "string" || !SF_ID.test(sfListingId)) {
    return { status: "error", message: "Bad listing id." };
  }
  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "Service-role key is not configured." };

  const { error } = await admin
    .from("salesforce_listings")
    .update({
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      hidden_at: null,
      hidden_by: null,
    })
    .eq("sf_listing_id", sfListingId);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "salesforce.listing_approved",
    target_kind: "salesforce_listing",
    target_id: sfListingId,
    before: null,
    after: null,
  });
  const summary = await runListingSync({ trigger: "reapply", onlyStored: [sfListingId] });
  refresh();
  return outcome(summary, "Approved.");
}

export async function setSalesforceListingHidden(
  sfListingId: unknown,
  hidden: unknown,
): Promise<ActionResult> {
  const { user } = await requireRole(EDIT_ROLES);
  if (typeof sfListingId !== "string" || !SF_ID.test(sfListingId) || typeof hidden !== "boolean") {
    return { status: "error", message: "Bad request." };
  }
  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "Service-role key is not configured." };

  const { error } = await admin
    .from("salesforce_listings")
    .update(
      hidden
        ? { hidden_at: new Date().toISOString(), hidden_by: user.id }
        : { hidden_at: null, hidden_by: null },
    )
    .eq("sf_listing_id", sfListingId);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: hidden ? "salesforce.listing_hidden" : "salesforce.listing_allowed",
    target_kind: "salesforce_listing",
    target_id: sfListingId,
    before: null,
    after: null,
  });
  const summary = await runListingSync({ trigger: "reapply", onlyStored: [sfListingId] });
  refresh();
  return outcome(summary, hidden ? "Hidden from the website." : "Allowed back on the website.");
}

const KINDS = ["location", "developer", "agent"] as const;
type Kind = (typeof KINDS)[number];

/**
 * Answer "which of ours is this?" once, for every listing that asks it.
 *
 * The key is normalised exactly as the plan normalises it when it looks the
 * answer up, so "Yas Island, Abu Dhabi" and "yas island,  abu dhabi" are the
 * same question.
 */
export async function saveSalesforceMapping(input: {
  kind: unknown;
  source: unknown;
  targetId: unknown;
}): Promise<ActionResult> {
  const { user } = await requireRole(EDIT_ROLES);
  const kind = input.kind as Kind;
  if (!KINDS.includes(kind)) return { status: "error", message: "Bad mapping kind." };
  if (typeof input.targetId !== "string" || !UUID.test(input.targetId)) {
    return { status: "error", message: "Choose something to map it to." };
  }
  if (typeof input.source !== "string" || !input.source.trim() || input.source.length > 300) {
    return { status: "error", message: "Nothing to map." };
  }

  const source = input.source.trim();
  const key =
    kind === "location"
      ? locationKey(source)
      : kind === "developer"
        ? developerKey(source)
        : agentKey(
            source.startsWith("sf:")
              ? { email: null, id: source.slice(3) }
              : { email: source.toLowerCase(), id: null },
          );
  if (!key) return { status: "error", message: "That value cannot be mapped." };

  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "Service-role key is not configured." };

  const { error } = await admin.from("salesforce_mappings").upsert(
    { kind, source_key: key, target_id: input.targetId, created_by: user.id },
    { onConflict: "kind,source_key" },
  );
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "salesforce.mapping_saved",
    target_kind: "salesforce_mapping",
    target_id: `${kind}:${key}`,
    before: null,
    after: { kind, source, target_id: input.targetId },
  });

  // Every listing waiting on this answer, re-planned now.
  const rows = await allRows<{ sf_listing_id: string; unresolved: unknown }>((from, to) =>
    admin
      .from("salesforce_listings")
      .select("sf_listing_id, unresolved")
      .neq("state", "withdrawn")
      .order("sf_listing_id")
      .range(from, to),
  );
  const affected = rows
    .filter((r) => {
      const u = (r.unresolved ?? {}) as Unresolved;
      if (kind === "location") return !!u.location && locationKey(u.location) === key;
      if (kind === "developer") return !!u.developer && developerKey(u.developer) === key;
      return !!u.agent && agentKey(u.agent) === key;
    })
    .map((r) => r.sf_listing_id);

  if (affected.length === 0) {
    refresh();
    return { status: "ok", message: "Saved." };
  }
  const summary = await runListingSync({ trigger: "reapply", onlyStored: affected });
  refresh();
  return outcome(
    summary,
    `Saved, and applied to ${affected.length} listing${affected.length === 1 ? "" : "s"}.`,
  );
}

export async function syncSalesforceListingsNow(): Promise<ActionResult> {
  await requireRole(ADMIN_ROLES);
  const summary = await runListingSync({ trigger: "manual" });
  refresh();
  if (summary.skipped === "busy") {
    return { status: "ok", message: "A sync is already running. Refresh in a minute." };
  }
  if (summary.skipped === "no salesforce") {
    return { status: "error", message: "Salesforce credentials are not configured on this deployment." };
  }
  if (summary.skipped === "paused") {
    return { status: "error", message: "The sync is paused. Resume it first." };
  }
  if (!summary.ok) {
    return { status: "error", message: summary.errors[0] ?? "The sync failed." };
  }
  const parts = [
    `${summary.seen} published in Salesforce`,
    summary.created ? `${summary.created} new` : null,
    summary.published ? `${summary.published} put live` : null,
    summary.unpublished ? `${summary.unpublished} taken down` : null,
    summary.imagesCopied ? `${summary.imagesCopied} photos copied` : null,
  ].filter(Boolean);
  return { status: "ok", message: `Synced: ${parts.join(", ")}.` };
}

export async function updateListingSyncSettings(input: {
  paused?: unknown;
  autoPublish?: unknown;
  writeBack?: unknown;
}): Promise<ActionResult> {
  const { user } = await requireRole(ADMIN_ROLES);
  const patch: { paused?: boolean; auto_publish?: boolean; write_back?: boolean; updated_by: string } = {
    updated_by: user.id,
  };
  if (typeof input.paused === "boolean") patch.paused = input.paused;
  if (typeof input.autoPublish === "boolean") patch.auto_publish = input.autoPublish;
  if (typeof input.writeBack === "boolean") patch.write_back = input.writeBack;
  if (patch.paused === undefined && patch.auto_publish === undefined && patch.write_back === undefined) {
    return { status: "error", message: "Nothing to change." };
  }
  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "Service-role key is not configured." };
  const { error } = await admin.from("salesforce_listing_sync").update(patch).eq("id", 1);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "salesforce.listing_sync_settings",
    target_kind: "salesforce_listing_sync",
    target_id: "settings",
    before: null,
    after: { paused: patch.paused, auto_publish: patch.auto_publish, write_back: patch.write_back },
  });
  refresh();
  return {
    status: "ok",
    message:
      patch.paused !== undefined
        ? patch.paused
          ? "Paused. Nothing is fetched from Salesforce until you resume; approving, hiding and mapping here still apply."
          : "Resumed."
        : patch.write_back !== undefined
          ? patch.write_back
            ? "Write-back is on: each listing's website status, URL and reasons are sent to Salesforce on the next sync."
            : "Write-back is off: nothing is written to Salesforce."
          : patch.auto_publish
            ? "Auto-publish is on: a listing that passes every check goes live without approval."
            : "Auto-publish is off: new listings wait for approval.",
  };
}
