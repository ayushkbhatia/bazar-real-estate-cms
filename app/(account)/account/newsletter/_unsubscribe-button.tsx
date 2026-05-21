"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { unsubscribeFromAccount } from "../../../(public)/_actions/newsletter";

export function UnsubscribeButton() {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm("Unsubscribe from the Bazar Brief?")) return;
    startTransition(async () => {
      const result = await unsubscribeFromAccount();
      if (result.status === "ok") toast.success(result.message);
      else toast.error(result.message);
    });
  };

  return (
    <Button variant="outline" onClick={onClick} disabled={pending}>
      {pending ? "Unsubscribing…" : "Unsubscribe"}
    </Button>
  );
}
