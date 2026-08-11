"use client";

import { createContext, useContext } from "react";
import type { BellNotification } from "@/components/brand/notifications-bell";

export type AdminSessionStaff = {
  display_name: string;
  title: string | null;
  role: string | null;
};

export type AdminSession = {
  userId: string | null;
  email: string | null;
  staff: AdminSessionStaff | null;
  notifications: BellNotification[];
  unread: number;
};

const AdminSessionContext = createContext<AdminSession | null>(null);

/**
 * Who is signed in, resolved once on the server and handed to the chrome.
 *
 * The admin shell renders a desktop tree and a mobile tree and hides one with
 * CSS rather than unmounting it, so every widget in it mounts twice. Each of
 * those copies used to answer "who am I?" for itself from the browser: two
 * notification bells and two chimes each fetching `/api/notifications/recent`,
 * and two user piles each running `getUser()` plus a `staff` select. That was
 * four no-store fetches and a pile of auth round-trips on **every** admin
 * navigation, for an answer the server already had before it rendered the page.
 *
 * The layout is the right place to hold it: it persists across navigations
 * within /admin, so the value is resolved once per session rather than once
 * per page. It already calls `requireRole`, so `user` and `staff` cost nothing
 * extra here.
 *
 * This deliberately does **not** own the realtime subscription. Both trees
 * still mount a bell, and `notifications-bell.tsx` gives each one a `useId`
 * suffix on its channel topic precisely because two subscribers on one
 * `postgres_changes` topic collide and take the shell down. A provider does
 * not reduce the number of mounts, so that suffix stays load-bearing.
 */
export function AdminSessionProvider({
  value,
  children,
}: {
  value: AdminSession;
  children: React.ReactNode;
}) {
  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
}

/**
 * Returns null outside the provider. The chrome components are exported from
 * `components/brand` and could in principle be rendered elsewhere, so they
 * each keep their existing self-fetch as the fallback path rather than
 * throwing — the provider is an optimisation, not a new requirement.
 */
export function useAdminSession(): AdminSession | null {
  return useContext(AdminSessionContext);
}
