"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BarChart3,
  Building2,
  Image as ImageIcon,
  Users,
  Inbox,
  FileText,
  Layers,
  Settings,
  Search,
  MoreVertical,
  ClipboardCheck,
  Handshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";
import { NotificationsBell } from "./notifications-bell";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: "Workspace",
    items: [
      { label: "Dashboard", href: "/admin", icon: Home },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    group: "Catalogue",
    items: [
      { label: "Properties", href: "/admin/properties", icon: Building2 },
      { label: "Media library", href: "/admin/media", icon: ImageIcon },
      { label: "Agents & team", href: "/admin/agents", icon: Users },
    ],
  },
  {
    group: "Inbox",
    items: [
      { label: "Enquiries", href: "/admin/enquiries", icon: Inbox },
      {
        label: "Valuations",
        href: "/admin/valuations",
        icon: ClipboardCheck,
      },
      { label: "Deals", href: "/admin/deals", icon: Handshake },
    ],
  },
  {
    group: "Content",
    items: [
      { label: "Blog editor", href: "/admin/blog", icon: FileText },
      { label: "Pages & blocks", href: "/admin/pages", icon: Layers },
    ],
  },
  {
    group: "Admin",
    items: [
      { label: "Users & roles", href: "/admin/users", icon: Users },
      { label: "Site settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

type CmsShellProps = {
  title: string;
  breadcrumbs?: React.ReactNode;
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  /**
   * Optional notifications slot rendered in the topbar before `secondary`.
   * When omitted the shell falls back to the static placeholder bell — so
   * existing call sites stay valid. Added by Phase 6e.
   */
  notifications?: React.ReactNode;
  /**
   * Optional "Live" indicator rendered in the topbar before notifications.
   * Pages that subscribe to Supabase Realtime pass <LiveDot /> here. Added
   * by Phase H.
   */
  live?: React.ReactNode;
  children: React.ReactNode;
};

export function CmsShell({
  title,
  breadcrumbs,
  primary,
  secondary,
  notifications,
  live,
  children,
}: CmsShellProps) {
  const pathname = usePathname();

  return (
    <div className="grid grid-cols-[240px_1fr] h-full min-h-screen">
      <aside className="bg-bz-surface border-r border-bz-border flex flex-col py-5 px-3.5 gap-1">
        <div className="px-2.5 pb-5">
          <Link href="/admin" className="flex items-center">
            <Wordmark sublabel="CMS" size="sm" />
          </Link>
        </div>
        {NAV_GROUPS.map((g) => (
          <div key={g.group}>
            <div className="px-2.5 pt-3.5 pb-1.5 text-[10.5px] font-medium tracking-widest text-bz-muted-2 uppercase">
              {g.group}
            </div>
            {g.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded text-[13px] cursor-pointer transition-colors",
                    isActive
                      ? "bg-bz-ink text-bz-bg"
                      : "text-bz-ink-2 hover:bg-bz-surface-2",
                  )}
                >
                  <Icon size={15} strokeWidth={1.6} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
        <div className="mt-auto pt-4 border-t border-bz-border flex items-center gap-2.5 px-2.5">
          <div className="w-8 h-8 rounded-full bg-bz-surface-3 text-bz-ink flex items-center justify-center text-[12px] font-medium">
            MA
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium truncate">
              Mariam Al-Hashimi
            </div>
            <div className="text-[11px] text-bz-muted">Admin</div>
          </div>
          <MoreVertical size={15} className="text-bz-muted" />
        </div>
      </aside>
      <div className="flex flex-col min-w-0 overflow-hidden">
        <header className="h-[60px] px-7 flex items-center gap-4 border-b border-bz-border bg-bz-surface">
          <div className="flex-1 min-w-0">
            {breadcrumbs ? (
              <div className="text-[11.5px] text-bz-muted mb-0.5">
                {breadcrumbs}
              </div>
            ) : null}
            <div className="text-[18px] font-medium tracking-tight">
              {title}
            </div>
          </div>
          <div className="relative w-[280px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted"
            />
            <input
              type="search"
              placeholder="Search anything…"
              className="w-full h-10 pl-9 pr-3 bg-bz-surface border border-bz-border rounded text-[13.5px] outline-none focus:border-bz-ink-2 transition-colors"
            />
          </div>
          {live}
          {notifications ?? <NotificationsBell />}
          {secondary}
          {primary}
        </header>
        <main className="p-7 overflow-auto flex-1">{children}</main>
      </div>
    </div>
  );
}
