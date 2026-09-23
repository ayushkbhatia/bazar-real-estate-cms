"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { resolveErrorEvent } from "./_actions";

export function ResolveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await resolveErrorEvent(id);
          if (res.status === "ok") toast.success("Marked handled.");
          else toast.error(res.message);
        })
      }
      className="h-7 px-2.5 rounded-md border border-bz-border bg-bz-bg text-[11.5px] text-bz-ink-2 hover:border-bz-border-strong transition-colors disabled:opacity-50"
    >
      {pending ? "Saving…" : "Mark handled"}
    </button>
  );
}
