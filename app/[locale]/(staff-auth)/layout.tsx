import type { ReactNode } from "react";

/**
 * Minimal chrome for the staff auth surface (`/admin/login`). Deliberately
 * OUTSIDE the `(admin)` route group so its `requireRole` gate doesn't lock
 * signed-out staff out of their own login page, and outside `(public)` so the
 * marketplace mega-nav / footer don't blur the line with the customer sign-in.
 * Just a centred, full-height frame; the page supplies the card.
 */
export default function StaffAuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh-safe flex flex-col items-center justify-center bg-bz-bg px-4 py-10">
      {children}
    </div>
  );
}
