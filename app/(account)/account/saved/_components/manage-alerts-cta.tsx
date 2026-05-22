import Link from "next/link";
import { Bell, ArrowRight } from "lucide-react";

/**
 * Sprint 6 (backfilled): "Manage alerts" CTA on the saved-searches tab.
 * One-line link to /account/alerts.
 */
export function ManageAlertsCta() {
  return (
    <Link
      href="/account/alerts"
      className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-bz-border bg-bz-bg text-[13px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
    >
      <Bell size={13} strokeWidth={1.7} />
      Manage alerts
      <ArrowRight size={12} strokeWidth={1.7} />
    </Link>
  );
}
