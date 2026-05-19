import { CmsShell } from "@/components/brand/cms-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Note: auth + role gate enforced by middleware.ts.
  // Once the staff table exists (Phase 1 DB migration), this layout will
  // additionally check that the user has a staff row + active role.
  return (
    <CmsShell
      title="Dashboard"
      breadcrumbs="Workspace"
    >
      {children}
    </CmsShell>
  );
}
