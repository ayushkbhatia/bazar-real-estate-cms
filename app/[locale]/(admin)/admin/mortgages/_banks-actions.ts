"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { BANK_COLUMNS, type BankRow } from "@/lib/mortgage-requests/server/banks";
import { bankEditorSession, NOT_ALLOWED, refused, type MortgageActionResult } from "@/lib/mortgage-requests/server/cms-kit";

/**
 * Partner banks (Phase 6; decision D3 is open, so the list is data, not
 * code): the Head of mortgages (at /admin/mortgages/banks), or an admin (at
 * /admin/settings/partner-banks, with or without a mortgage role), adds a bank
 * or changes one. `mortgage_save_bank()` (0149) decides who may and checks the
 * rest; each save leaves an audit row.
 */

const bankInput = z.object({
  id: z.string().uuid().nullable(),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,12}$/),
  name: z.string().trim().min(1).max(80),
  color: z
    .string()
    .trim()
    .max(40)
    .regex(/^(#[0-9a-fA-F]{6}|oklch\([0-9. %/]+\))?$/),
  active: z.boolean(),
  inboxes: z.array(z.string().trim().toLowerCase().email().max(254)).max(5),
  sortOrder: z.number().int().min(0).max(999),
});

export async function saveBank(input: z.input<typeof bankInput>): Promise<MortgageActionResult> {
  const parsed = bankInput.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return { ok: false, code: "invalid", message: cmsT("banks.error.invalid"), fields: field ? [field] : [] };
  }
  const s = await bankEditorSession();
  if (!s) return NOT_ALLOWED;
  const b = parsed.data;
  if (b.active && b.inboxes.length === 0) {
    return { ok: false, code: "invalid", message: cmsT("banks.error.needsInbox"), fields: ["inboxes"] };
  }

  const before = b.id
    ? ((await s.supabase.from("mortgage_partner_banks").select(BANK_COLUMNS).eq("id", b.id).maybeSingle()).data as BankRow | null)
    : null;
  const { data, error } = await s.supabase.rpc("mortgage_save_bank", {
    p_id: b.id as string,
    p_code: b.code,
    p_name: b.name,
    p_brand_color: b.color,
    p_active: b.active,
    p_package_emails: b.inboxes,
    p_sort_order: b.sortOrder,
  });
  if (error) {
    if (error.code === "MR409") return { ok: false, code: "invalid", message: cmsT("banks.error.codeTaken"), fields: ["code"] };
    if (error.code === "MR422") return { ok: false, code: "invalid", message: cmsT("banks.error.invalid") };
    return refused(error, "mortgage.cms.banks");
  }
  const saved = data as BankRow;
  await logAudit({
    action: b.id ? "mortgage.bank.update" : "mortgage.bank.create",
    target_kind: "mortgage_partner_bank",
    target_id: saved.id,
    before: before ? auditShape(before) : null,
    after: auditShape(saved),
  });
  revalidatePath("/admin/mortgages/banks");
  revalidatePath("/admin/settings/partner-banks");
  return { ok: true, message: cmsT("banks.saved") };
}

/** A bank's settings as the audit log keeps them: its inboxes are the bank's, not a person's. */
function auditShape(b: BankRow) {
  return {
    code: b.code,
    name: b.name,
    brand_color: b.brand_color,
    active: b.active,
    package_emails: b.package_emails,
    sort_order: b.sort_order,
  };
}
