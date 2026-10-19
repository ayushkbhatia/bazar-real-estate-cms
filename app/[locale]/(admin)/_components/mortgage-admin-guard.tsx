"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isMortgageAdminPath } from "./mortgage-admin-paths";

/**
 * Keeps a Mortgage Admin inside the mortgage module.
 *
 * The admin layout persists across client navigations, so a check made there
 * on the server runs once per full load, not once per page. This one runs on
 * every pathname. Anywhere else in /admin renders nothing and goes to the
 * queue instead. It is the courtesy, not the boundary: `is_staff()` refuses a
 * Mortgage Admin on every other table (0165), so a page that slipped through
 * would have nothing to show.
 */
export function MortgageAdminGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = isMortgageAdminPath(pathname);

  useEffect(() => {
    if (!allowed) router.replace("/admin/mortgages");
  }, [allowed, router]);

  return allowed ? children : null;
}
