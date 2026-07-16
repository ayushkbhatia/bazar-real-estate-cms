"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Copy,
  Eye,
  Archive,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

/**
 * Sprint 7b (backfilled): row-kebab on the admin properties table.
 * Duplicate / Preview / Archive / Delete. Delete + Archive land via
 * Sprint 9 bulk operations; for now they toast.
 */
export function PropertyRowKebab({
  reference,
  slug,
  status,
}: {
  // Accepted for a stable call-site API; wiring lands with the Sprint 9
  // single-row delete/archive counterpart.
  propertyId: string;
  reference: string;
  slug: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);

  function notReady(action: string) {
    toast.info(`${action} wires Sprint 9 (single-row counterpart to bulk ops).`);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Row actions"
          className="w-7 h-7 rounded-md text-bz-muted hover:text-bz-ink hover:bg-bz-surface-2 flex items-center justify-center"
        >
          <MoreHorizontal size={14} strokeWidth={1.7} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onSelect={() => notReady(`Duplicate ${reference}`)}
        >
          <Copy size={13} strokeWidth={1.7} />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`/p/${slug}-${reference.toLowerCase()}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Eye size={13} strokeWidth={1.7} />
            Preview public page
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {status !== "archived" ? (
          <DropdownMenuItem onSelect={() => notReady(`Archive ${reference}`)}>
            <Archive size={13} strokeWidth={1.7} />
            Archive
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onSelect={() => notReady(`Delete ${reference}`)}
          className="text-bz-danger"
        >
          <Trash2 size={13} strokeWidth={1.7} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
