"use client";

import { useState } from "react";
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
  ClipboardCheck,
  Handshake,
  ScrollText,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";
import { NotificationsBell } from "./notifications-bell";
import { NotificationsChime } from "@/lib/realtime/notifications-chime";
import { CmsUserPile } from "./cms-user-pile";
import { CmsSearchInput } from "./cms-search-input";
import { AppBar } from "./mobile/app-bar";
import { MobileTabBar, type TabItem } from "./mobile/mobile-tab-bar";
import { BottomSheet } from "./mobile/bottom-sheet";

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
      { label: "Audit log", href: "/admin/audit-log", icon: ScrollText },
    ],
  },
];

// The 5 NAV_GROUPS (13 links) collapse to 5 thumb-reachable tabs on
// mobile. Each non-More tab links to its group's primary destination;
// "More" opens a bottom sheet exposing the full NAV_GROUPS (single
// source of truth). Active-tab is derived from the pathname so the
// server and client agree (no hydration mismatch).
const CMS_PRIMARY_TABS = [
  { key: "home", label: "Home", href: "/admin", icon: Home },
  { key: "catalogue", label: "Catalogue", href: "/admin/properties", icon: Building2 },
  { key: "inbox", label: "Inbox", href: "/admin/enquiries", icon: Inbox },
  { key: "content", label: "Content", href: "/admin/blog", icon: FileText },
] as const;

function activeCmsTab(pathname: string | null): string {
  const p = pathname ?? "";
  if (p === "/admin" || p.startsWith("/admin/analytics")) return "home";
  if (["/admin/properties", "/admin/media", "/admin/agents"].some((m) => p.startsWith(m)))
    return "catalogue";
  if (["/admin/enquiries", "/admin/valuations", "/admin/deals"].some((m) => p.startsWith(m)))
    return "inbox";
  if (["/admin/blog", "/admin/pages"].some((m) => p.startsWith(m))) return "content";
  return "more";
}

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
  const [moreOpen, setMoreOpen] = useState(false);
  const activeTab = activeCmsTab(pathname);

  const mobileTabs: TabItem[] = [
    ...CMS_PRIMARY_TABS.map((t) => ({
      key: t.key,
      label: t.label,
      icon: t.icon,
      href: t.href,
      isActive: activeTab === t.key,
    })),
    {
      key: "more",
      label: "More",
      icon: MoreHorizontal,
      isActive: activeTab === "more",
      onClick: () => setMoreOpen(true),
    },
  ];

  // Chrome adapts by breakpoint; `children` is rendered ONCE in the
  // shared <main> below (never duplicated across the two trees).
  return (
    <div className="h-full min-h-dvh-safe md:grid md:grid-cols-[240px_1fr] md:min-h-screen">
      {/* Desktop sidebar (≥ md) */}
      <aside className="hidden md:flex bg-bz-surface border-r border-bz-border flex-col py-5 px-3.5 gap-1">
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
                      ? "bg-bz-navy text-bz-bg"
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
        <div className="mt-auto pt-4 border-t border-bz-border">
          <CmsUserPile />
        </div>
      </aside>

      <div className="flex flex-col min-w-0 md:overflow-hidden">
        {/* Desktop topbar (≥ md) */}
        <header className="hidden md:flex h-[60px] px-7 items-center gap-4 border-b border-bz-border bg-bz-surface">
          <div className="flex-1 min-w-0">
            {breadcrumbs ? (
              <div className="text-[11.5px] text-bz-muted mb-0.5 [&_a]:text-bz-teal [&_a:hover]:text-bz-navy [&_.mono]:text-bz-navy">
                {breadcrumbs}
              </div>
            ) : null}
            <div className="text-[18px] font-medium tracking-tight">
              {title}
            </div>
          </div>
          <CmsSearchInput />
          {live}
          <NotificationsChime />
          {notifications ?? <NotificationsBell />}
          {secondary}
          {primary}
        </header>

        {/* Mobile app bar (< md) */}
        <div className="md:hidden">
          <AppBar
            brand="CMS"
            title={title}
            actions={
              <>
                {live}
                <NotificationsChime />
                {notifications ?? <NotificationsBell />}
                {secondary}
                {primary}
              </>
            }
          />
        </div>

        {/* Shared content — rendered once for both breakpoints */}
        <main className="flex-1 overflow-auto p-4 md:p-7 pb-[calc(var(--bz-tabbar-h)+16px)] md:pb-7">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar + "More" sheet (< md) */}
      <div className="md:hidden">
        <MobileTabBar tabs={mobileTabs} />
        <BottomSheet open={moreOpen} onOpenChange={setMoreOpen} title="Menu">
          <div className="flex flex-col gap-4 pb-2">
            {NAV_GROUPS.map((g) => (
              <div key={g.group}>
                <div className="px-1 pb-1.5 text-[10.5px] font-medium tracking-widest text-bz-muted-2 uppercase">
                  {g.group}
                </div>
                <div className="flex flex-col">
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
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2 py-2.5 text-[14px] transition-colors",
                          isActive
                            ? "bg-bz-navy text-bz-bg"
                            : "text-bz-ink-2 active:bg-bz-surface-2",
                        )}
                      >
                        <Icon size={17} strokeWidth={1.6} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="border-t border-bz-border pt-3">
              <CmsUserPile />
            </div>
          </div>
        </BottomSheet>
      </div>
    </div>
  );
}
