"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import {
  evaluateStageAdvance,
  type DealStage,
  type DocumentKind,
} from "@/lib/deals";
import { createDealDocumentUpload } from "@/lib/documents-storage";
import { sendEmail } from "@/lib/email";
import { dealStageChangeTemplate } from "@/lib/email-templates";

export type StageAdvanceResult =
  | { status: "ok"; stage: DealStage }
  | { status: "error"; message: string; blockers?: string[] };

/**
 * Advance a deal one stage forward. Server-side stage gate enforces the
 * KYC + NOC document requirements (see lib/deals.ts evaluateStageAdvance).
 *
 * G7 will also wire this into the email flow.
 */
export async function advanceDealStage(opts: {
  dealId: string;
  to: DealStage;
}): Promise<StageAdvanceResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign-in required." };

  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, stage, buyer_account_id, mou_signed_at, noc_obtained_at, transferred_at",
    )
    .eq("id", opts.dealId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!deal) return { status: "error", message: "Deal not found." };

  // Pull the docs that feed the stage gate.
  const [buyerRes, dealRes] = await Promise.all([
    supabase
      .from("documents")
      .select("kind, status, expires_at")
      .eq("owner_kind", "account")
      .eq("owner_id", deal.buyer_account_id)
      .is("deleted_at", null),
    supabase
      .from("documents")
      .select("kind, status, expires_at")
      .eq("owner_kind", "deal")
      .eq("owner_id", deal.id)
      .is("deleted_at", null),
  ]);

  const gate = evaluateStageAdvance({
    from: deal.stage as DealStage,
    to: opts.to,
    docs: {
      buyerDocs: (buyerRes.data ?? []) as {
        kind: DocumentKind;
        status: "uploaded" | "pending_review" | "verified" | "rejected" | "expired";
        expires_at: string | null;
      }[],
      dealDocs: (dealRes.data ?? []) as {
        kind: DocumentKind;
        status: "uploaded" | "pending_review" | "verified" | "rejected" | "expired";
        expires_at: string | null;
      }[],
    },
  });

  if (!gate.ok) {
    return {
      status: "error",
      message: gate.reason ?? "Stage gate not satisfied.",
      blockers: gate.blockers,
    };
  }

  const now = new Date().toISOString();
  const patch: {
    stage: DealStage;
    mou_signed_at?: string;
    noc_obtained_at?: string;
    transferred_at?: string;
  } = { stage: opts.to };
  if (opts.to === "deposit" && !deal.mou_signed_at) patch.mou_signed_at = now;
  if (opts.to === "dld_pending" && !deal.noc_obtained_at)
    patch.noc_obtained_at = now;
  if (opts.to === "transferred") patch.transferred_at = now;

  const { error } = await supabase
    .from("deals")
    .update(patch)
    .eq("id", opts.dealId);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "deal.stage_change",
    target_kind: "deal",
    target_id: opts.dealId,
    before: { stage: deal.stage },
    after: { ...patch },
  });

  // Best-effort emails to buyer + agent. Failures are logged but don't
  // block the stage advance — the user already saw the success in the UI.
  void sendStageEmails(opts.dealId, opts.to);

  revalidatePath("/admin/deals");
  revalidatePath(`/admin/deals/${opts.dealId}`);
  return { status: "ok", stage: opts.to };
}

/**
 * Pulls the buyer + agent contacts for the deal and emails both with the
 * stage-specific copy. Uses the service-role client so we can read
 * auth.users (which RLS hides) for the agent's email.
 */
