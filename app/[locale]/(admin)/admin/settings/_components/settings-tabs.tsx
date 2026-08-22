"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = { label: string; href: string; status: "live" | "stub" };

const TABS: { group: string; items: Tab[] }[] = [
  {
    group: "Identity",
    items: [
      { label: "Brand", href: "/admin/settings/brand", status: "live" },
      { label: "Hero", href: "/admin/settings/hero", status: "live" },
    ],
  },
  {
    group: "Catalogue",
    items: [
      { label: "Property fields", href: "/admin/settings/fields", status: "stub" },
      { label: "Routing", href: "/admin/settings/routing", status: "live" },
      { label: "Mortgage", href: "/admin/settings/mortgage", status: "live" },
    ],
  },
  {
    group: "Platform",
    items: [
      { label: "Domain & SEO", href: "/admin/settings/domain", status: "stub" },
      {
        label: "Integrations",
        // Live since Sprint 13 (Meilisearch / Mapbox / Mailchimp / Resend
        // status cards) — badge was never flipped when the panel shipped.
        href: "/admin/settings/integrations",
        status: "live",
      },
      { label: "Billing", href: "/admin/settings/billing", status: "stub" },
      {
        label: "Compliance",
        href: "/admin/settings/compliance",
        status: "stub",
      },
      { label: "Backups", href: "/admin/settings/backups", status: "stub" },
      { label: "API & webhooks", href: "/admin/settings/api", status: "stub" },
    ],
  },
];

export function SettingsTabs() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="w-full lg:w-[220px] flex-shrink-0 flex flex-col gap-6">
      {TABS.map((group) => (
        <div key={group.group}>
          <div className="px-3 pb-2 text-[10.5px] uppercase tracking-widest text-bz-muted-2">
            {group.group}
          </div>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    className={cn(
                      "flex items-center justify-between px-3 py-1.5 rounded text-[13px] transition-colors",
                      isActive
                        ? "bg-bz-navy text-bz-bg font-medium"
                        : "text-bz-ink-2 hover:bg-bz-surface-2",
                    )}
                  >
                    <span>{tab.label}</span>
                    {tab.status === "stub" ? (
                      <span
                        className={cn(
                          "text-[9.5px] uppercase tracking-wider",
                          isActive ? "text-bz-bg/70" : "text-bz-muted",
                        )}
                      >
                        Stub
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
