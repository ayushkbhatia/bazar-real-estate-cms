import { redirect } from "next/navigation";

/**
 * Areas are worked on from the sub-pages hub, which lists every area and opens
 * either half of it — the record or the guide page. Same shape as
 * /admin/developments.
 */
export default function AdminAreasRedirect() {
  redirect("/admin/pages/sub/area");
}
