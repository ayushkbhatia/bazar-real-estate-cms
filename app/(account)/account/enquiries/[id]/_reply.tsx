"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sendAccountReplyAction } from "./_actions";

export function ReplyComposer({
  enquiryId,
  conversationId,
}: {
  enquiryId: string;
  conversationId: string | null;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!conversationId) {
    return (
      <p className="text-[13px] text-bz-muted italic">
        Reply composer activates once an advisor opens this thread.
      </p>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const text = body.trim();
    if (!text) {
      setError("Write something first.");
      return;
    }
    startTransition(async () => {
      const result = await sendAccountReplyAction({
        enquiryId,
        conversationId: conversationId!,
        body: text,
      });
      if (result.status === "ok") {
        setBody("");
        router.refresh();
      } else {
        setError(result.message ?? "Could not send. Try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label
        htmlFor="reply-body"
        className="text-[11.5px] uppercase tracking-wider text-bz-muted"
      >
        Reply
      </label>
      <textarea
        id="reply-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Send a follow-up to your advisor…"
        className="w-full rounded-md border border-bz-border bg-bz-bg px-4 py-3 text-[14px] leading-relaxed resize-y focus:outline-none focus:border-bz-border-strong"
        disabled={pending}
      />
      {error ? (
        <p className="text-[12.5px] text-bz-danger">{error}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
