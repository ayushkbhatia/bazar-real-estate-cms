import { z } from "zod";
import { uuidLike } from "@/lib/uuid";

/**
 * The roles that work in the CMS at large. `requireRole(STAFF_ROLES)` is the
 * gate for "any member of staff", so it deliberately leaves out
 * `mortgage_admin`, who sees the mortgage module and nothing else.
 */
export const STAFF_ROLES = [
  "admin",
  "editor",
  "agent",
  "marketing",
  "support",
] as const;

/**
 * Mortgage Admin: the mortgage module only. Always Head of mortgages — the
 * database pairs the two (0165) — and `is_staff()` doesn't count them, so
 * every other table refuses them as well.
 */
export const MORTGAGE_ADMIN_ROLE = "mortgage_admin" as const;

/** Every role a member of staff can hold: what an admin can invite or assign. */
export const ALL_STAFF_ROLES = [...STAFF_ROLES, MORTGAGE_ADMIN_ROLE] as const;

export const STAFF_STATUSES = [
  "active",
  "on_leave",
  "onboarding",
  "suspended",
] as const;

export type StaffRole = (typeof ALL_STAFF_ROLES)[number];
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  editor: "Editor",
  agent: "Agent",
  marketing: "Marketing",
  support: "Support",
  mortgage_admin: "Mortgage Admin",
};

export const ROLE_DESCRIPTION: Record<StaffRole, string> = {
  admin: "Full access",
  editor: "Catalogue + content",
  agent: "Own listings only",
  marketing: "Pages, media, blog",
  support: "Read-only on enquiries",
  mortgage_admin: "Mortgage requests only",
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
  role: z.enum(ALL_STAFF_ROLES),
});

export type StaffInviteInput = z.infer<typeof staffInviteSchema>;

/** Change-role payload. */
export const staffRoleUpdateSchema = z.object({
  user_id: uuidLike(),
  role: z.enum(ALL_STAFF_ROLES),
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

/** True for the role that sees the mortgage module and nothing else. */
export function isMortgageAdmin(role: string | null | undefined): boolean {
  return role === MORTGAGE_ADMIN_ROLE;
}

/** Short summary string shown in the table row. */
export function permissionsSummary(role: StaffRole): string {
  return ROLE_DESCRIPTION[role];
}
