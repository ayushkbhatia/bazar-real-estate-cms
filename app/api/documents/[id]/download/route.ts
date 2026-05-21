import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  canSignDownload,
  signDocumentDownload,
} from "@/lib/documents-storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Mints a 15-minute signed URL for a document and 302-redirects to it.
 * Permission check is enforced server-side before the URL is created.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Service unavailable." },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, owner_kind, owner_id, storage_key, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (docErr || !doc || doc.deleted_at !== null) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!doc.storage_key) {
    return NextResponse.json(
      { error: "Upload not completed." },
      { status: 409 },
    );
  }

  // Establish viewer context for the permission check.
  const { data: staffRow } = await supabase
    .from("staff")
    .select("user_id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  const isStaff = staffRow?.status === "active";

  let buyerOfDealId: string | null = null;
  if (!isStaff && doc.owner_kind === "deal") {
    const { data: dealRow } = await supabase
      .from("deals")
      .select("id, buyer_account_id")
      .eq("id", doc.owner_id)
      .maybeSingle();
    if (dealRow?.buyer_account_id === user.id) {
      buyerOfDealId = dealRow.id;
    }
  }

  const allowed = canSignDownload({
    ownerKind: doc.owner_kind,
    ownerId: doc.owner_id,
    viewerUserId: user.id,
    viewerIsStaff: isStaff,
    viewerBuyerOfDealId: buyerOfDealId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const result = await signDocumentDownload(doc.storage_key);
  if (result.status === "error") {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }
  return NextResponse.redirect(result.url, { status: 302 });
}
