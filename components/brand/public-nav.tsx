"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { Wordmark } from "./wordmark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { label: string; href: string }[] = [
  { label: "Buy", href: "/buy" },
  { label: "Rent", href: "/rent" },
  { label: "Off-Plan", href: "/off-plan" },
  { label: "Commercial", href: "/commercial" },
  { label: "Sell", href: "/services/sell" },
  { label: "Insights", href: "/insights" },
];

export function PublicNav() {
  const pathname = usePathname();

  return (
    <header className="h-[72px] px-12 flex items-center gap-8 border-b border-bz-border bg-bz-bg">
      <Link href="/" className="flex items-center">
        <Wordmark />
      </Link>
      <nav className="flex gap-7 text-[13.5px] text-bz-ink-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "hover:text-bz-ink transition-colors",
                isActive && "text-bz-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex gap-2 items-center">
        <Button asChild variant="ghost" size="sm">
          <Link href="/account/saved">
            <Heart size={14} strokeWidth={1.6} />
            Saved
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/services/sell">List a property</Link>
        </Button>
      </div>
    </header>
  );
}
