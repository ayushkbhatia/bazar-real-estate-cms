import { requireMortgageRole } from "@/lib/mortgage-requests/server/cms-auth";

export const dynamic = "force-dynamic";

/**
 * Every /admin/mortgages route is for the mortgage team alone: staff without
 * a mortgage role — admins included (decision D10) — get the same 404 as a
 * page that doesn't exist (docs/mortgage/cms/00-foundations §3). Each page
 * asks again for the data it needs; the database's policies are the final say.
 *
 * Every page here shows applicants' details, so PostHog's autocapture never
 * records a click in it (`ph-no-capture` covers the element and everything
 * inside; SECURITY-REVIEW SR-7). `contents` keeps the wrapper out of layout.
 */
export default async function MortgagesLayout({ children }: { children: React.ReactNode }) {
  await requireMortgageRole();
  return <div className="ph-no-capture contents">{children}</div>;
}
