import Link from "next/link";
import { redirect } from "next/navigation";
import { CmsShell } from "@/components/brand/cms-shell";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { currentUserIsAdmin } from "@/lib/queries/staff";
import { InviteStaffButton } from "../users/_invite-form";

export const dynamic = "force-dynamic";

type StaffRow = {
  user_id: string;
  display_name: string;
  slug: string;
  title: string | null;
  role: string;
  status: string;
  brn: string | null;
  specialties: string[];
  languages: unknown;
};

async function listAllStaffForAdmin(): Promise<StaffRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("staff")
    .select(
      "user_id, display_name, slug, title, role, status, brn, specialties, languages",
    )
    .order("display_name", { ascending: true });
  if (error || !data) {
    if (error) console.error("[listAllStaffForAdmin]", error);
    return [];
  }
  return data as unknown as StaffRow[];
}

const ROLE_LABEL: Record<string, string> = {
  agent: "Advisor",
  admin: "Admin",
  support: "Support",
  marketing: "Marketing",
  editor: "Editor",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-bz-accent-soft text-bz-accent",
  invited: "bg-yellow-100 text-yellow-900",
  suspended: "bg-red-50 text-red-700",
};

export default async function AdminAgentsPage() {
  if (!(await currentUserIsAdmin())) redirect("/admin?error=admins_only");
  const rows = await listAllStaffForAdmin();

  return (
    <CmsShell
      title="Agents & team"
      breadcrumbs="Admin · Catalogue"
      primary={<InviteStaffButton />}
    >
      <div className="max-w-[1200px]">
        <Eyebrow>Team · {rows.length}</Eyebrow>
        <h2
          className="serif text-[28px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.012em" }}
        >
          Twelve advisors. By design.
        </h2>
        <p className="mt-3 text-[13.5px] text-bz-muted max-w-[60ch]">
          Edit profile, BRN, languages, specialties. Status &amp; role changes
          live in <Link href="/admin/users" className="text-bz-ink underline underline-offset-2">Users &amp; roles</Link>.
        </p>

        {rows.length === 0 ? (
          <div className="mt-10 py-16 text-center max-w-[52ch] mx-auto border border-dashed border-bz-border rounded-md">
            <p className="text-[14px] text-bz-ink-2">
              No staff yet. Use the &ldquo;Invite staff&rdquo; button above to
              add the first advisor.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/admin/users">Open users page</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 rounded-md border border-bz-border bg-bz-surface overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="bg-bz-surface-2 border-b border-bz-border text-start text-[11.5px] uppercase tracking-wider text-bz-muted">
                <tr>
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-3 font-medium">Role</th>
                  <th className="py-3 px-3 font-medium">BRN</th>
                  <th className="py-3 px-3 font-medium">Specialties</th>
                  <th className="py-3 px-3 font-medium">Languages</th>
                  <th className="py-3 px-3 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-end">Edit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const langs = Array.isArray(row.languages)
                    ? (row.languages as string[])
                    : [];
                  const badgeClass =
                    STATUS_BADGE[row.status] ?? "bg-bz-surface-2 text-bz-ink-2";
                  return (
                    <tr
                      key={row.user_id}
                      className="border-b border-bz-border last:border-b-0 hover:bg-bz-accent-soft"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/agents/${row.user_id}`}
                          className="text-bz-ink hover:text-bz-accent transition-colors"
                        >
                          {row.display_name}
                        </Link>
                        {row.title ? (
                          <div className="text-[11.5px] text-bz-muted">
                            {row.title}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-3 text-bz-ink-2">
                        {ROLE_LABEL[row.role] ?? row.role}
                      </td>
                      <td className="py-3 px-3 mono text-[12px] text-bz-ink-2">
                        {row.brn ?? "—"}
                      </td>
                      <td className="py-3 px-3 text-bz-ink-2">
                        {row.specialties?.length
                          ? row.specialties.slice(0, 2).join(", ") +
                            (row.specialties.length > 2 ? "…" : "")
                          : "—"}
                      </td>
                      <td className="py-3 px-3 text-bz-ink-2">
                        {langs.length ? langs.join(", ") : "—"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-medium ${badgeClass}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-end">
                        <Link
                          href={`/admin/agents/${row.user_id}`}
                          className="text-[12.5px] text-bz-ink-2 hover:text-bz-accent transition-colors"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CmsShell>
  );
}
