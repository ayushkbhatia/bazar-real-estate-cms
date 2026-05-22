/**
 * Sprint 10 — admin KYC rejection endpoint.
 *
 * POST { reason: string } to /api/admin/kyc-review/[id]/reject. Side
 * effects mirror the approve route but:
 *  - documents.status → 'rejected', rejected_reason set
 *  - account.kyc_status → 'rejected' (so the gate stays closed)
 *  - kycRejectedTemplate email
 *  - audit + in-app notification
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { kycRejectedTemplate } from "@/lib/email-templates";
import { emitNotification } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { currentUserIsAdmin } from "@/lib/queries/staff";

const RejectInput = z.object({
  reason: z
    .string()
    .min(4, "Reason is too short")
    .max(560, "Reason is too long"),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { ok: false, reason: "Supabase not configured" },
      { status: 503 },
    );
  }
  if (!(await currentUserIsAdmin())) {
    return NextResponse.json(
      { ok: false, reason: "Admin role required" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Invalid JSON body" },
      { status: 400 },
    );
  }
  const parsed = RejectInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        reason: parsed.error.issues[0]?.message ?? "Invalid input",
      },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, reason: "No session" },
        { status: 401 },
      );
    }

    const { data: doc, error } = await supabase
      .from("documents")
      .update({
        status: "rejected",
        rejected_reason: parsed.data.reason,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, owner_id, owner_kind")
      .single();
    if (error || !doc) {
      return NextResponse.json(
        { ok: false, reason: error?.message ?? "Document not found" },
        { status: 404 },
      );
    }

    if (doc.owner_kind === "account") {
      await supabase
        .from("accounts")
        .update({ kyc_status: "rejected" })
        .eq("user_id", doc.owner_id);

      const { data: u } = await supabase.auth.admin.getUserById(doc.owner_id);
      const { data: acct } = await supabase
        .from("accounts")
        .select("first_name")
        .eq("user_id", doc.owner_id)
        .maybeSingle();

      if (u?.user?.email) {
        const tpl = kycRejectedTemplate({
          name: acct?.first_name ?? "there",
          reason: parsed.data.reason,
        });
        await sendEmail({
          to: u.user.email,
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
        });
      }

      await emitNotification({
        kind: "system",
        user_id: doc.owner_id,
        title: "KYC needs more info",
        body: parsed.data.reason,
        link: "/account/documents",
      });
    }

    await logAudit({
      action: "document.kyc_rejected",
      target_kind: "document",
      target_id: doc.id,
      after: { reason: parsed.data.reason },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[kyc-review/reject]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}
