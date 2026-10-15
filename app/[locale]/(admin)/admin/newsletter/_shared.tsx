import Link from "next/link";
import { Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAMPAIGN_STATUS_LABELS, type CampaignStatus } from "@/lib/newsletter/campaign";

/** Campaigns | Subscribers, the two halves of /admin/newsletter. */
export function NewsletterTabs({
  active,
  counts,
}: {
  active: "campaigns" | "subscribers";
  counts: { campaigns: number; confirmed: number };
}) {
  const tabs = [
    { id: "campaigns", label: "Newsletters", href: "/admin/newsletter", icon: Send, count: counts.campaigns },
    { id: "subscribers", label: "Subscribers", href: "/admin/newsletter/subscribers", icon: Users, count: counts.confirmed },
  ] as const;
  return (
    <nav
      aria-label="Newsletter"
      className="inline-flex w-fit flex-wrap rounded-md border border-bz-border bg-bz-bg p-0.5"
    >
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] transition-colors",
              on ? "bg-bz-navy text-bz-bg font-medium" : "text-bz-ink-2 hover:text-bz-ink",
            )}
          >
            <tab.icon size={12} strokeWidth={1.8} />
            {tab.label}
            <span className={cn("mono text-[10.5px]", on ? "text-bz-bg/80" : "text-bz-muted")}>{tab.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const STATUS_STYLE: Record<CampaignStatus, string> = {
  draft: "bg-bz-surface-2 text-bz-ink-2",
  scheduled: "bg-[oklch(0.95_0.04_250)] text-[oklch(0.38_0.09_250)]",
  sending: "bg-[oklch(0.95_0.05_85)] text-[oklch(0.42_0.09_70)]",
  sent: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  cancelled: "bg-bz-surface-2 text-bz-muted",
};

export function CampaignStatusPill({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium whitespace-nowrap",
        STATUS_STYLE[status],
      )}
    >
      {CAMPAIGN_STATUS_LABELS[status]}
    </span>
  );
}

/** "15 Oct 2026, 14:30" in Abu Dhabi time, which is where the team reads it. */
export function formatDubai(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  }).format(new Date(iso));
}