async function sendStageEmails(dealId: string, stage: DealStage) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: deal } = await supabase
      .from("deals")
      .select(
        `id, buyer_account_id, lead_agent_id,
         properties:property_id(reference, title),
         agent:lead_agent_id(display_name)`,
      )
      .eq("id", dealId)
      .maybeSingle();
    if (!deal) return;

    const propRow = deal.properties as
      | { reference: string; title: string }
      | null;
    if (!propRow) return;

    const agent = deal.agent as { display_name: string } | null;

    // Buyer name from accounts via a separate lookup (FK ambiguity).
    const { data: buyerRow } = await supabase
      .from("accounts")
      .select("first_name, last_name")
      .eq("user_id", deal.buyer_account_id)
      .maybeSingle();
    const buyer = buyerRow as
      | { first_name: string | null; last_name: string | null }
      | null;

    // Resolve emails via service-role.
    const admin = createAdminClient();
    if (!admin) return;

    const recipients: {
      audience: "buyer" | "agent";
      email: string;
      name: string;
    }[] = [];

    if (deal.buyer_account_id) {
      const { data } = await admin.auth.admin.getUserById(
        deal.buyer_account_id,
      );
      const email = data?.user?.email;
      if (email) {
        const name =
          [buyer?.first_name, buyer?.last_name].filter(Boolean).join(" ") ||
          "there";
        recipients.push({ audience: "buyer", email, name });
      }
    }
    if (deal.lead_agent_id) {
      const { data } = await admin.auth.admin.getUserById(deal.lead_agent_id);
      const email = data?.user?.email;
      if (email) {
        recipients.push({
          audience: "agent",
          email,
          name: agent?.display_name ?? "Bazar advisor",
        });
      }
    }

    for (const r of recipients) {
      const tpl = dealStageChangeTemplate({
        recipientName: r.name,
        audience: r.audience,
        propertyReference: propRow.reference,
        propertyTitle: propRow.title ?? null,
        stage,
        dealId,
      });
      await sendEmail({
        to: r.email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
    }
  } catch (err) {
    console.warn("[deal.stage_change] email send failed:", (err as Error).message);
  }
}

export type DocActionResult =
  | { status: "ok"; documentId: string }
  | { status: "error"; message: string };

export async function startDealDocumentUpload(opts: {
  dealId: string;
  kind: DocumentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<
  | {
      status: "ok";
      uploadUrl: string;
      token: string;
      documentId: string;
      storageKey: string;
    }
  | { status: "error"; message: string }
> {
  const res = await createDealDocumentUpload(opts);
  if (res.status === "error") return res;
  await logAudit({
    action: "deal.document_uploaded",
    target_kind: "document",
    target_id: res.documentId,
    before: null,
    after: {
      deal_id: opts.dealId,
      kind: opts.kind,
      filename: opts.filename,
      size_bytes: opts.sizeBytes,
      mime_type: opts.mimeType,
    },
  });
  revalidatePath(`/admin/deals/${opts.dealId}`);
  return res;
}

export async function setDocumentStatus(opts: {
  documentId: string;
  next: "verified" | "rejected" | "pending_review";
  reason?: string | null;
}): Promise<DocActionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign-in required." };

  const { data: before } = await supabase
    .from("documents")
    .select("status, owner_kind, owner_id, rejected_reason")
    .eq("id", opts.documentId)
    .maybeSingle();
  if (!before) return { status: "error", message: "Document not found." };

  const patch: {
    status: "verified" | "rejected" | "pending_review";
    verified_by: string | null;
    verified_at: string | null;
    rejected_reason?: string | null;
  } = {
    status: opts.next,
    verified_by: null,
    verified_at: null,
  };
  if (opts.next === "verified") {
    patch.verified_by = user.id;
    patch.verified_at = new Date().toISOString();
    patch.rejected_reason = null;
  } else if (opts.next === "rejected") {
    patch.rejected_reason = opts.reason?.trim() || "No reason provided.";
  }

  const { error, data } = await supabase
    .from("documents")
    .update(patch)
    .eq("id", opts.documentId)
    .select("id, owner_kind, owner_id")
    .maybeSingle();
  if (error || !data) return { status: "error", message: error?.message ?? "Update failed." };

  await logAudit({
    action:
      opts.next === "verified"
        ? "deal.document_verified"
        : opts.next === "rejected"
          ? "deal.document_rejected"
          : "deal.document_status_change",
    target_kind: "document",
    target_id: opts.documentId,
    before: { status: before.status, rejected_reason: before.rejected_reason },
    after: { ...patch },
  });

  // Revalidate the deal page if this is a deal-scoped doc, and the
  // /account/documents vault if it's an account doc.
  if (data.owner_kind === "deal") {
    revalidatePath(`/admin/deals/${data.owner_id}`);
  }
  if (data.owner_kind === "account") {
    revalidatePath("/account/documents");
  }
  return { status: "ok", documentId: opts.documentId };
}

export async function setDealCommission(opts: {
  dealId: string;
  commissionAed: number;
  notes?: string | null;
}): Promise<DocActionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  if (!Number.isFinite(opts.commissionAed) || opts.commissionAed < 0)
    return { status: "error", message: "Commission must be a positive number." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign-in required." };

  const { data: before } = await supabase
    .from("deals")
    .select("commission_aed, notes")
    .eq("id", opts.dealId)
    .maybeSingle();
  if (!before) return { status: "error", message: "Deal not found." };

  const { error } = await supabase
    .from("deals")
    .update({
      commission_aed: opts.commissionAed,
      notes: opts.notes?.trim() === "" ? null : opts.notes,
    })
    .eq("id", opts.dealId);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "deal.commission_recorded",
    target_kind: "deal",
    target_id: opts.dealId,
    before: { commission_aed: before.commission_aed, notes: before.notes },
    after: { commission_aed: opts.commissionAed, notes: opts.notes ?? null },
  });

  revalidatePath(`/admin/deals/${opts.dealId}`);
  return { status: "ok", documentId: opts.dealId };
}

