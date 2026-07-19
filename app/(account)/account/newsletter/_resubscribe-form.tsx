"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { subscribeToNewsletter } from "../../../(public)/_actions/newsletter";

type Props = {
  defaultEmail: string;
};

export function ResubscribeForm({ defaultEmail }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await subscribeToNewsletter({
        email,
        source: "account",
      });
      if (result.status === "ok") {
        toast.success(result.message);
      } else if (result.status === "already_confirmed") {
        toast.info(result.message);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex gap-2 mt-4 max-w-md">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="bz-field flex-1 h-9 px-3 rounded border border-bz-border bg-bz-bg text-[14px] outline-none focus:border-bz-accent"
        required
      />
      <Button type="submit" size="sm" disabled={pending}>
        <Mail size={13} strokeWidth={1.8} />
        {pending ? "Sending…" : "Subscribe"}
      </Button>
    </form>
  );
}
