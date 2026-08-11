import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { listRecentNotifications } from "@/lib/notifications";
import {
  AdminSessionProvider,
  type AdminSession,
} from "./_components/admin-session";

// Every admin route is auth-gated and reads cookies (role gate below +
// per-request Supabase queries), so none can be statically prerendered.
// Declaring the whole segment dynamic stops `next build` from attempting a
// static render and then logging the expected `DYNAMIC_SERVER_USAGE` bail as
// an error (e.g. the dashboard's kpis / recent-activity fetches). Mirrors the
// existing admin/settings layout.
export const dynamic = "force-dynamic";

const STAFF_ROLES = [
  "admin",
  "editor",
  "agent",
  "marketing",
  "support",
] as const;

const EMPTY_SESSION: AdminSession = {
  userId: null,
  email: null,
  staff: null,
  notifications: [],
  unread: 0,
};

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
  if (!isSupabaseConfigured) {
    return (
      <AdminSessionProvider value={EMPTY_SESSION}>
        {children}
      </AdminSessionProvider>
    );
  }

  const { user, staff } = await requireRole(STAFF_ROLES);

  // Seeds the chrome so the notification bells, chimes and user piles don't
  // each go and ask the browser who is signed in. See admin-session.tsx for
  // why that mattered — the shell mounts every one of them twice.
  //
  // Failure here must not take down the admin area: an empty bell is a
  // cosmetic loss, a thrown layout is the whole CMS.
  const { rows, unread } = await listRecentNotifications(10, user).catch(
    (err) => {
      console.error("[admin/layout] notifications seed failed", err);
      return { rows: [], unread: 0 };
    },
  );

  return (
    <AdminSessionProvider
      value={{
        userId: user.id,
        email: user.email ?? null,
        staff: {
          display_name: staff.display_name,
          title: staff.title,
          role: staff.role,
        },
        notifications: rows,
        unread,
      }}
    >
      {children}
    </AdminSessionProvider>
  );
}
