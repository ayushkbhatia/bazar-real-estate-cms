import { redirect } from "next/navigation";

/**
 * Developers are worked on from the sub-pages hub, which lists every partner
 * and opens its record. Same shape as /admin/areas.
 */
export default function AdminDevelopersRedirect() {
  redirect("/admin/pages/sub/developer");
}
