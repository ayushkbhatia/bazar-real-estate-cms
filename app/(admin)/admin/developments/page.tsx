import { redirect } from "next/navigation";

/**
 * Developments moved under Pages & blocks.
 *
 * A project has two halves — its record and its page — and keeping two lists
 * meant one of them (this one) was never linked from the sidebar at all. The
 * hub at /admin/pages/sub/development lists every project and opens either
 * half; the record editor at /admin/developments/[id] is unchanged and is
 * reached from there.
 */
export default function AdminDevelopmentsRedirect() {
  redirect("/admin/pages/sub/development");
}
