"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  deleteArticlePermanently,
  restoreArticle,
  setArticleArchived,
  trashArticle,
} from "./_actions";

/** Red icon, red wash, red ring — matches the media library's trash button. */
const DANGER_HOVER =
  "hover:text-[oklch(0.45_0.13_28)] hover:bg-[oklch(0.95_0.05_28)] hover:ring-1 hover:ring-[oklch(0.82_0.08_28)] hover:shadow-[0_0_0_4px_oklch(0.45_0.13_28_/_0.14)] dark:hover:bg-[oklch(0.3_0.08_28)] dark:hover:ring-[oklch(0.45_0.12_28)]";
const NEUTRAL_HOVER = "hover:text-bz-ink hover:bg-bz-surface-2";

export function BlogRowActions({
  id,
  title,
  archived,
  trashed,
  canDestroy,
}: {
  id: string;
  title: string;
  archived: boolean;
  trashed: boolean;
  canDestroy: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function run(action: () => Promise<{ status: string; message: string }>) {
    setBusy(true);
    startTransition(async () => {
      const result = await action();
      setBusy(false);
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  if (busy) {
    return (
      <Loader2
        size={13}
        className="animate-spin text-bz-muted"
        aria-label="Working"
      />
    );
  }

  if (trashed) {
    return (
      <span className="inline-flex items-center gap-1">
        <IconButton
          label="Restore"
          onClick={() => run(() => restoreArticle(id))}
        >
          <RotateCcw size={13} strokeWidth={1.7} />
        </IconButton>
        {canDestroy ? (
          <IconButton
            label="Delete permanently"
            danger
            onClick={() => {
              if (
                !confirm(
                  `Permanently delete "${title}"? The post and its content are gone for good.`,
                )
              )
                return;
              run(() => deleteArticlePermanently(id));
            }}
          >
            <Trash2 size={13} strokeWidth={1.7} />
          </IconButton>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <IconButton
        label={archived ? "Unarchive (back to draft)" : "Archive"}
        onClick={() => run(() => setArticleArchived(id, !archived))}
      >
        {archived ? (
          <ArchiveRestore size={13} strokeWidth={1.7} />
        ) : (
          <Archive size={13} strokeWidth={1.7} />
        )}
      </IconButton>
      <IconButton
        label="Move to trash"
        danger
        onClick={() => run(() => trashArticle(id))}
      >
        <Trash2 size={13} strokeWidth={1.7} />
      </IconButton>
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "h-6 w-6 text-bz-muted transition-all",
        danger ? DANGER_HOVER : NEUTRAL_HOVER,
      )}
    >
      {children}
    </Button>
  );
}
