import { notFound, redirect } from "next/navigation";
import { getCurrentStaffRow, getCurrentUser } from "@/lib/auth";
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
  // chrome. This is also the *real* auth boundary: the proxy verifies the
  // JWT locally and cheaply, while `getCurrentUser` below asks Supabase Auth
  // directly. The queries short-circuit in the no-Supabase dev case via
  // createSupabaseServerClient's throw — we skip them explicitly here so a
  // half-configured local environment still renders the page shell instead
  // of an error boundary.
  if (!isSupabaseConfigured) {
    return (
      <AdminSessionProvider value={EMPTY_SESSION}>
        {children}
      </AdminSessionProvider>
    );
  }

  // Three round-trips to Supabase, and only two of them have to happen in
  // sequence. `getCurrentUser` has to land before anything else can run — the
  // staff row is looked up by its id, and the notifications are scoped to it.
  // But the staff row and the notifications don't need *each other*, and this
  // used to await them one after the other because `requireRole` bundles the
  // first two hops together.
  //
  // So the identity hop is taken on its own, then the other two race. The
  // role gate below is `requireRole`'s, re-stated here rather than called —
  // both of its queries are `cache()`d underneath, so it would be a second
  // no-op call, but writing the checks out is clearer than relying on that.
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  const [staff, seed] = await Promise.all([
    getCurrentStaffRow(),
    // Failure here must not take down the admin area: an empty bell is a
    // cosmetic loss, a thrown layout is the whole CMS.
    listRecentNotifications(10, user).catch((err) => {
      console.error("[admin/layout] notifications seed failed", err);
      return { rows: [], unread: 0 };
    }),
  ]);

  // Same verdict as requireRole: a 404, so an unauthorised caller can't tell
  // whether the route exists.
  if (!staff) notFound();
  if (staff.status !== "active") notFound();
  if (!STAFF_ROLES.includes(staff.role as (typeof STAFF_ROLES)[number]))
    notFound();

  const { rows, unread } = seed;

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
