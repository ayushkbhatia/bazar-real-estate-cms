import { z } from "zod";
import { uuidLike } from "@/lib/uuid";

export const STAFF_ROLES = [
  "admin",
  "editor",
  "agent",
  "marketing",
  "support",
] as const;

export const STAFF_STATUSES = [
  "active",
  "on_leave",
  "onboarding",
  "suspended",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  editor: "Editor",
  agent: "Agent",
  marketing: "Marketing",
  support: "Support",
};

export const ROLE_DESCRIPTION: Record<StaffRole, string> = {
  admin: "Full access",
  editor: "Catalogue + content",
  agent: "Own listings only",
  marketing: "Pages, media, blog",
  support: "Read-only on enquiries",
};

export const STATUS_LABEL: Record<StaffStatus, string> = {
  active: "Active",
  on_leave: "On leave",
  onboarding: "Onboarding",
  suspended: "Suspended",
};

/** Invite-staff form payload. */
export const staffInviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  display_name: z
    .string()
    .trim()
    .min(2, "Name is too short")
    .max(80, "Name is too long"),
  role: z.enum(STAFF_ROLES),
});

export type StaffInviteInput = z.infer<typeof staffInviteSchema>;

/** Change-role payload. */
export const staffRoleUpdateSchema = z.object({
  user_id: uuidLike(),
  role: z.enum(STAFF_ROLES),
});

/** Change-status payload (used for suspend / restore). */
export const staffStatusUpdateSchema = z.object({
  user_id: uuidLike(),
  status: z.enum(STAFF_STATUSES),
});

/** Permissions matrix — what each role can actually do.
 *  Used both to gate server actions and to render the right-rail summary. */
export const PERMISSIONS = {
  manage_users: ["admin"] as StaffRole[],
  manage_settings: ["admin"] as StaffRole[],
  publish_property: ["admin", "editor", "agent"] as StaffRole[],
  edit_blog: ["admin", "editor", "marketing"] as StaffRole[],
  reply_enquiries: ["admin", "editor", "agent", "support"] as StaffRole[],
  read_audit_log: ["admin"] as StaffRole[],
} as const;

export function can(
  role: StaffRole | null | undefined,
  permission: keyof typeof PERMISSIONS,
): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly StaffRole[]).includes(role);
}

/** Short summary string shown in the table row. */
export function permissionsSummary(role: StaffRole): string {
  return ROLE_DESCRIPTION[role];
}
