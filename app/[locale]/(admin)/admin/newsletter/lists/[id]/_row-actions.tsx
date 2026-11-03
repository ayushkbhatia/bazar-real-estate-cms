"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeContact, unsubscribeContact } from "../_actions";

export function ContactRowActions({ listId, contactId, active }: { listId: string; contactId: string; active: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ status: string; message: string }>, confirm: string) => {
    if (!window.confirm(confirm)) return;
    start(async () => {
      const r = await fn();
      if (r.status === "error") toast.error(r.message);
      else {
        toast.success(r.message);
        router.refresh();
      }
    });
  };
  return (
    <span className="inline-flex gap-3 text-[12px]">
      {active ? (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(
              () => unsubscribeContact(listId, contactId),
              "Unsubscribe this person? They won't receive anything from any list or the newsletter again.",
            )
          }
          className="text-bz-ink-2 hover:text-bz-ink underline"
        >
          Unsubscribe
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => run(() => removeContact(listId, contactId), "Remove this person from the list?")}
        className="text-bz-muted hover:text-[oklch(0.45_0.13_28)] underline"
      >
        Remove
      </button>
    </span>
  );
}
