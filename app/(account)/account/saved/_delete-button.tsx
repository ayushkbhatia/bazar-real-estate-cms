"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSavedSearch } from "@/app/(account)/_actions";

export function DeleteSavedSearchButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this saved search?")) return;
        startTransition(async () => {
          const result = await deleteSavedSearch(id);
          if (result.status === "error") toast.error(result.message);
          else if (result.status === "ok") toast.success("Deleted.");
        });
      }}
      className="text-bz-muted hover:text-bz-ink p-1.5"
      aria-label="Delete saved search"
    >
      <Trash2 size={14} strokeWidth={1.8} />
    </button>
  );
}
