/**
 * Who may act on a request (SPEC §7): the Head of mortgages on any, an adviser
 * on the ones they own. The database decides every action again
 * (`mortgage_authorise()`, 0143); an action asks this first only when it has a
 * step of its own to take before the database is asked (SECURITY-REVIEW SR-12).
 */
export function mayActOn(role: "head" | "adviser", ownerId: string | null, userId: string): boolean {
  return role === "head" || (ownerId !== null && ownerId === userId);
}
