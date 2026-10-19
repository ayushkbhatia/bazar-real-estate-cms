/** The parts of /admin a Mortgage Admin may open: the module and its stages. */
export const MORTGAGE_ADMIN_PATHS = [
  "/admin/mortgages",
  "/admin/pages/mortgage-stages",
] as const;

export function isMortgageAdminPath(pathname: string | null): boolean {
  const p = pathname ?? "";
  return MORTGAGE_ADMIN_PATHS.some((root) => p === root || p.startsWith(`${root}/`));
}
