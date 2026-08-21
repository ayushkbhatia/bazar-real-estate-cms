/**
 * Sprint 10 — enquiry-escalation cron.
 *
 * Runs every 5 minutes. Finds enquiries unassigned > 60 minutes old
 * and:
 *  - reassigns to the fallback agent (first active admin OR first
 *    active agent, deterministic) — until LeadRoutingForm in
 *    /admin/settings/routing has a `fallback_agent_id` setting
 *  - emits an in-app notification to all admins
 *  - sends the manager-facing enquiryEscalationTemplate email
 *  - flips `escalated_at` so we don't re-send
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { env, isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { enquiryEscalationTemplate } from "@/lib/email-templates";
import type { Database } from "@/db/types";

function adminClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Service-role Supabase not configured");
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, reason: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json(
      { ok: false, reason: "Unauthorized" },
      { status: 401 },
    );
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, scanned: 0, escalated: 0 });
  }

  try {
    const supabase = adminClient();
    const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: stale, error } = await supabase
      .from("enquiries")
      .select(
        "id, name, email, property_id, created_at, properties(reference, title)",
      )
      .is("assigned_agent_id", null)
      .is("escalated_at", null)
      // An archived lead was deliberately taken out of the working set;
      // escalating it to a manager an hour later undoes that decision.
      .is("archived_at", null)
      .lte("created_at", sixtyMinAgo);
    if (error) throw error;

    if (!stale || stale.length === 0) {
      return NextResponse.json({ ok: true, scanned: 0, escalated: 0 });
    }

    // Find fallback admin / agent. Deterministic by joined_at then name.
    const { data: managers } = await supabase
      .from("staff")
      .select("user_id, display_name, role")
      .eq("status", "active")
      .in("role", ["admin", "agent"])
      .order("role", { ascending: true })
      .order("joined_at", { ascending: true })
      .limit(5);

    const adminRows = (managers ?? []).filter((m) => m.role === "admin");
    const fallback =
      adminRows[0] ??
      (managers ?? []).find((m) => m.role === "agent") ??
      null;

    let escalated = 0;
    for (const row of stale) {
      const prop = Array.isArray(row.properties)
        ? row.properties[0]
        : row.properties;
      const minutes = Math.floor(
        (Date.now() - new Date(row.created_at).getTime()) / 60_000,
      );

      // 1) reassign (only when a fallback exists). If this fails, skip
      // the escalated_at flag too — otherwise the enquiry drops out of
      // every future scan while still unassigned. Leaving both unset
      // lets the next run retry.
      if (fallback) {
        const { error: reassignError } = await supabase
          .from("enquiries")
          .update({ assigned_agent_id: fallback.user_id })
          .eq("id", row.id);
        if (reassignError) {
          Sentry.captureException(reassignError, {
            tags: { cron: "enquiry-escalation", enquiry: row.id },
          });
          console.error(
            "[cron/enquiry-escalation] reassign failed",
            row.id,
            reassignError.message,
          );
          continue;
        }
      }

      // 2) flag escalated so we don't re-send
      const { error: flagError } = await supabase
        .from("enquiries")
        .update({ escalated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (flagError) {
        Sentry.captureException(flagError, {
          tags: { cron: "enquiry-escalation", enquiry: row.id },
        });
        console.error(
          "[cron/enquiry-escalation] escalated_at flag failed",
          row.id,
          flagError.message,
        );
        continue;
      }

      // 3) email each admin
      const recipients = adminRows
        .map((r) => r.user_id)
        .filter(Boolean) as string[];
      if (recipients.length > 0) {
        // resolve emails via auth admin API
        for (const adminRow of adminRows) {
          const { data: userRow } = await supabase.auth.admin.getUserById(
            adminRow.user_id,
          );
          const email = userRow?.user?.email;
          if (!email) continue;
          const tpl = enquiryEscalationTemplate({
            managerName: adminRow.display_name,
            leadName: row.name ?? "—",
            propertyReference: prop?.reference ?? null,
            enquiryId: row.id,
            minutesElapsed: minutes,
          });
          await sendEmail({
            to: email,
            subject: tpl.subject,
            text: tpl.text,
            html: tpl.html,
          });
        }
      }

      // 4) audit
      await supabase.from("audit_log").insert({
        actor_kind: "system",
        action: "enquiry.escalated_60min",
        target_kind: "enquiry",
        target_id: row.id,
      });

      escalated += 1;
    }

    return NextResponse.json({
      ok: true,
      scanned: stale.length,
      escalated,
      fallback_agent: fallback?.user_id ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: "enquiry-escalation" } });
    console.error("[cron/enquiry-escalation]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}
