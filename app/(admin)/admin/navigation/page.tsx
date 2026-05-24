import { redirect } from "next/navigation";
import { listMegamenuTabsForAdmin } from "@/lib/queries/megamenu";

/**
 * /admin/navigation — redirect to the first tab's editor.
 *
 * The megamenu admin has no top-level dashboard yet; every meaningful
 * action lives on a per-tab page. If no tabs exist (fresh DB), bounce to
 * Buy by slug — the migration seeds it.
 */
export default async function MegamenuAdminIndex() {
  const tabs = await listMegamenuTabsForAdmin();
  const first = tabs[0]?.slug ?? "buy";
  redirect(`/admin/navigation/${first}`);
}
