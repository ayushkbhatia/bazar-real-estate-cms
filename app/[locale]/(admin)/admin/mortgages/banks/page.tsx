import Link from "next/link";
import { CmsShell } from "@/components/brand/cms-shell";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { loadBanks } from "@/lib/mortgage-requests/server/banks";
import { getMortgageRole, requireMortgageRole } from "@/lib/mortgage-requests/server/cms-auth";
import { AddBankButton, BanksList } from "../_components/banks-view";
import { CRUMB_LINK } from "../_components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return (await getMortgageRole()) ? { title: cmsT("banks.title") } : {};
}

/**
 * Partner banks (Phase 6; not designed, decision D3 open): the banks a file
 * can be sent to and where each receives its package. The whole team can
 * read the list; the Head of mortgages, or an admin on the team, changes it
 * (`mortgage_save_bank()`, 0149, says so too). Admins without a mortgage role
 * keep the same list at /admin/settings/partner-banks (SR-13).
 */
export default async function MortgageBanksPage() {
  const { role, staff, supabase } = await requireMortgageRole();
  const canEdit = role === "head" || staff.role === "admin";
  const banks = await loadBanks(supabase);

  return (
    <CmsShell
      title={cmsT("banks.title")}
      breadcrumbs={
        <>
          {cmsT("nav.group")} › <Link href="/admin/mortgages" className={CRUMB_LINK}>{cmsT("nav.mortgages")}</Link> › {cmsT("banks.link")}
        </>
      }
      primary={canEdit ? <AddBankButton nextOrder={banks.reduce((max, b) => Math.max(max, b.sort_order + 1), 1)} /> : null}
    >
      <div className="max-w-[1000px]">
        <p className="mb-4 text-[13px] text-bz-ink-2">
          {cmsT("banks.lede")}
          {canEdit ? null : <span className="mt-1 block text-[12px] text-bz-muted">{cmsT("banks.readOnly")}</span>}
        </p>
        <section className="overflow-hidden rounded-[10px] border border-bz-border bg-bz-surface">
          <BanksList
            canEdit={canEdit}
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
    </CmsShell>
  );
}
