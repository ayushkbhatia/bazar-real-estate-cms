"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resendConfirmations, unsubscribeSubscriber } from "../_actions";

/** Re-send confirmation (pending) or unsubscribe (confirmed), on one row. */
export function SubscriberRowActions({ id, email, status }: { id: string; email: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (status === "pending") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await resendConfirmations([id]);
            if (r.status === "ok") toast.success(r.message);
            else toast.error(r.message);
            router.refresh();
          })
        }
        className="inline-flex items-center gap-1 text-[12px] text-bz-ink-2 hover:text-bz-ink disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <MailPlus size={12} strokeWidth={1.8} />}
        Re-send confirmation
      </button>
    );
  }
  if (status === "confirmed") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Unsubscribe ${email}? They will stop receiving newsletters.`)) return;
          start(async () => {
            const r = await unsubscribeSubscriber(id);
            if (r.status === "ok") toast.success(r.message);
            else toast.error(r.message);
            router.refresh();
          });
        }}
        className="inline-flex items-center gap-1 text-[12px] text-bz-ink-2 hover:text-bz-ink disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={12} strokeWidth={1.8} />}
        Unsubscribe
      </button>
    );
  }
  return null;
}

/** Re-send confirmation to every pending address. */
export function ResendAllPending({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (count === 0) return null;
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            `Re-send the confirmation email to ${count} pending subscriber${count === 1 ? "" : "s"}? Anyone mailed in the last 24 hours is skipped.`,
          )
        )
          return;
        start(async () => {
          const r = await resendConfirmations("all");
          if (r.status === "ok") toast.success(r.message);
          else toast.error(r.message);
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <MailPlus size={14} strokeWidth={1.8} />}
      Re-send confirmation to all pending ({count})
    </Button>
  );
}
