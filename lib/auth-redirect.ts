/**
 * Post-sign-in landing resolution — shared by the customer `/sign-in` and the
 * staff `/admin/login` pages. Pure and framework-free so it can be unit-tested
 * without a Supabase session; the caller supplies `isStaff` (looked up from the
 * `staff` table) and the raw `redirect` form value.
 */

/**
 * Accept only a same-origin relative path (`/foo`). Rejects absolute URLs,
 * protocol-relative (`//evil.com`) and anything not starting with a single
 * slash — the guard against open-redirect abuse via `?redirect=`.
 */
export function safeRelativePath(
  candidate: string | null | undefined,
): string | null {
  if (typeof candidate !== "string") return null;
  const value = candidate.trim();
  if (!value.startsWith("/")) return null;
  // "//host" and "/\host" are browser-interpreted as protocol-relative URLs.
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/**
 * Decide where a freshly-signed-in user should land.
 *
 * - An explicit, safe `requested` path wins — EXCEPT an `/admin` destination is
 *   never honoured for a non-staff user (they'd only bounce off the role gate),
 *   so they fall back to their account home.
 * - With no usable request, staff go to `/admin`. Customer accounts were
 *   removed, so everyone else goes to the marketplace home.
 */
export function pickPostSignInPath(opts: {
  isStaff: boolean;
  requested?: string | null;
}): string {
  const safe = safeRelativePath(opts.requested);
  if (safe) {
    const isAdminDest = safe === "/admin" || safe.startsWith("/admin/");
    if (isAdminDest && !opts.isStaff) return "/";
    return safe;
  }
  return opts.isStaff ? "/admin" : "/";
}
