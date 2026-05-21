"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestDataExport } from "./_actions";

export function RequestExportForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await requestDataExport();
      if (result.status === "ok") {
        setMessage({ kind: "success", text: result.message });
        toast.success(result.message);
      } else {
        setMessage({ kind: "error", text: result.message });
        toast.error(result.message);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
      <Button type="submit" disabled={pending}>
        <Download size={14} strokeWidth={1.8} />
        {pending ? "Sending email…" : "Request data export"}
      </Button>
      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`text-[13px] leading-snug max-w-[50ch] ${
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