// ─────────────────────────────────────────────────────────────────────
// BF-6 — DocuSign envelope for a deal document.
// ─────────────────────────────────────────────────────────────────────

export type SendForSignatureResult =
  | { status: "ok"; envelopeId: string }
  | { status: "error"; message: string };

/** Send a deal document for e-signature via DocuSign. Pulls the file
 *  from Supabase Storage, base64-encodes it, and creates the envelope
 *  with the buyer (account) as the signer. Updates documents.status
 *  to 'pending_review' so the UI reflects the in-flight state. */
export async function sendDocumentForSignature(opts: {
  documentId: string;
  signerEmail: string;
  signerName: string;
  emailSubject?: string;
}): Promise<SendForSignatureResult> {
  if (!isSupabaseConfigured) {
    return { status: "error", message: "Supabase not configured" };
  }
  const { isDocuSignConfigured } = await import("@/lib/env");
  if (!isDocuSignConfigured) {
    return { status: "error", message: "DocuSign not configured" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign in required" };

  // Fetch the doc + storage key.
  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, owner_kind, owner_id, kind, storage_key, filename")
    .eq("id", opts.documentId)
    .maybeSingle();
  if (error || !doc || !doc.storage_key) {
    return { status: "error", message: "Document not found or has no file" };
  }

  // Download the file via service-role storage client.
  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "Service role not configured" };
  const { data: blob, error: dlErr } = await admin.storage
    .from("documents")
    .download(doc.storage_key);
  if (dlErr || !blob) {
    return { status: "error", message: dlErr?.message ?? "Could not load file" };
  }
  const arrayBuf = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");

  const { createEnvelope } = await import("@/lib/docusign");
  const result = await createEnvelope({
    documentBase64: base64,
    documentName: doc.filename ?? "Bazar document.pdf",
    emailSubject:
      opts.emailSubject ?? `Please sign — ${doc.kind}`,
    signers: [
      {
        email: opts.signerEmail,
        name: opts.signerName,
        role: "Signer",
      },
    ],
    // We tag with bazar_document_id so the DocuSign Connect webhook
    // can map the envelope back to the right documents row.
    customFields: {
      bazar_document_id: doc.id,
    },
  });

  if (!result.ok || !result.envelopeId) {
    return {
      status: "error",
      message: result.reason ?? "DocuSign envelope creation failed",
    };
  }

  // Flip the document status so the UI shows it's out for signature.
  await admin
    .from("documents")
    .update({ status: "pending_review" })
    .eq("id", doc.id);

  await logAudit({
    action: "document.sent_for_signature",
    target_kind: "document",
    target_id: doc.id,
    after: { envelope_id: result.envelopeId, signer: opts.signerEmail },
  });

  revalidatePath(`/admin/deals/${doc.owner_id}`);
  return { status: "ok", envelopeId: result.envelopeId };
}
