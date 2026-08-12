"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteLandingPage, duplicateLandingPage } from "./_actions";

export function RowActions({
  id,
  slug,
  title,
  status,
}: {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function onDuplicate() {
    startTransition(async () => {
      const result = await duplicateLandingPage(id);
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function onDelete() {
    if (
      !confirm(
        `Delete "${title}"? The page stops resolving at /lp/${slug} straight away.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteLandingPage(id);
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label={`Actions for ${title}`}
          className="h-8 w-8 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-ink hover:bg-bz-surface-2 disabled:opacity-50"
        >
          <MoreHorizontal size={15} strokeWidth={1.8} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem asChild>
          <Link href={`/admin/page-builder/${id}`}>
            <Pencil size={13} strokeWidth={1.7} /> Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/admin/page-builder/${id}/preview`}>
            <Eye size={13} strokeWidth={1.7} /> Preview
          </Link>
        </DropdownMenuItem>
        {status === "published" ? (
          <DropdownMenuItem asChild>
            <a href={`/lp/${slug}`} target="_blank" rel="noreferrer">
              <Eye size={13} strokeWidth={1.7} /> View live
            </a>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy size={13} strokeWidth={1.7} /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={onDelete}
          className="text-[oklch(0.45_0.13_28)] focus:text-[oklch(0.45_0.13_28)]"
        >
          <Trash2 size={13} strokeWidth={1.7} /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
