"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  Calendar,
  Inbox,
  FileText,
  User,
  Bell,
  Share2,
  Mail,
  Download,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};

const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: "Marketplace",
    items: [
      { label: "Saved", href: "/account/saved", icon: Heart },
      { label: "Viewings", href: "/account/viewings", icon: Calendar },
      { label: "Enquiries", href: "/account/enquiries", icon: Inbox },
      { label: "Documents", href: "/account/documents", icon: FileText },
    ],
  },
  {
    group: "Account",
    items: [
      { label: "Profile", href: "/account/profile", icon: User },
      { label: "Alerts", href: "/account/alerts", icon: Bell },
      { label: "Referrals", href: "/account/referrals", icon: Share2 },
      { label: "Newsletter", href: "/account/newsletter", icon: Mail },
    ],
  },
  {
    group: "Data",
    items: [
      { label: "Data export", href: "/account/data-export", icon: Download },
      { label: "Delete account", href: "/account/data-deletion", icon: Trash2 },
    ],
  },
];

export function AccountSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="w-[240px] flex-shrink-0 border-r border-bz-border bg-bz-surface min-h-[calc(100vh-72px)]">
      <div className="px-6 py-8">
        <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
          Account
        </div>
        <div
          className="serif text-[24px] mt-1 leading-tight"
          style={{ letterSpacing: "-0.012em" }}
        >
          My Bazar
        </div>
      </div>
      <nav className="px-3 pb-6 flex flex-col gap-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.group} className="flex flex-col gap-0.5">
            <div className="px-3 pb-2 text-[10.5px] uppercase tracking-widest text-bz-muted">
              {group.group}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/account" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2.5 h-9 px-3 rounded-md text-[13.5px] transition-colors",
                    isActive
                      ? "bg-bz-bg text-bz-ink font-medium"
                      : "text-bz-ink-2 hover:bg-bz-bg/60 hover:text-bz-ink",
                  )}
                >
                  <Icon size={14} strokeWidth={1.6} className="text-bz-muted" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
