"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  STAFF_ROLES,
  STAFF_STATUSES,
  ROLE_LABEL,
  STATUS_LABEL,
  type StaffRole,
  type StaffStatus,
} from "@/lib/schemas/staff";
import {
  revokeInvitation,
  resendInvitation,
  updateStaffRole,
  updateStaffStatus,
} from "./_actions";
// One implementation, shared with the Account access panel on the advisor
// profile — the two surfaces must not drift on what a password link does.
import { sendStaffPasswordLink } from "../agents/_actions";
import { accessLinkItem } from "@/lib/staff-invitations";

export function StaffRowActions({
  userId,
  displayName,
  email,
  currentRole,
  currentStatus,
  hasSignedIn,
  isSelf,
}: {
  userId: string;
  displayName: string;
  /** No address ⇒ nowhere to send a link, so the item is disabled. */
  email: string | null;
  currentRole: StaffRole;
  currentStatus: StaffStatus;
  /** Drives the wording: an invite to resend vs a password to reset. */
  hasSignedIn: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const access = accessLinkItem({
    hasSignedIn,
    email,
    suspended: currentStatus === "suspended",
  });

  function changeRole(role: StaffRole) {
    if (role === currentRole) return;
    startTransition(async () => {
      const r = await updateStaffRole({ user_id: userId, role });
      if (r.status === "ok") toast.success(r.message ?? "Role updated.");
      else toast.error(r.message);
    });
  }

  function sendAccessLink() {
    if (
      !confirm(
        `Email ${displayName} a link to set a new password?\n\nTheir current password keeps working until they use it. The link is valid for 14 days and can be used once.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await sendStaffPasswordLink(userId);
      if (r.status === "ok") toast.success(r.message);
      else toast.error(r.message);
    });
  }

  function changeStatus(status: StaffStatus) {
    if (status === currentStatus) return;
    startTransition(async () => {
      const r = await updateStaffStatus({ user_id: userId, status });
      if (r.status === "ok") toast.success(r.message ?? "Status updated.");
      else toast.error(r.message);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex w-8 h-8 rounded items-center justify-center text-bz-muted hover:text-bz-ink hover:bg-bz-surface-2 transition-colors"
        aria-label="Actions"
        disabled={pending}
      >
        <MoreVertical size={14} strokeWidth={1.7} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-bz-muted-2">
          Role
        </DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Change role — {ROLE_LABEL[currentRole]}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {STAFF_ROLES.map((r) => (
              <DropdownMenuItem
                key={r}
                disabled={r === currentRole}
                onSelect={(e) => {
                  e.preventDefault();
                  changeRole(r);
                }}
              >
                {ROLE_LABEL[r]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-bz-muted-2">
          Status
        </DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Change status — {STATUS_LABEL[currentStatus]}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {STAFF_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                disabled={s === currentStatus || (isSelf && s === "suspended")}
                onSelect={(e) => {
                  e.preventDefault();
                  changeStatus(s);
                }}
              >
                {STATUS_LABEL[s]}
                {isSelf && s === "suspended" ? " (can't self-suspend)" : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-bz-muted-2">
          Access
        </DropdownMenuLabel>
        <DropdownMenuItem
          disabled={access.disabled}
          onSelect={(e) => {
            e.preventDefault();
            sendAccessLink();
          }}
        >
          {access.label}
          {access.suffix}
        </DropdownMenuItem>

        {currentStatus !== "suspended" && !isSelf ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-bz-danger"
              onSelect={(e) => {
                e.preventDefault();
                changeStatus("suspended");
              }}
            >
              Suspend
            </DropdownMenuItem>
          </>
        ) : null}
        {currentStatus === "suspended" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                changeStatus("active");
              }}
            >
              Restore
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"revoke" | "resend" | null>(null);

  function run(
    kind: "revoke" | "resend",
    action: () => Promise<{ status: string; message?: string }>,
  ) {
    if (pending) return;
    setBusy(kind);
    startTransition(async () => {
      const r = await action();
      setBusy(null);
      if (r.status === "ok") toast.success(r.message ?? "Done.");
      else toast.error(r.message ?? "Something went wrong.");
    });
  }

  return (
    <span className="inline-flex items-center gap-3">
      {/* Re-issues the token and emails a fresh link. Needed when an invitee
          never managed to set a password — revoking and re-inviting doesn't
          recover that, because the address already has an auth user. */}
      <button
        type="button"
        onClick={() => run("resend", () => resendInvitation(invitationId))}
        disabled={pending}
        title="Send a fresh activation link"
        className="text-[12px] text-bz-muted hover:text-bz-ink disabled:opacity-60"
      >
        {busy === "resend" ? "Sending…" : "Resend"}
      </button>
      <button
        type="button"
        onClick={() => run("revoke", () => revokeInvitation(invitationId))}
        disabled={pending}
        className="text-[12px] text-bz-muted hover:text-bz-danger disabled:opacity-60"
      >
        {busy === "revoke" ? "Revoking…" : "Revoke"}
      </button>
    </span>
  );
}
