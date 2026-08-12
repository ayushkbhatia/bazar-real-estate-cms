import { redirect } from "next/navigation";
import { CmsShell } from "@/components/brand/cms-shell";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import {
  countStaffByRole,
  currentUserIsAdmin,
  listAllStaff,
  listPendingInvitations,
  currentStaffRow,
  type StaffRow,
} from "@/lib/queries/staff";
import {
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  STATUS_LABEL,
  type StaffRole,
  type StaffStatus,
} from "@/lib/schemas/staff";
import { InviteStaffButton } from "./_invite-form";
import { InvitationActions, StaffRowActions } from "./_row-actions";
import { UserFilters } from "./_filters";
import { parseUserFilters } from "./_filter-state";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function StatusPill({ status }: { status: StaffStatus }) {
  const styles: Record<StaffStatus, string> = {
    active: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
    onboarding: "bg-bz-accent-soft text-bz-accent",
    on_leave: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
    suspended: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
        styles[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function RolePill({ role }: { role: StaffRole }) {
  return (
    <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium bg-bz-surface-2 text-bz-ink-2">
      {ROLE_LABEL[role]}
    </span>
  );
}

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / day);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  if (!(await currentUserIsAdmin())) {
    redirect("/admin?error=admins_only");
  }
  const resolved = await searchParams;
  const filters = parseUserFilters(resolved);

  const [staff, invitations, roleCounts, me] = await Promise.all([
    listAllStaff(),
    listPendingInvitations(),
    countStaffByRole(),
    currentStaffRow(),
  ]);

  const filteredStaff = staff.filter((s) => {
    if (filters.role && s.role !== filters.role) return false;
    if (filters.status && s.status !== filters.status) return false;
    if (filters.q) {
      const needle = filters.q.toLowerCase();
      if (
        !s.display_name.toLowerCase().includes(needle) &&
        !(s.email ?? "").toLowerCase().includes(needle)
      )
        return false;
    }
    return true;
  });

  return (
    <CmsShell
      title="Users & roles"
      breadcrumbs="Admin"
      primary={<InviteStaffButton />}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <UserFilters initial={filters} />

          <div className="text-[12.5px] text-bz-muted">
            {filteredStaff.length}{" "}
            {filteredStaff.length === 1 ? "user" : "users"}
            {filters.role || filters.status || filters.q ? " match filters" : ""}
            {invitations.length > 0 ? (
              <span className="ml-2">
                · {invitations.length} pending invite
                {invitations.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
            <table className="w-full text-[13px] min-w-[640px]">
              <thead>
                <tr className="text-left text-[10.5px] text-bz-muted-2 uppercase tracking-wider border-b border-bz-border">
                  <th className="px-4 py-3 w-[36%]">User</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Permissions</th>
                  <th className="px-3 py-3">Last active</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 w-[40px]"></th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-16 text-center text-bz-muted text-[12.5px]"
                    >
                      No users match these filters yet.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((s) => (
                    <StaffTableRow
                      key={s.user_id}
                      staff={s}
                      isSelf={me?.user_id === s.user_id}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {invitations.length > 0 ? (
            <PendingInvitationsTable
              invitations={invitations}
            />
          ) : null}
        </div>

        <aside className="flex flex-col gap-5 sticky top-6">
          <RolesPanel counts={roleCounts} />
          <RecentSignInsPanel staff={staff} />
        </aside>
      </div>
    </CmsShell>
  );
}

function StaffTableRow({
  staff,
  isSelf,
}: {
  staff: StaffRow;
  isSelf: boolean;
}) {
  return (
    <tr className="border-b border-bz-border last:border-b-0 align-middle">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-bz-surface-3 text-bz-ink flex items-center justify-center text-[12px] font-medium shrink-0">
            {initialsOf(staff.display_name)}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">
              {staff.display_name}
              {isSelf ? (
                <span className="ml-1.5 text-[11px] text-bz-muted">(you)</span>
              ) : null}
            </div>
            {staff.email ? (
              <div className="text-[11.5px] text-bz-muted truncate">
                {staff.email}
              </div>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <RolePill role={staff.role} />
      </td>
      <td className="px-3 py-3 text-bz-ink-2 text-[12.5px]">
        {ROLE_DESCRIPTION[staff.role]}
      </td>
      <td className="px-3 py-3 text-bz-muted text-[12px]">
        {relativeDate(staff.last_sign_in_at)}
      </td>
      <td className="px-3 py-3">
        <StatusPill status={staff.status} />
      </td>
      <td className="px-3 py-3 text-right">
        <StaffRowActions
          userId={staff.user_id}
          displayName={staff.display_name}
          email={staff.email}
          currentRole={staff.role}
          currentStatus={staff.status}
          hasSignedIn={staff.last_sign_in_at !== null}
          isSelf={isSelf}
        />
      </td>
    </tr>
  );
}

function PendingInvitationsTable({
  invitations,
}: {
  invitations: Awaited<ReturnType<typeof listPendingInvitations>>;
}) {
  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-bz-border">
        <Eyebrow>Pending invitations</Eyebrow>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-[13px] min-w-[640px]">
        <thead>
          <tr className="text-left text-[10.5px] text-bz-muted-2 uppercase tracking-wider border-b border-bz-border">
            <th className="px-4 py-2.5">Email</th>
            <th className="px-3 py-2.5">Display name</th>
            <th className="px-3 py-2.5">Role</th>
            <th className="px-3 py-2.5">Invited by</th>
            <th className="px-3 py-2.5">Expires</th>
            <th className="px-3 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((inv) => (
            <tr
              key={inv.id}
              className="border-b border-bz-border last:border-b-0"
            >
              <td className="px-4 py-2.5">{inv.email}</td>
              <td className="px-3 py-2.5">{inv.display_name}</td>
              <td className="px-3 py-2.5">
                <RolePill role={inv.role} />
              </td>
              <td className="px-3 py-2.5 text-bz-muted">
                {inv.invited_by_name ?? "—"}
              </td>
              <td className="px-3 py-2.5 text-bz-muted">
                {relativeDate(inv.expires_at)}
              </td>
              <td className="px-3 py-2.5 text-right">
                <InvitationActions invitationId={inv.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function RolesPanel({
  counts,
}: {
  counts: Record<StaffRole, number>;
}) {
  const rolesInOrder: StaffRole[] = ["admin", "editor", "agent", "marketing", "support"];
  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
      <Eyebrow>Roles</Eyebrow>
      <ul className="mt-3 flex flex-col gap-2">
        {rolesInOrder.map((r) => (
          <li
            key={r}
            className="flex items-baseline justify-between gap-3 text-[13px]"
          >
            <span className="font-medium">{ROLE_LABEL[r]}</span>
            <span className="text-bz-muted text-[12px]">
              {ROLE_DESCRIPTION[r]} ·{" "}
              <span className="mono">{counts[r]}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecentSignInsPanel({ staff }: { staff: StaffRow[] }) {
  const recent = [...staff]
    .filter((s) => s.last_sign_in_at != null)
    .sort(
      (a, b) =>
        new Date(b.last_sign_in_at!).getTime() -
        new Date(a.last_sign_in_at!).getTime(),
    )
    .slice(0, 6);
  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
      <Eyebrow>Recent sign-ins</Eyebrow>
      {recent.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-bz-muted">
          No sign-ins yet.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {recent.map((s) => (
            <li
              key={s.user_id}
              className="flex items-center gap-2.5 text-[12.5px]"
            >
              <div className="w-7 h-7 rounded-full bg-bz-surface-3 text-bz-ink flex items-center justify-center text-[10.5px] font-medium shrink-0">
                {initialsOf(s.display_name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate">{s.display_name}</div>
                <div className="text-[11px] text-bz-muted">
                  {relativeDate(s.last_sign_in_at)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
