import { redirect } from "next/navigation";
import { CmsShell } from "@/components/brand/cms-shell";
import { Eyebrow } from "@/components/brand/eyebrow";
import { isSupabaseConfigured } from "@/lib/env";
import { currentUserIsAdmin } from "@/lib/queries/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DsrConsole } from "./_console";
import { fulfilExportRequest, fulfilErasureRequest } from "./_actions";

export const dynamic = "force-dynamic";

/**
 * PDPL data-subject requests, fulfilled by staff.
 *
 * Subjects used to serve themselves at /account/data-export and
 * /account/data-deletion. Those pages went with the customer-account surface;
 * the legal duty did not. The privacy notice points at
 * info@bazarrealestate.ae (§10 of the client's final text), and this page is
 * where what arrives there gets answered.
 */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminDsrPage() {
  if (!isSupabaseConfigured) redirect("/admin");
  if (!(await currentUserIsAdmin())) redirect("/admin?error=admins_only");

  const supabase = await createSupabaseServerClient();
  const { data: history } = await supabase
    .from("dsr_requests")
    .select("id, email, kind, status, created_at, fulfilled_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <CmsShell title="Data-subject requests" breadcrumbs="Admin · Compliance">
      <div className="flex flex-col gap-8 max-w-[860px]">
        <p className="text-[13px] leading-relaxed text-bz-ink-2 max-w-[70ch]">
          Requests reach us at{" "}
          <span className="mono">info@bazarrealestate.ae</span> — the address the
          privacy notice publishes. Verify the requester, then build their
          archive or erase their data here. Both are recorded as evidence the
          request was handled.
        </p>

        <DsrConsole
          // By reference — see the note on the props.
          runExport={fulfilExportRequest}
          runErasure={fulfilErasureRequest}
        />

        <div>
          <Eyebrow>Handled requests</Eyebrow>
          <div className="mt-3 rounded-lg border border-bz-border bg-bz-surface overflow-x-auto">
            {(history ?? []).length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-bz-muted">
                No requests recorded yet.
              </p>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead className="text-bz-muted">
                  <tr className="border-b border-bz-border">
                    <th className="text-left font-medium px-4 py-2.5">Subject</th>
                    <th className="text-left font-medium px-4 py-2.5">Kind</th>
                    <th className="text-left font-medium px-4 py-2.5">Status</th>
                    <th className="text-left font-medium px-4 py-2.5">Handled</th>
                  </tr>
                </thead>
                <tbody>
                  {(history ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-bz-border last:border-0">
                      <td className="px-4 py-2.5 text-bz-ink-2">{r.email}</td>
                      <td className="px-4 py-2.5 capitalize">{r.kind}</td>
                      <td className="px-4 py-2.5 capitalize text-bz-muted">
                        {r.status}
                      </td>
                      <td className="px-4 py-2.5 text-bz-muted">
                        {r.fulfilled_at
                          ? formatDate(r.fulfilled_at)
                          : formatDate(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </CmsShell>
  );
}
