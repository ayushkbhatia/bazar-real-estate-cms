"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Wordmark } from "./wordmark";
import { MegamenuTile } from "./megamenu-tile";
import { cn } from "@/lib/utils";
import type {
  Megamenu,
  MegamenuColumn,
  MegamenuTab,
} from "@/lib/schemas/megamenu";

/**
 * Push-to-sub-view mobile drawer.
 *
 *   Level 1: list of 10 tabs. Tap → push to L2.
 *   Level 2: full tab panel (left cols + tiles + right cols) stacked
 *            vertically. Back button returns to L1.
 *
 * Tabs without panels (Insights, About) navigate directly on tap and
 * close the drawer. Pinned bottom row has Saved + List CTA + a
 * session-aware entry: "Sign in" when signed out, "Sign out" (with the
 * current email) when signed in.
 */

type Props = {
  data: Megamenu;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered in the L1 footer above the Saved / List / Sign-in CTAs. */
  footerSlot?: React.ReactNode;
};

function MobileColumn({ column }: { column: MegamenuColumn }) {
  return (
    <div className="flex flex-col gap-1.5">
      {column.heading ? (
        <div className="eyebrow pt-2">{column.heading}</div>
      ) : null}
      <ul className="flex flex-col">
        {column.items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center justify-between py-2.5 text-[15px] text-bz-ink"
            >
              <span>
                {item.label}
                {item.badge_label ? (
                  <span className="ml-2 text-[10.5px] uppercase tracking-wider text-bz-muted">
                    {item.badge_label}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabPanel({
  tab,
  onClose,
  onBack,
}: {
  tab: MegamenuTab;
  onClose: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-[60px] px-4 flex items-center gap-2 border-b border-bz-border bg-bz-bg shrink-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="h-9 w-9 inline-flex items-center justify-center rounded-md text-bz-ink hover:bg-bz-surface-2"
        >
          <ArrowLeft size={18} strokeWidth={1.7} />
        </button>
        <h2
          className="serif italic text-[18px] leading-none truncate"
          style={{ letterSpacing: "-0.015em" }}
        >
          {tab.panel_title ?? tab.label}
        </h2>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-5 flex flex-col gap-7" onClick={onClose}>
          {tab.columns.left.map((column) => (
            <MobileColumn key={column.id} column={column} />
          ))}

          {tab.featured.length > 0 ? (
            <div className="flex flex-col gap-3 pt-2">
              {tab.featured.map((tile) => (
                <MegamenuTile key={tile.id} tile={tile} />
              ))}
            </div>
          ) : null}

          {tab.columns.right.length > 0 ? (
            <div className="flex flex-col gap-4 pt-2 border-t border-bz-border">
              {tab.right_column_title ? (
                <h3
                  className="serif italic text-[20px] leading-tight pt-3"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {tab.right_column_title}
                </h3>
              ) : null}
              {tab.columns.right.map((column) => (
                <MobileColumn key={column.id} column={column} />
              ))}
            </div>
          ) : null}

          {tab.panel_title_href ? (
            <Link
              href={tab.panel_title_href}
              className="mt-2 inline-flex items-center justify-center py-3 rounded-md bg-bz-accent text-bz-accent-fg hover:bg-bz-accent-hover text-[14px]"
            >
              View all {tab.label.toLowerCase()}
            </Link>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function TabsList({
  data,
  onPick,
  onClose,
  footerSlot,
}: {
  data: Megamenu;
  onPick: (tab: MegamenuTab) => void;
  onClose: () => void;
  footerSlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-[60px] px-5 flex items-center border-b border-bz-border bg-bz-bg shrink-0">
        <Wordmark />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <ul className="flex flex-col">
          {data.tabs.map((tab) => {
            const Inner = (
              <span className="flex items-center justify-between w-full">
                <span className="text-[17px] text-bz-ink">{tab.label}</span>
                {tab.has_panel ? (
                  <ChevronRight
                    size={18}
                    strokeWidth={1.6}
                    className="text-bz-muted"
                  />
                ) : null}
              </span>
            );
            return (
              <li key={tab.id} className="border-b border-bz-border">
                {tab.has_panel ? (
                  <button
                    type="button"
                    onClick={() => onPick(tab)}
                    className="w-full px-5 py-4 text-left hover:bg-bz-surface-2"
                  >
                    {Inner}
                  </button>
                ) : (
                  <Link
                    href={tab.href ?? "#"}
                    onClick={onClose}
                    className="block w-full px-5 py-4 hover:bg-bz-surface-2"
                  >
                    {Inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </ScrollArea>

      <div className="border-t border-bz-border bg-bz-surface px-4 py-3 flex flex-col gap-2 shrink-0">
        {footerSlot}
        <Button asChild size="sm">
          <Link href="/services/sell" onClick={onClose}>
            List a property
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function PublicMegaNavMobile({
  data,
  open,
  onOpenChange,
  footerSlot,
}: Props) {
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Reset to L1 whenever the drawer closes so the next open is a fresh start.
  const handleOpenChange = (next: boolean) => {
    if (!next) setActiveTabId(null);
    onOpenChange(next);
  };

  const activeTab =
    activeTabId !== null ? data.tabs.find((t) => t.id === activeTabId) : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full sm:max-w-md p-0 gap-0",
          // Hide the default close button — we render our own back arrow.
          "[&>button.absolute]:hidden",
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Bazar site navigation menu</SheetDescription>
        </SheetHeader>
        {activeTab ? (
          <TabPanel
            tab={activeTab}
            onClose={() => onOpenChange(false)}
            onBack={() => setActiveTabId(null)}
          />
        ) : (
          <TabsList
            data={data}
            onPick={(tab) => setActiveTabId(tab.id)}
            onClose={() => onOpenChange(false)}
            footerSlot={footerSlot}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
