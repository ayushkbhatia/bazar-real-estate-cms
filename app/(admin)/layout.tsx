import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

const STAFF_ROLES = [
  "admin",
  "editor",
  "agent",
  "marketing",
  "support",
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sign-in gate runs in proxy.ts. We add a role gate here so a signed-in
  // non-staff visitor sees 404 (via notFound()) rather than the admin
  // chrome. requireRole short-circuits in the no-Supabase dev case via
  // its own createSupabaseServerClient throw — we skip it explicitly
  // here so a half-configured local environment still renders the page
  // shell instead of an error boundary.
  if (isSupabaseConfigured) {
    await requireRole(STAFF_ROLES);
  }
  return <>{children}</>;
}
