"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendMessage } from "../_actions";

export function ReplyComposer({ enquiryId }: { enquiryId: string }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  function onSend() {
    if (!body.trim()) return;
    start(async () => {
      const r = await sendMessage(enquiryId, body);
      if (r.status === "error") toast.error(r.message);
      else {
        toast.success("Reply sent.");
        setBody("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-bz-border">
      <label htmlFor="reply" className="sr-only">
        Reply
      </label>
      <textarea
        id="reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Write a reply — appears in the lead's web inbox. Email + WhatsApp channels arrive in Phase 2.3+."
        className="border border-bz-border rounded p-2 text-[14px] bg-bz-surface focus:border-bz-accent outline-none resize-y"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-bz-muted">
          ⌘+Enter to send. {body.length}/4000.
        </span>
        <Button
          type="button"
          onClick={onSend}
          disabled={pending || !body.trim()}
        >
          <Send size={14} strokeWidth={1.8} />
          {pending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </div>
  );
}
