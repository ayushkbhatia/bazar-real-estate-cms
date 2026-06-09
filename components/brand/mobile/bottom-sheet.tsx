"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

/**
 * Bottom sheet (handoff `MSheet`) — wraps the shadcn `Sheet`
 * (`side="bottom"`), which is Radix Dialog, so we get scrim, focus
 * trap, scroll-lock and ESC for free. Adds the grab handle, rounded top
 * corners, a scrollable body, and a footer with home-indicator safe
 * area. Used for search filters, the CMS "More" menu, preferences, etc.
 *
 * A SheetTitle is always rendered for accessibility; when `title` is
 * omitted the header is visually hidden but still announced.
 *
 * `trigger` is optional — pass a <SheetTrigger asChild> node for the
 * uncontrolled pattern, or drive `open`/`onOpenChange` directly.
 */
export function BottomSheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  footer,
  maxHeight = "92dvh",
  className,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  maxHeight?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        style={{ maxHeight }}
        className={cn("gap-0 rounded-t-2xl p-0", className)}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-bz-border-strong" />
        <SheetHeader className={cn("px-5 pt-3 pb-2", !title && "sr-only")}>
          <SheetTitle>{title ?? "Menu"}</SheetTitle>
          {description != null && (
            <SheetDescription>{description}</SheetDescription>
          )}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-4">
          {children}
        </div>
        {footer != null && (
          <SheetFooter className="flex-row gap-2 border-t border-bz-border px-4 pt-3 pb-bar-safe">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
