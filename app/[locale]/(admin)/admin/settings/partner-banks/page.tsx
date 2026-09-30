import { AddBankButton, BanksList } from "../../mortgages/_components/banks-view";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { loadBanks } from "@/lib/mortgage-requests/server/banks";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Partner banks for admins (SPEC §7: the Head of mortgages or an admin keeps
 * the list). The mortgage section itself is closed to anyone without a
 * mortgage role (D10), and the banks show no applicant, so admins keep them
 * here, behind the settings area's admin-only layout; the Head keeps using
 * /admin/mortgages/banks (SECURITY-REVIEW SR-13). The list and its dialog are
 * the same components; RLS lets admins read the banks, and
 * `mortgage_save_bank()` lets them save one.
 */
export default async function AdminSettingsPartnerBanksPage() {
  const supabase = await createSupabaseServerClient();
  const banks = await loadBanks(supabase);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="serif text-[26px] leading-tight">{cmsT("banks.title")}</h1>
          <p className="mt-1.5 max-w-[640px] text-[13px] text-bz-ink-2">{cmsT("banks.lede")}</p>
          <p className="mt-1 text-[12px] text-bz-muted">{cmsT("banks.settingsNote")}</p>
        </div>
        <AddBankButton nextOrder={banks.reduce((max, b) => Math.max(max, b.sort_order + 1), 1)} />
      </div>
      <section className="overflow-hidden rounded-[10px] border border-bz-border bg-bz-surface">
        <BanksList
          canEdit
          banks={banks.map((b) => ({
            id: b.id,
            code: b.code,
            name: b.name,
            color: b.brand_color,
            active: b.active,
            inboxes: b.package_emails,
            sortOrder: b.sort_order,
          }))}
        />
      </section>
    </div>
  );
}
