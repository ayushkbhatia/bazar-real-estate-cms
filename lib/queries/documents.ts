import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  DocumentKind,
  DocumentOwnerKind,
  DocumentStatus,
} from "@/lib/deals";

export type DocumentRow = {
  id: string;
  owner_kind: DocumentOwnerKind;
  owner_id: string;
  kind: DocumentKind;
  status: DocumentStatus;
  storage_key: string | null;
  filename: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejected_reason: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_FIELDS = `
  id, owner_kind, owner_id, kind, status,
  storage_key, filename, size_bytes, mime_type,
  uploaded_by, verified_by, verified_at, rejected_reason,
  expires_at, notes, created_at, updated_at
`;

export async function listDocumentsForOwner(opts: {
  ownerKind: DocumentOwnerKind;
  ownerId: string;
}): Promise<DocumentRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select(SELECT_FIELDS)
    .eq("owner_kind", opts.ownerKind)
    .eq("owner_id", opts.ownerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as DocumentRow[];
}

/**
 * Combined list for a deal: the deal-scoped docs + the buyer's account
 * docs (passport, emirates_id, etc) that the deal uses to satisfy KYC.
 */
export async function listDocumentsForDeal(opts: {
  dealId: string;
  buyerAccountId: string;
}): Promise<{ dealDocs: DocumentRow[]; buyerDocs: DocumentRow[] }> {
  if (!isSupabaseConfigured) return { dealDocs: [], buyerDocs: [] };
  const supabase = await createSupabaseServerClient();
  const [dealRes, buyerRes] = await Promise.all([
    supabase
      .from("documents")
      .select(SELECT_FIELDS)
      .eq("owner_kind", "deal")
      .eq("owner_id", opts.dealId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select(SELECT_FIELDS)
      .eq("owner_kind", "account")
      .eq("owner_id", opts.buyerAccountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const dealDocs = (dealRes.data as unknown as DocumentRow[]) ?? [];
  const buyerDocs = (buyerRes.data as unknown as DocumentRow[]) ?? [];
  return { dealDocs, buyerDocs };
}
