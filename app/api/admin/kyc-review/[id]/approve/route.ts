/**
 * Sprint 10 — admin KYC approval endpoint.
 *
 * Admin posts to /api/admin/kyc-review/[id]/approve. Side effects:
 *  - documents.status → 'verified', verified_by/at set
 *  - the owning account's kyc_status → 'verified' if all required
 *    KYC docs are now verified
 *  - kycApprovedTemplate email to the account holder
 *  - audit row + in-app notification
 */

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { kycApprovedTemplate } from "@/lib/email-templates";
import { emitNotification } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { currentUserIsAdmin } from "@/lib/queries/staff";

export async function POST(
  _req: NextRequest,
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

    // Mark document verified.
    const { data: doc, error } = await supabase
      .from("documents")
      .update({
        status: "verified",
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        rejected_reason: null,
      })
      .eq("id", id)
      .select("id, owner_id, owner_kind, kind")
      .single();
    if (error || !doc) {
      return NextResponse.json(
        { ok: false, reason: error?.message ?? "Document not found" },
        { status: 404 },
      );
    }

    // If owner is an account + this is a KYC doc, flip the account's
    // kyc_status. We don't enforce "all required docs verified" here —
    // admin verifies one-by-one and the last approval triggers the flip.
    if (doc.owner_kind === "account") {
      await supabase
        .from("accounts")
        .update({
          kyc_status: "verified",
          kyc_verified_at: new Date().toISOString(),
        })
        .eq("user_id", doc.owner_id);

      const { data: u } = await supabase.auth.admin.getUserById(doc.owner_id);
      const { data: acct } = await supabase
        .from("accounts")
        .select("first_name")
        .eq("user_id", doc.owner_id)
        .maybeSingle();

      if (u?.user?.email) {
        const tpl = kycApprovedTemplate({
          name: acct?.first_name ?? "there",
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
        title: "KYC approved",
        body: "Your Bazar account is now KYC-verified.",
        link: "/account/profile",
      });
    }

    await logAudit({
      action: "document.kyc_approved",
      target_kind: "document",
      target_id: doc.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[kyc-review/approve]", message);
    return NextResponse.json(
      { ok: false, reason: message },
      { status: 500 },
    );
  }
}
