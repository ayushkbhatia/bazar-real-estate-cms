import {
  STAFF_ROLES,
  STAFF_STATUSES,
  type StaffRole,
  type StaffStatus,
} from "@/lib/schemas/staff";

export type FilterState = {
  role: StaffRole | null;
  status: StaffStatus | null;
  q: string | null;
};

/**
 * Pure searchParams → FilterState parsing. Lives in a shared (non-client)
 * module because the server page calls it too — calling an export of a
 * `"use client"` file from a Server Component throws at runtime
 * ("Attempted to call parseUserFilters() from the server").
 */
export function parseUserFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): FilterState {
  const get = (k: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(k) ?? undefined;
    const v = (params as Record<string, string | string[] | undefined>)[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const role = get("role");
  const status = get("status");
  const q = get("q");
  return {
    role: STAFF_ROLES.includes(role as StaffRole) ? (role as StaffRole) : null,
    status: STAFF_STATUSES.includes(status as StaffStatus)
      ? (status as StaffStatus)
      : null,
    q: q?.trim() ? q.trim() : null,
  };
}
