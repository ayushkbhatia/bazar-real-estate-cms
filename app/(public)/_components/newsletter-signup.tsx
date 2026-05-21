"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeToNewsletter } from "../_actions/newsletter";
import type { NewsletterSource } from "@/lib/schemas/newsletter";

type Props = {
  source: NewsletterSource;
  /** Visual variant for the dark editorial card vs the lighter inline forms. */
  variant?: "dark" | "light";
};

export function NewsletterSignup({ source, variant = "light" }: Props) {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await subscribeToNewsletter({ email, source });
      if (result.status === "ok") {
        setMessage({ kind: "success", text: result.message });
        setEmail("");
      } else if (result.status === "already_confirmed") {
        setMessage({ kind: "info", text: result.message });
      } else {
        setMessage({ kind: "error", text: result.message });
      }
    });
  };

  const onDark = variant === "dark";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex gap-2 max-w-md">
        <Input
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
          className={
            onDark
              ? "bg-white/10 text-white placeholder:text-white/40 border-white/20"
              : ""
          }
        />
        <Button type="submit" disabled={pending}>
          <Mail size={14} strokeWidth={1.8} />
          {pending ? "Subscribing…" : "Subscribe"}
        </Button>
      </div>
      {message ? (
        <p
          className={`text-[12.5px] leading-snug max-w-md ${
            message.kind === "error"
              ? "text-[oklch(0.65_0.18_28)]"
              : onDark
                ? "text-white/70"
                : "text-bz-muted"
          }`}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
