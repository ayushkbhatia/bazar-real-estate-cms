"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

type SendInput = {
  enquiryId: string;
  conversationId: string;
  body: string;
};

type ActionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

/**
 * User-side reply on an enquiry thread. Inserts an inbound message
 * (direction='inbound', author_kind='lead') into the conversation owned
 * by the current account.
 */
export async function sendAccountReplyAction(
  input: SendInput,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) {
    return { status: "error", message: "Backend not configured." };
  }
  const body = input.body.trim();
  if (!body) {
    return { status: "error", message: "Message body is required." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  // RLS-enforced ownership check.
  const { data: enquiry, error: fetchErr } = await supabase
    .from("enquiries")
    .select("id, account_id")
    .eq("id", input.enquiryId)
    .maybeSingle();
  if (fetchErr || !enquiry || enquiry.account_id !== user.id) {
    return { status: "error", message: "Enquiry not found." };
  }

  const { error: insertErr } = await supabase.from("messages").insert({
    conversation_id: input.conversationId,
    direction: "inbound",
    author_kind: "lead",
    author_id: user.id,
    body,
    channel: "web",
  });
  if (insertErr) {
    console.error("[sendAccountReplyAction]", insertErr);
    return { status: "error", message: "Could not send reply." };
  }

  // Audit-log for user actions lands in Sprint 10 via a system-side trigger
  // (audit_log RLS is staff-only insert).

  revalidatePath(`/account/enquiries/${input.enquiryId}`);
  return { status: "ok" };
}
