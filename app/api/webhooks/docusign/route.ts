/**
 * Sprint 13 — DocuSign Connect webhook receiver.
 *
 * Verifies the HMAC signature against DOCUSIGN_WEBHOOK_SECRET, parses
 * the envelope status update, and writes the new status onto the
 * matching documents row (linked via custom field `bazar_document_id`
 * we set when creating the envelope).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import { verifyDocuSignWebhook } from "@/lib/docusign";
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

type DocuSignPayload = {
  event?: string;
  data?: {
    envelopeId?: string;
    envelopeSummary?: {
      status?: string;
      customFields?: {
        textCustomFields?: { name: string; value: string }[];
      };
    };
  };
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-docusign-signature-1");
  if (!verifyDocuSignWebhook(rawBody, signature)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: DocuSignPayload;
  try {
    payload = JSON.parse(rawBody) as DocuSignPayload;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Bad JSON" },
      { status: 400 },
    );
  }

  const bazarDocId = payload.data?.envelopeSummary?.customFields?.textCustomFields?.find(
    (f) => f.name === "bazar_document_id",
  )?.value;
  const envelopeStatus = payload.data?.envelopeSummary?.status;

  if (!bazarDocId || !envelopeStatus) {
    return NextResponse.json({ ok: true, skipped: "no metadata" });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, skipped: "no supabase" });
  }

  try {
    const supabase = adminClient();
    // Map DocuSign status → Bazar document.status. The Bazar enum is
    // narrower than the DocuSign envelope-lifecycle ladder, so anything
    // pre-completion stays at 'pending_review'.
    const mapped: "verified" | "rejected" | "pending_review" =
      envelopeStatus === "completed"
        ? "verified"
        : envelopeStatus === "declined" || envelopeStatus === "voided"
          ? "rejected"
          : "pending_review";
    await supabase
      .from("documents")
      .update({
        status: mapped,
        ...(mapped === "verified"
          ? { verified_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", bazarDocId);

    // System-driven audit row.
    await supabase.from("audit_log").insert({
      actor_kind: "integration",
      action: `docusign.envelope_${envelopeStatus}`,
      target_kind: "document",
      target_id: bazarDocId,
    });

    return NextResponse.json({ ok: true, status: mapped });
  } catch (err) {
    console.error("[webhooks/docusign]", err);
    return NextResponse.json(
      { ok: false, reason: (err as Error).message },
      { status: 500 },
    );
  }
}
