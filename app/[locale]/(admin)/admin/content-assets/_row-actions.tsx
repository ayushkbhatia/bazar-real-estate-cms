"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { restoreContentAsset, trashContentAsset } from "./_actions";

/** Red icon, red wash, red ring — matches the media library's trash button. */
const DANGER_HOVER =
  "hover:text-[oklch(0.45_0.13_28)] hover:bg-[oklch(0.95_0.05_28)] hover:ring-1 hover:ring-[oklch(0.82_0.08_28)] hover:shadow-[0_0_0_4px_oklch(0.45_0.13_28_/_0.14)] dark:hover:bg-[oklch(0.3_0.08_28)] dark:hover:ring-[oklch(0.45_0.12_28)]";
const NEUTRAL_HOVER = "hover:text-bz-ink hover:bg-bz-surface-2";

export function AssetRowActions({
  id,
  name,
  trashed,
  system = false,
}: {
  id: string;
  name: string;
  trashed: boolean;
  /**
   * A system email has no trash: deleting one would leave a send path with
   * nothing to say. Unpublishing is what "remove this" means for these, and
   * that lives in the editor.
   */
  system?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function run(action: () => Promise<{ status: string; message?: string }>) {
    setBusy(true);
    startTransition(async () => {
      const result = await action();
      setBusy(false);
      if (result.status === "ok") {
        toast.success(result.message ?? "Done.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Something went wrong.");
      }
    });
  }

  if (system) {
    return (
      <span
        title="System emails can't be deleted — set one back to draft to return to the built-in wording"
        className="inline-flex h-6 w-6 items-center justify-center text-bz-muted"
      >
        <Lock size={12} strokeWidth={1.8} />
      </span>
    );
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

  return trashed ? (
    <IconButton
      label="Restore as draft"
      onClick={() => run(() => restoreContentAsset(id))}
    >
      <RotateCcw size={13} strokeWidth={1.7} />
    </IconButton>
  ) : (
    <IconButton
      label={`Move "${name}" to trash`}
      danger
      onClick={() => run(() => trashContentAsset(id))}
    >
      <Trash2 size={13} strokeWidth={1.7} />
    </IconButton>
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
  // The tooltip hangs on the wrapper, not the button: a disabled button gets
  // `pointer-events-none`, which swallows both the hover styles and its own
  // title attribute.
  return (
    <span title={label} className="inline-flex">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        onClick={onClick}
        className={cn(
          "h-6 w-6 text-bz-muted transition-all",
          danger ? DANGER_HOVER : NEUTRAL_HOVER,
        )}
      >
        {children}
      </Button>
    </span>
  );
}
