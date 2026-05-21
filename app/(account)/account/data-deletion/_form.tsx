"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestAccountDeletion } from "./_actions";

export function RequestDeletionForm() {
  const [pending, startTransition] = useTransition();
  const [confirmInput, setConfirmInput] = useState("");
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const confirmed = confirmInput.trim().toUpperCase() === "DELETE";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await requestAccountDeletion();
      if (result.status === "ok") {
        setMessage({ kind: "success", text: result.message });
        toast.success(result.message);
        setConfirmInput("");
      } else {
        setMessage({ kind: "error", text: result.message });
        toast.error(result.message);
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 border border-[oklch(0.85_0.04_28)] bg-[oklch(0.98_0.02_28)] rounded-lg p-5 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirm-delete"
          className="text-[12.5px] text-bz-ink-2 leading-snug"
        >
          Type{" "}
          <span className="mono font-medium text-bz-ink">DELETE</span> to enable
          the confirm button.
        </label>
        <input
          id="confirm-delete"
          type="text"
          value={confirmInput}
          onChange={(e) => setConfirmInput(e.target.value)}
          className="bz-field h-9 px-3 rounded border border-bz-border bg-bz-bg text-[14px] mono outline-none focus:border-bz-ink-2 max-w-[200px]"
          autoComplete="off"
          aria-describedby="confirm-delete-hint"
        />
      </div>
      <Button
        type="submit"
        disabled={pending || !confirmed}
        variant="destructive"
      >
        <Trash2 size={14} strokeWidth={1.8} />
        {pending ? "Sending email…" : "Request account deletion"}
      </Button>
      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`text-[13px] leading-snug ${
            message.kind === "error"
              ? "text-[oklch(0.5_0.18_28)]"
              : "text-bz-ink-2"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
