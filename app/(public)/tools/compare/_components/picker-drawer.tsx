"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Heart, Clock, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

/**
 * Sprint 5b (backfilled): picker drawer for empty compare slots.
 * Three tabs — Saved, Recently viewed, Search. Today only Search is
 * wired (just a link to /buy); Sprint 9 wires Saved + Recently viewed
 * via the `saved_properties` + `recently_viewed` (Sprint 8) tables.
 */
export function PickerDrawer({
  onPick,
}: {
  onPick?: (propertyId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"saved" | "recent" | "search">("saved");

  // Picker is wired to fire onPick when Sprint 9 lands the saved + recent
  // lookups. Reference here to keep the prop in the contract.
  void onPick;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center w-full h-full min-h-[180px] rounded-lg border-2 border-dashed border-bz-border bg-bz-surface text-bz-muted hover:border-bz-border-strong hover:text-bz-ink-2 transition-colors"
        >
          <div className="text-center">
            <Plus size={20} strokeWidth={1.5} className="mx-auto mb-1.5" />
            <span className="text-[12.5px]">Add to compare</span>
          </div>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add to compare</SheetTitle>
        </SheetHeader>

        <div className="px-6 pt-2">
          <div
            role="tablist"
            aria-label="Picker source"
            className="border-b border-bz-border flex gap-4"
          >
            <TabBtn active={tab === "saved"} onClick={() => setTab("saved")}>
              <Heart size={12} strokeWidth={1.7} />
              Saved
            </TabBtn>
            <TabBtn active={tab === "recent"} onClick={() => setTab("recent")}>
              <Clock size={12} strokeWidth={1.7} />
              Recently viewed
            </TabBtn>
            <TabBtn active={tab === "search"} onClick={() => setTab("search")}>
              <Search size={12} strokeWidth={1.7} />
              Search
            </TabBtn>
          </div>

          <div className="mt-6">
            {tab === "saved" ? (
              <EmptyPanel
                title="No saved listings yet"
                body="Heart a listing to bring it into compare. Sprint 9 wires the saved-properties lookup."
                href="/account/saved"
                cta="Open saved"
              />
            ) : tab === "recent" ? (
              <EmptyPanel
                title="Recently viewed activates in Sprint 8"
                body="Your last 20 listings will appear here once the recently_viewed table lands."
                href="/buy"
                cta="Browse listings"
              />
            ) : (
              <EmptyPanel
                title="Search the marketplace"
                body="Open the full search to find a listing, then hit the Compare icon on its card to add it here."
                href="/buy"
                cta="Open search"
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "py-2 inline-flex items-center gap-1.5 text-[12.5px] border-b-2 border-bz-ink text-bz-ink -mb-px"
          : "py-2 inline-flex items-center gap-1.5 text-[12.5px] border-b-2 border-transparent text-bz-muted hover:text-bz-ink-2 -mb-px"
      }
    >
      {children}
    </button>
  );
}

function EmptyPanel({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="py-10 text-center max-w-[36ch] mx-auto">
      <p className="text-[14px] text-bz-ink-2 font-medium">{title}</p>
      <p className="mt-2 text-[12.5px] text-bz-muted leading-relaxed">
        {body}
      </p>
      <Button asChild variant="outline" className="mt-5">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}
